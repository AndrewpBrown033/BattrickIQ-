/**
 * Transfer market watchlist + bid timing + light monitor.
 *
 * Persists in localStorage and mirrors to Firestore (users/{uid}/settings/transferWatch) so the watch
 * list follows you across devices. Every device edits locally first; changes are merged with the cloud
 * copy by playerId (see watchlistMerge.ts: removals use tombstones, bot settings follow their own clock)
 * and a live listener (startWatchlistLiveSync, started from AppShell) applies other devices' edits as
 * they happen.
 */
import { onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';
import type { TransferListing, BuyRecommendation, TeamRatingKey } from './transferList';
import {
  mergeWatchState,
  sameState,
  stampLocalChanges,
  type Tombstones,
  type WatchState,
} from './watchlistMerge';
import { clearBotLeaseState, setBotLeaseFromCloud, watchDocRef } from './watchBotLease';

const WL_KEY = 'bt_transfer_watchlist';
const REMOVED_KEY = 'bt_transfer_watchlist_removed';
const SCAN_META_KEY = 'bt_transfer_last_scan';
const ALERTS_KEY = 'bt_transfer_alerts';
const LOCAL_META_KEY = 'bt_transfer_watchlist_meta';
export const WATCH_CHANGED_EVENT = 'bt_transfer_watchlist_changed';
export const WATCH_SYNC_EVENT = 'bt_watch_sync_status';

export type WatchStatus = 'listed' | 'sold' | 'unknown';
export type BidHint =
  | 'bid_now'
  | 'consider'
  | 'wait_cash'
  | 'ending_soon'
  | 'over_budget'
  | 'monitor';

export interface WatchEntry {
  playerId: string;
  name: string;
  addedAt: string;
  reason: string;
  fitsNeed?: string;
  ratingKey?: TeamRatingKey;
  lastAskingPrice?: number;
  lastCurrentBid?: number;
  lastCost: number;
  lastDeadline?: string;
  lastSeenAt?: string;
  status: WatchStatus;
  playerUrl?: string;
  age?: number;
  skills?: TransferListing['skills'];
  bidHint?: BidHint;
  bidHintText?: string;
  nowAffordable?: boolean;
  acknowledged?: boolean;
  botEnabled?: boolean;
  maxBid?: number;
  expectedBid?: number;
  lastBotCheckAt?: string;
  lastBotAction?: string;
  botStatus?: 'idle' | 'armed' | 'bidding' | 'leading' | 'maxed' | 'error' | 'sold';
  lastBidderTeam?: string;
  updatedAt?: string;
}

export interface TransferScanMeta {
  at: string;
  listingCount: number;
  shortlistCount: number;
}

export interface TransferAlert {
  id: string;
  at: string;
  playerId: string;
  name: string;
  message: string;
  kind: 'affordable' | 'ending_soon' | 'price_drop' | 'new_fit' | 'sold';
  read?: boolean;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const DEADLINE_TZ = 'Australia/Sydney';

function parseDeadlineParts(deadline?: string | null) {
  if (!deadline) return null;
  const m = String(deadline).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { d: +m[1], mo: +m[2], y: +m[3], h: +m[4], mi: +m[5] };
}

export function sydneyWallTimeToUtcMs(y: number, mo: number, d: number, h: number, mi: number): number {
  let utc = Date.UTC(y, mo - 1, d, h, mi, 0);
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: DEADLINE_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(utc));
    const get = (t: string) => {
      const p = parts.find((x) => x.type === t);
      return p ? Number(p.value) : 0;
    };
    let hour = get('hour');
    if (hour === 24) hour = 0;
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
    const desired = Date.UTC(y, mo - 1, d, h, mi, 0);
    utc += desired - asUtc;
  }
  return utc;
}

export function parseDeadlineSydneyMs(deadline?: string | null): number | null {
  const p = parseDeadlineParts(deadline);
  if (!p) return null;
  const ms = sydneyWallTimeToUtcMs(p.y, p.mo, p.d, p.h, p.mi);
  return Number.isFinite(ms) ? ms : null;
}

export function hoursUntilDeadline(deadline?: string | null): number | null {
  const ms = parseDeadlineSydneyMs(deadline);
  if (ms == null) return null;
  return (ms - Date.now()) / 3600000;
}

export function getDeadlineCountdown(deadline?: string | null, nowMs: number = Date.now()) {
  const end = parseDeadlineSydneyMs(deadline);
  if (end == null) return null;
  const msLeft = end - nowMs;
  const sydneyEndLabel = new Intl.DateTimeFormat('en-AU', {
    timeZone: DEADLINE_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(end));
  if (msLeft <= 0) return { msLeft: 0, ended: true, label: 'Ended', sydneyEndLabel };
  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  let label: string;
  if (days > 0) label = `${days}d ${hours}h ${pad(mins)}m ${pad(secs)}s`;
  else if (hours > 0) label = `${hours}h ${pad(mins)}m ${pad(secs)}s`;
  else label = `${mins}m ${pad(secs)}s`;
  return { msLeft, ended: false, label, sydneyEndLabel };
}

function newerIso(a?: string, b?: string): string {
  const x = a || '';
  const y = b || '';
  if (!x) return y;
  if (!y) return x;
  return x >= y ? x : y;
}

/** Union two watch lists by playerId (newer edit wins). Kept for callers/patch scripts that merge plain lists. */
export function mergeWatchEntries(a: WatchEntry[], b: WatchEntry[]): WatchEntry[] {
  return mergeWatchState({ items: a || [], removed: {} }, { items: b || [], removed: {} }).items;
}

export function loadWatchlist(): WatchEntry[] {
  const list = readJson<WatchEntry[]>(WL_KEY, []);
  return Array.isArray(list) ? list : [];
}

function loadRemoved(): Tombstones {
  const raw = readJson<Tombstones>(REMOVED_KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function loadLocalState(): WatchState {
  return { items: loadWatchlist(), removed: loadRemoved() };
}

function getLocalWatchMeta(): { updatedAt: string } {
  return readJson<{ updatedAt: string }>(LOCAL_META_KEY, { updatedAt: '' });
}

function setLocalWatchMeta(updatedAt: string) {
  writeJson(LOCAL_META_KEY, { updatedAt });
}

function notifyChanged() {
  try {
    window.dispatchEvent(new Event(WATCH_CHANGED_EVENT));
  } catch {}
}

function writeLocalState(s: WatchState, at: string) {
  writeJson(WL_KEY, s.items);
  writeJson(REMOVED_KEY, s.removed);
  setLocalWatchMeta(at);
  notifyChanged();
}

// ---------------------------------------------------------------------------------------------
// Cloud sync status (read by the Watch page)
// ---------------------------------------------------------------------------------------------
let lastCloudError: string | null = null;
let lastCloudOkAt: string | null = null;
let liveUid: string | null = null;

function setSyncStatus(error: string | null, okAt?: string) {
  lastCloudError = error;
  if (!error) lastCloudOkAt = okAt || new Date().toISOString();
  try {
    window.dispatchEvent(new Event(WATCH_SYNC_EVENT));
  } catch {}
}

export function getWatchCloudStatus() {
  const user = getCustomUser();
  return {
    signedIn: !!user?.uid,
    firebaseSession: !!auth.currentUser,
    live: !!liveUid && liveUid === user?.uid,
    lastError: lastCloudError,
    lastOkAt: lastCloudOkAt,
    uid: user?.uid || null,
  };
}

function friendlyCloudError(e: any): string {
  const msg = String(e?.message || e || 'Cloud save failed');
  return /permission|insufficient|unauth/i.test(msg)
    ? 'Cloud permission denied — sign out and back into BattrickIQ, then Sync'
    : msg.slice(0, 200);
}

/** Shape a Firestore doc into a WatchState; tolerant of old docs that only have `items`. */
function parseCloud(data: any): WatchState {
  const items: WatchEntry[] = Array.isArray(data?.items) ? data.items.filter((w: any) => w?.playerId) : [];
  const removed: Tombstones = {};
  if (data?.removed && typeof data.removed === 'object' && !Array.isArray(data.removed)) {
    for (const [id, at] of Object.entries(data.removed)) {
      if (typeof at === 'string') removed[id] = at;
    }
  }
  return { items, removed };
}

// ---------------------------------------------------------------------------------------------
// Pushing: one transaction at a time, always merge-then-write, never blind overwrite
// ---------------------------------------------------------------------------------------------
let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

type SyncResult = { ok: boolean; error?: string; count?: number };

/** Merge cloud + local in a Firestore transaction, write back what changed, then update local. */
async function syncOnce(): Promise<SyncResult> {
  const user = getCustomUser();
  if (!user?.uid) {
    setSyncStatus('Sign in to BattrickIQ to sync Watch across devices');
    return { ok: false, error: lastCloudError! };
  }
  if (!auth.currentUser) {
    setSyncStatus('Firebase session missing — sign out of BattrickIQ and sign back in');
    return { ok: false, error: lastCloudError! };
  }
  try {
    const ref = watchDocRef(user.uid);
    const merged = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const cloud = snap.exists() ? parseCloud(snap.data()) : { items: [], removed: {} };
      const next = mergeWatchState(cloud, loadLocalState());
      if (!snap.exists() || !sameState(cloud, next)) {
        // JSON round-trip: Firestore rejects `undefined` field values.
        tx.set(
          ref,
          JSON.parse(
            JSON.stringify({ items: next.items, removed: next.removed, updatedAt: new Date().toISOString() })
          ),
          { merge: true }
        );
      }
      return next;
    });

    // The user may have edited while the transaction was in flight: re-merge with *current* local
    // so that edit isn't clobbered, and push again if it left something the cloud doesn't have yet.
    const final = mergeWatchState(merged, loadLocalState());
    const at = new Date().toISOString();
    if (!sameState(final, loadLocalState())) writeLocalState(final, at);
    else setLocalWatchMeta(at);
    if (!sameState(final, merged)) schedulePush(150);
    setSyncStatus(null, at);
    return { ok: true, count: final.items.length };
  } catch (e: any) {
    const error = friendlyCloudError(e);
    setSyncStatus(error);
    return { ok: false, error };
  }
}

let pushTimer: number | null = null;
/** Coalesce bursts of edits (a bot tick saves several times) into one cloud write. */
function schedulePush(delayMs = 400) {
  if (typeof window === 'undefined') return;
  if (!getCustomUser()?.uid) return;
  if (pushTimer != null) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void enqueue(syncOnce);
  }, delayMs);
}

/** Apply a cloud snapshot to this device (merge, never overwrite). */
function ingestCloud(cloud: WatchState): WatchEntry[] {
  const local = loadLocalState();
  const merged = mergeWatchState(cloud, local);
  if (!sameState(merged, local)) writeLocalState(merged, new Date().toISOString());
  // This device knows something the cloud doesn't (offline edit, first sign-in): publish it.
  if (!sameState(merged, cloud)) schedulePush(150);
  return merged.items;
}

/**
 * Keep this device in step with the account's other devices for as long as the user is signed in.
 * Started once from AppShell (not from the Watch page), so edits made on another device show up
 * everywhere in the app and the Home cards, not only while the Watch tab is open.
 * Returns a stop function.
 */
export function startWatchlistLiveSync(uid: string): () => void {
  liveUid = uid;
  let stopped = false;
  const unsub = onSnapshot(
    watchDocRef(uid),
    (snap) => {
      if (stopped || snap.metadata.hasPendingWrites) return;
      if (snap.exists()) {
        const data = snap.data();
        setBotLeaseFromCloud((data as any)?.botLease);
        ingestCloud(parseCloud(data));
      } else if (loadWatchlist().length > 0) {
        schedulePush(0); // first sign-in with data on this device: publish it
      }
      setSyncStatus(null);
    },
    (err) => setSyncStatus('Live sync paused: ' + friendlyCloudError(err))
  );

  // Phones suspend tabs and laptops sleep: catch up as soon as the app is back / online.
  const catchUp = () => {
    if (!stopped && document.visibilityState !== 'hidden') void enqueue(syncOnce);
  };
  document.addEventListener('visibilitychange', catchUp);
  window.addEventListener('online', catchUp);
  window.addEventListener('focus', catchUp);
  void enqueue(syncOnce);

  return () => {
    stopped = true;
    if (liveUid === uid) liveUid = null;
    unsub();
    document.removeEventListener('visibilitychange', catchUp);
    window.removeEventListener('online', catchUp);
    window.removeEventListener('focus', catchUp);
    clearBotLeaseState();
  };
}

/** Compat: apply cloud items to this device (used by older page code). */
export function applyIncomingCloudWatchlist(cloudItems: WatchEntry[], _cloudAt?: string): WatchEntry[] {
  return ingestCloud({ items: Array.isArray(cloudItems) ? cloudItems.filter((w) => w?.playerId) : [], removed: {} });
}

export function saveWatchlist(list: WatchEntry[]) {
  const now = new Date().toISOString();
  const next = stampLocalChanges(loadLocalState(), Array.isArray(list) ? list : [], now);
  writeLocalState(next, now);
  schedulePush();
}

/** Compat: push now. Arguments are ignored — the merged local state is what gets published. */
export async function mirrorWatchlistToCloud(_list?: WatchEntry[], _updatedAt?: string): Promise<SyncResult> {
  return enqueue(syncOnce);
}

export async function hydrateWatchlistFromCloud(): Promise<WatchEntry[]> {
  await enqueue(syncOnce);
  return loadWatchlist();
}

export async function syncWatchlistFromCloud() {
  const user = getCustomUser();
  if (!user?.uid || !auth.currentUser) {
    return {
      list: loadWatchlist(),
      source: 'local' as const,
      error: 'Sign in to BattrickIQ with the same account on every device (app login, not only Battrick)',
    };
  }
  const res = await enqueue(syncOnce);
  const list = loadWatchlist();
  return res.ok
    ? { list, source: 'cloud' as const, error: undefined as string | undefined }
    : { list, source: 'local' as const, error: res.error };
}

export function addToWatchlist(
  entry: Omit<WatchEntry, 'addedAt' | 'status' | 'lastCost'> & { lastCost?: number }
): WatchEntry[] {
  const list = loadWatchlist();
  const id = String(entry.playerId);
  const next = list.filter((w) => w.playerId !== id);
  const now = new Date().toISOString();
  next.unshift({
    ...entry,
    playerId: id,
    addedAt: now,
    updatedAt: now,
    status: 'listed',
    lastCost: entry.lastCost ?? entry.lastCurrentBid ?? entry.lastAskingPrice ?? 0,
  });
  saveWatchlist(next);
  return loadWatchlist();
}

export function removeFromWatchlist(playerId: string): WatchEntry[] {
  const next = loadWatchlist().filter((w) => w.playerId !== String(playerId));
  saveWatchlist(next);
  return loadWatchlist();
}

export function acknowledgeWatch(playerId: string): WatchEntry[] {
  const next = loadWatchlist().map((w) =>
    w.playerId === String(playerId) ? { ...w, acknowledged: true } : w
  );
  saveWatchlist(next);
  return loadWatchlist();
}

export function recordTransferScan(
  listingCountOrMeta: number | TransferScanMeta,
  shortlistCount?: number
) {
  if (typeof listingCountOrMeta === 'object' && listingCountOrMeta) {
    writeJson(SCAN_META_KEY, listingCountOrMeta);
    return;
  }
  writeJson(SCAN_META_KEY, {
    at: new Date().toISOString(),
    listingCount: listingCountOrMeta,
    shortlistCount: shortlistCount ?? 0,
  } satisfies TransferScanMeta);
}

export function getLastTransferScan(): TransferScanMeta | null {
  const m = readJson<TransferScanMeta | null>(SCAN_META_KEY, null);
  return m && m.at ? m : null;
}

export function hoursSinceLastScan(): number | null {
  const m = getLastTransferScan();
  if (!m?.at) return null;
  const t = Date.parse(m.at);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3600000;
}

export function shouldAutoScanTransfers(maxAgeHours = 6): boolean {
  const h = hoursSinceLastScan();
  if (h == null) return true;
  return h >= maxAgeHours;
}

function pushAlert(partial: Omit<TransferAlert, 'id' | 'at'> & { id?: string; at?: string }): TransferAlert {
  const alert: TransferAlert = {
    id: partial.id || `${Date.now()}_${partial.playerId}`,
    at: partial.at || new Date().toISOString(),
    playerId: partial.playerId,
    name: partial.name,
    message: partial.message,
    kind: partial.kind,
    read: false,
  };
  const list = readJson<TransferAlert[]>(ALERTS_KEY, []);
  list.unshift(alert);
  writeJson(ALERTS_KEY, list.slice(0, 50));
  return alert;
}

export function loadAlerts(): TransferAlert[] {
  return readJson<TransferAlert[]>(ALERTS_KEY, []);
}

export function unreadAlertCount(): number {
  return loadAlerts().filter((a) => !a.read).length;
}

export function markAlertsRead(): void {
  const list = loadAlerts().map((a) => ({ ...a, read: true }));
  writeJson(ALERTS_KEY, list);
}

export function computeBidHint(
  listing: { deadline?: string; askingPrice?: number; currentBid?: number },
  cost: number,
  cash?: number
): { hint: BidHint; text: string } {
  const hours = hoursUntilDeadline(listing.deadline);
  if (cash != null && cost > cash) {
    return { hint: 'over_budget', text: `Over budget (need £${cost.toLocaleString()})` };
  }
  if (hours != null && hours <= 3) {
    return { hint: 'ending_soon', text: `Ends in ~${Math.max(0, hours).toFixed(1)}h` };
  }
  if (hours != null && hours <= 12) {
    return { hint: 'consider', text: `Deadline within 12h — review bid` };
  }
  if (cash != null && cost > cash * 0.85) {
    return { hint: 'wait_cash', text: 'Tight on cash — wait or free funds' };
  }
  if (hours != null && hours <= 24) {
    return { hint: 'bid_now', text: 'Within 24h — set max bid if interested' };
  }
  return { hint: 'monitor', text: 'On watch' };
}

export function addRecommendationToWatchlist(rec: BuyRecommendation, reason?: string): WatchEntry[] {
  const l = rec.listing;
  const id = String(l?.playerId || (rec as any).playerId || (rec as any).id || '');
  if (!id) throw new Error('Missing player id on recommendation');
  const cost = rec.cost || l?.currentBid || l?.askingPrice || 0;
  return addToWatchlist({
    playerId: id,
    name: l?.name || (rec as any).name || 'Unknown',
    reason: reason || rec.fitsNeed || (rec.reasons && rec.reasons[0]) || 'Estimator shortlist',
    fitsNeed: rec.fitsNeed,
    lastAskingPrice: l?.askingPrice,
    lastCurrentBid: l?.currentBid,
    lastCost: cost,
    lastDeadline: l?.deadline,
    playerUrl: l?.playerUrl || (id ? `https://www.battrick.org/nl/playerdetails.asp?playerID=${id}` : undefined),
    age: l?.age,
    skills: l?.skills,
  });
}

export function refreshWatchlistFromListings(listings: TransferListing[], cash?: number) {
  const byId = new Map(listings.map((l) => [String(l.playerId || (l as any).id), l]));
  const newAlerts: TransferAlert[] = [];
  const updated = loadWatchlist().map((w) => {
    const hit = byId.get(String(w.playerId));
    if (!hit) {
      if (w.status === 'listed') {
        newAlerts.push(
          pushAlert({
            playerId: w.playerId,
            name: w.name,
            kind: 'sold',
            message: `${w.name} no longer on the transfer list (sold or delisted).`,
          })
        );
        return { ...w, status: 'sold' as WatchStatus, updatedAt: new Date().toISOString() };
      }
      return w;
    }
    const cost = hit.currentBid || hit.askingPrice || w.lastCost || 0;
    const prevCost = w.lastCost || 0;
    const hint = computeBidHint(hit, cost, cash);
    const becameAffordable =
      cash != null && prevCost > cash && cost <= cash && w.status === 'listed';
    if (becameAffordable) {
      newAlerts.push(
        pushAlert({
          playerId: w.playerId,
          name: w.name,
          kind: 'affordable',
          message: `${w.name} is now within budget (£${cost.toLocaleString()}).`,
        })
      );
    }
    if (prevCost > 0 && cost < prevCost * 0.9) {
      newAlerts.push(
        pushAlert({
          playerId: w.playerId,
          name: w.name,
          kind: 'price_drop',
          message: `${w.name} price dropped (£${prevCost.toLocaleString()} → £${cost.toLocaleString()}).`,
        })
      );
    }
    return {
      ...w,
      status: 'listed' as WatchStatus,
      lastAskingPrice: hit.askingPrice,
      lastCurrentBid: hit.currentBid,
      lastCost: cost,
      lastDeadline: hit.deadline || w.lastDeadline,
      lastSeenAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      playerUrl: hit.playerUrl || w.playerUrl,
      age: hit.age ?? w.age,
      skills: hit.skills || w.skills,
      bidHint: hint.hint,
      bidHintText: hint.text,
      nowAffordable: becameAffordable || w.nowAffordable,
      acknowledged: becameAffordable ? false : w.acknowledged,
    };
  });
  saveWatchlist(updated);
  return { watchlist: updated, alerts: newAlerts };
}

export function getWatchlistMonitorSummary(cash?: number) {
  const list = loadWatchlist();
  const listed = list.filter((w) => w.status === 'listed');
  const sold = list.filter((w) => w.status === 'sold');
  let actionable = 0;
  let endingSoon = 0;
  const topLines: string[] = [];
  for (const w of listed) {
    const hint =
      w.bidHint && w.bidHintText
        ? { hint: w.bidHint, text: w.bidHintText }
        : computeBidHint(
            { deadline: w.lastDeadline, askingPrice: w.lastAskingPrice, currentBid: w.lastCurrentBid },
            w.lastCost,
            cash
          );
    if (
      hint.hint === 'bid_now' ||
      hint.hint === 'consider' ||
      hint.hint === 'ending_soon' ||
      w.nowAffordable
    ) {
      actionable += 1;
      if (topLines.length < 3) topLines.push(`${w.name}: ${hint.text}`);
    }
    if (hint.hint === 'ending_soon') endingSoon += 1;
  }
  const meta = getLastTransferScan();
  return {
    watched: list.length,
    listed: listed.length,
    sold: sold.length,
    actionable,
    endingSoon,
    lastScanAt: meta?.at || null,
    staleHours: hoursSinceLastScan(),
    unreadAlerts: unreadAlertCount(),
    topLines,
  };
}
