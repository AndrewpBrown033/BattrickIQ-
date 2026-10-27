/** Transfer watchlist + cloud mirror (users/{uid}/settings/transferWatch). */
export {
  DEADLINE_TZ,
  parseDeadlineGmtMs,
  parseDeadlineSydneyMs,
  hoursUntilDeadline,
  getDeadlineCountdown,
} from './auctionDeadline';

import { onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';
import {
  mergeWatchState,
  sameState,
  stampLocalChanges,
  type Tombstones,
  type WatchState,
} from './watchlistMerge';
import { clearBotLeaseState, setBotLeaseFromCloud, watchDocRef } from './watchBotLease';

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
  lastAskingPrice?: number;
  lastCurrentBid?: number;
  lastCost: number;
  lastDeadline?: string;
  lastSeenAt?: string;
  status: WatchStatus;
  playerUrl?: string;
  age?: number;
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
  intentAt?: string;
}

const WL_KEY = 'bt_transfer_watchlist';
const REMOVED_KEY = 'bt_transfer_watchlist_removed';
const LOCAL_META_KEY = 'bt_transfer_watchlist_meta';
const SCAN_META_KEY = 'bt_transfer_last_scan';
const ALERTS_KEY = 'bt_transfer_alerts';
export const WATCH_CHANGED_EVENT = 'bt_transfer_watchlist_changed';
export const WATCH_SYNC_EVENT = 'bt_watch_sync_status';

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
function loadRemoved(): Tombstones {
  return readJson<Tombstones>(REMOVED_KEY, {});
}
function loadLocalState(): WatchState {
  return { items: loadWatchlist(), removed: loadRemoved() };
}
function notifyChanged() {
  try {
    window.dispatchEvent(new Event(WATCH_CHANGED_EVENT));
  } catch {}
}
function writeLocalState(s: WatchState, at: string) {
  writeJson(WL_KEY, s.items);
  writeJson(REMOVED_KEY, s.removed);
  writeJson(LOCAL_META_KEY, { updatedAt: at });
  notifyChanged();
}

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

function parseCloud(data: any): WatchState {
  const items: WatchEntry[] = Array.isArray(data?.items)
    ? data.items.filter((w: any) => w?.playerId)
    : [];
  const removed: Tombstones = {};
  if (data?.removed && typeof data.removed === 'object' && !Array.isArray(data.removed)) {
    for (const [id, at] of Object.entries(data.removed)) {
      if (typeof at === 'string') removed[id] = at;
    }
  }
  return { items, removed };
}

let chain: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => {});
  return run;
}

type SyncResult = { ok: boolean; error?: string; count?: number };

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
        tx.set(
          ref,
          JSON.parse(
            JSON.stringify({
              items: next.items,
              removed: next.removed,
              updatedAt: new Date().toISOString(),
            })
          ),
          { merge: true }
        );
      }
      return next;
    });
    const final = mergeWatchState(merged, loadLocalState());
    const at = new Date().toISOString();
    if (!sameState(final, loadLocalState())) writeLocalState(final, at);
    else writeJson(LOCAL_META_KEY, { updatedAt: at });
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
function schedulePush(delay = 400) {
  if (pushTimer != null) window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void enqueue(syncOnce);
  }, delay);
}

function ingestCloud(cloud: WatchState): WatchEntry[] {
  const next = mergeWatchState(cloud, loadLocalState());
  const at = new Date().toISOString();
  writeLocalState(next, at);
  return next.items;
}

export function startWatchlistLiveSync(uid: string): () => void {
  if (!uid || !auth.currentUser) {
    setSyncStatus(
      !auth.currentUser
        ? 'Firebase session missing — sign out of BattrickIQ and sign back in'
        : 'Sign in to BattrickIQ to sync Watch across devices'
    );
    liveUid = null;
    return () => {};
  }
  liveUid = uid;
  let stopped = false;
  let unsub: () => void = () => {};
  unsub = onSnapshot(
    watchDocRef(uid),
    (snap) => {
      if (stopped || snap.metadata.hasPendingWrites) return;
      if (snap.exists()) {
        const data = snap.data();
        setBotLeaseFromCloud((data as any)?.botLease);
        ingestCloud(parseCloud(data));
      } else if (loadWatchlist().length > 0) {
        schedulePush(0);
      }
      setSyncStatus(null);
    },
    (err) => {
      const msg = friendlyCloudError(err);
      setSyncStatus('Live sync paused: ' + msg);
      if (/permission|insufficient|unauth/i.test(String(err?.code || err?.message || msg))) {
        try {
          unsub();
        } catch {}
      }
    }
  );
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

export function mergeWatchEntries(a: WatchEntry[], b: WatchEntry[]): WatchEntry[] {
  return mergeWatchState({ items: a || [], removed: {} }, { items: b || [], removed: {} }).items;
}

export function loadWatchlist(): WatchEntry[] {
  const list = readJson<WatchEntry[]>(WL_KEY, []);
  return Array.isArray(list) ? list.map((w) => ({ ...w, playerId: String(w.playerId) })) : [];
}

export function saveWatchlist(list: WatchEntry[]) {
  const now = new Date().toISOString();
  const next = stampLocalChanges(loadLocalState(), Array.isArray(list) ? list : [], now);
  writeLocalState(next, now);
  schedulePush();
}

export async function mirrorWatchlistToCloud(): Promise<SyncResult> {
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

export function applyIncomingCloudWatchlist(cloudItems: WatchEntry[]): WatchEntry[] {
  return ingestCloud({
    items: Array.isArray(cloudItems) ? cloudItems.filter((w) => w?.playerId) : [],
    removed: {},
  });
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

export type TransferScanMeta = {
  at: string;
  listingCount?: number;
  shortlistCount?: number;
};

export function recordTransferScan(
  listingCountOrMeta: number | TransferScanMeta,
  shortlistCount?: number
) {
  const meta: TransferScanMeta =
    typeof listingCountOrMeta === 'object' && listingCountOrMeta
      ? listingCountOrMeta
      : {
          at: new Date().toISOString(),
          listingCount: listingCountOrMeta as number,
          shortlistCount,
        };
  writeJson(SCAN_META_KEY, meta);
}

export function getLastTransferScan(): TransferScanMeta | null {
  return readJson<TransferScanMeta | null>(SCAN_META_KEY, null);
}

export function hoursSinceLastScan(): number | null {
  const m = getLastTransferScan();
  if (!m?.at) return null;
  const ms = Date.parse(m.at);
  if (!Number.isFinite(ms)) return null;
  return (Date.now() - ms) / 3600000;
}

export function shouldAutoScanTransfers(maxAgeHours = 6): boolean {
  const h = hoursSinceLastScan();
  return h == null || h >= maxAgeHours;
}

export type TransferAlert = {
  id: string;
  name: string;
  message: string;
  kind?: string;
  read?: boolean;
  at?: string;
};

export function loadAlerts(): TransferAlert[] {
  return readJson<TransferAlert[]>(ALERTS_KEY, []);
}
export function unreadAlertCount(): number {
  return loadAlerts().filter((a) => !a.read).length;
}
export function markAlertsRead(): void {
  writeJson(
    ALERTS_KEY,
    loadAlerts().map((a) => ({ ...a, read: true }))
  );
  try {
    window.dispatchEvent(new Event('bt_transfer_alerts_changed'));
  } catch {}
}

export function computeBidHint() {
  return { hint: 'monitor' as BidHint, text: 'On watch' };
}

export function addRecommendationToWatchlist(rec: any, reason?: string): WatchEntry[] {
  if (!rec?.playerId) return loadWatchlist();
  return addToWatchlist({
    playerId: String(rec.playerId),
    name: rec.name || `Player ${rec.playerId}`,
    reason: reason || rec.reason || 'Recommendation',
    lastAskingPrice: rec.askingPrice,
    lastCurrentBid: rec.currentBid,
    lastDeadline: rec.deadline,
  });
}

export function refreshWatchlistFromListings(listings: any[] = [], _cash?: number) {
  return { watchlist: loadWatchlist(), alerts: loadAlerts() };
}

export function getWatchlistMonitorSummary(_cash?: number) {
  const list = loadWatchlist();
  return {
    watched: list.length,
    listed: list.filter((w) => w.status === 'listed').length,
    sold: list.filter((w) => w.status === 'sold').length,
    actionable: list.filter((w) => w.botStatus === 'maxed' || w.bidHint === 'bid_now').length,
    endingSoon: 0,
    lastScanAt: getLastTransferScan()?.at || null,
    staleHours: hoursSinceLastScan(),
    unreadAlerts: unreadAlertCount(),
    topLines: [] as string[],
  };
}
