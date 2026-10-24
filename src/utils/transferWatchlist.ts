/**
 * Transfer market watchlist + bid timing + light monitor.
 * Persists in localStorage; Firestore mirror under users/{uid}/settings/transferWatch
 * so the watch list is shared across devices (merged by playerId).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';
import type { TransferListing, BuyRecommendation, TeamRatingKey } from './transferList';

const WL_KEY = 'bt_transfer_watchlist';
const SCAN_META_KEY = 'bt_transfer_last_scan';
const ALERTS_KEY = 'bt_transfer_alerts';
const LOCAL_META_KEY = 'bt_transfer_watchlist_meta';

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

export function mergeWatchEntries(a: WatchEntry[], b: WatchEntry[]): WatchEntry[] {
  const byId = new Map<string, WatchEntry>();
  for (const list of [a, b]) {
    for (const w of list || []) {
      if (!w?.playerId) continue;
      const id = String(w.playerId);
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, { ...w, playerId: id });
        continue;
      }
      const prevT = prev.updatedAt || prev.addedAt || '';
      const curT = w.updatedAt || w.addedAt || '';
      byId.set(
        id,
        curT >= prevT
          ? {
              ...prev,
              ...w,
              playerId: id,
              maxBid: w.maxBid ?? prev.maxBid,
              botEnabled: w.botEnabled ?? prev.botEnabled,
              botStatus: w.botStatus || prev.botStatus,
              lastBotAction: w.lastBotAction || prev.lastBotAction,
              updatedAt: newerIso(prev.updatedAt, w.updatedAt),
            }
          : {
              ...w,
              ...prev,
              playerId: id,
              maxBid: prev.maxBid ?? w.maxBid,
              botEnabled: prev.botEnabled ?? w.botEnabled,
              updatedAt: newerIso(prev.updatedAt, w.updatedAt),
            }
      );
    }
  }
  return Array.from(byId.values()).sort((x, y) =>
    (y.updatedAt || y.addedAt || '').localeCompare(x.updatedAt || x.addedAt || '')
  );
}

export function loadWatchlist(): WatchEntry[] {
  const list = readJson<WatchEntry[]>(WL_KEY, []);
  return Array.isArray(list) ? list : [];
}

function getLocalWatchMeta(): { updatedAt: string } {
  return readJson<{ updatedAt: string }>(LOCAL_META_KEY, { updatedAt: '' });
}

function setLocalWatchMeta(updatedAt: string) {
  writeJson(LOCAL_META_KEY, { updatedAt });
}

let lastCloudError: string | null = null;
let lastCloudOkAt: string | null = null;

export function getWatchCloudStatus() {
  const user = getCustomUser();
  return {
    signedIn: !!user?.uid,
    firebaseSession: !!auth.currentUser,
    lastError: lastCloudError,
    lastOkAt: lastCloudOkAt,
    uid: user?.uid || null,
  };
}

export function applyIncomingCloudWatchlist(cloudItems: WatchEntry[], cloudAt: string): WatchEntry[] {
  const local = loadWatchlist();
  const items = Array.isArray(cloudItems) ? cloudItems.filter((w) => w?.playerId) : [];
  if (!items.length && local.length > 0) {
    void mirrorWatchlistToCloud(local, getLocalWatchMeta().updatedAt || new Date().toISOString());
    return local;
  }
  const merged = mergeWatchEntries(items, local);
  const at = cloudAt || getLocalWatchMeta().updatedAt || new Date().toISOString();
  writeJson(WL_KEY, merged);
  setLocalWatchMeta(at);
  try {
    window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
  } catch {}
  const cloudIds = new Set(items.map((w) => String(w.playerId)));
  if (local.some((w) => !cloudIds.has(String(w.playerId)))) {
    void mirrorWatchlistToCloud(merged, at);
  }
  return merged;
}

export function saveWatchlist(list: WatchEntry[]) {
  const now = new Date().toISOString();
  const stamped = (Array.isArray(list) ? list : []).map((w) => ({
    ...w,
    playerId: String(w.playerId),
    updatedAt: w.updatedAt || now,
  }));
  writeJson(WL_KEY, stamped);
  setLocalWatchMeta(now);
  try {
    window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
  } catch {}
  void mirrorWatchlistToCloud(stamped, now);
}

export async function mirrorWatchlistToCloud(
  list: WatchEntry[],
  updatedAt: string
): Promise<{ ok: boolean; error?: string; count?: number }> {
  const user = getCustomUser();
  if (!user?.uid) {
    lastCloudError = 'Sign in to BattrickIQ to sync Watch across devices';
    return { ok: false, error: lastCloudError };
  }
  if (!auth.currentUser) {
    lastCloudError = 'Firebase session missing — sign out of BattrickIQ and sign back in';
    return { ok: false, error: lastCloudError };
  }
  try {
    const ref = doc(db, 'users', user.uid, 'settings', 'transferWatch');
    let merged = (Array.isArray(list) ? list : []).filter((w) => w?.playerId);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as { items?: WatchEntry[] };
        const cloudItems = Array.isArray(data.items) ? data.items.filter((w) => w?.playerId) : [];
        merged = mergeWatchEntries(cloudItems, merged);
      }
    } catch {}
    const at = updatedAt || new Date().toISOString();
    await setDoc(ref, { items: merged, updatedAt: at }, { merge: true });
    writeJson(WL_KEY, merged);
    setLocalWatchMeta(at);
    lastCloudError = null;
    lastCloudOkAt = at;
    try {
      window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
    } catch {}
    return { ok: true, count: merged.length };
  } catch (e: any) {
    const msg = String(e?.message || e || 'Cloud save failed');
    lastCloudError = /permission|insufficient|unauth/i.test(msg)
      ? 'Cloud permission denied — sign out and back into BattrickIQ, then Sync'
      : msg.slice(0, 200);
    return { ok: false, error: lastCloudError };
  }
}

export async function hydrateWatchlistFromCloud(): Promise<WatchEntry[]> {
  const local = loadWatchlist();
  const localMeta = getLocalWatchMeta();
  const user = getCustomUser();
  if (!user?.uid || !auth.currentUser) {
    lastCloudError = !user?.uid
      ? 'Sign in to BattrickIQ to sync Watch across devices'
      : 'Firebase session missing — sign in again';
    return local;
  }
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'transferWatch'));
    if (!snap.exists()) {
      if (local.length > 0) await mirrorWatchlistToCloud(local, localMeta.updatedAt || new Date().toISOString());
      lastCloudError = null;
      return loadWatchlist();
    }
    const data = snap.data() as { items?: WatchEntry[]; updatedAt?: string };
    const cloudItems = Array.isArray(data.items) ? data.items.filter((w) => w?.playerId) : [];
    const cloudAt = typeof data.updatedAt === 'string' ? data.updatedAt : '';
    const merged = mergeWatchEntries(cloudItems, local);
    const at = newerIso(cloudAt, localMeta.updatedAt) || new Date().toISOString();
    writeJson(WL_KEY, merged);
    setLocalWatchMeta(at);
    lastCloudError = null;
    lastCloudOkAt = at;
    const cloudIds = new Set(cloudItems.map((w) => String(w.playerId)));
    if (local.some((w) => !cloudIds.has(String(w.playerId))) || merged.length > cloudItems.length) {
      await mirrorWatchlistToCloud(merged, at);
    }
    try {
      window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
    } catch {}
    return merged;
  } catch (e: any) {
    lastCloudError = String(e?.message || e || 'Cloud load failed').slice(0, 200);
    return local;
  }
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
  try {
    const list = await hydrateWatchlistFromCloud();
    if (lastCloudError) return { list, source: 'local' as const, error: lastCloudError };
    return { list, source: 'cloud' as const };
  } catch (e: any) {
    return { list: loadWatchlist(), source: 'local' as const, error: e?.message || 'Cloud sync failed' };
  }
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
  return next;
}

export function removeFromWatchlist(playerId: string): WatchEntry[] {
  const next = loadWatchlist().filter((w) => w.playerId !== String(playerId));
  saveWatchlist(next);
  return next;
}

export function acknowledgeWatch(playerId: string): WatchEntry[] {
  const now = new Date().toISOString();
  const next = loadWatchlist().map((w) =>
    w.playerId === String(playerId) ? { ...w, acknowledged: true, updatedAt: now } : w
  );
  saveWatchlist(next);
  return next;
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
