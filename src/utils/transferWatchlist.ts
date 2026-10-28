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
  type WatchState,
  type Tombstones,
} from './watchlistMerge';
import { clearBotLeaseState, setBotLeaseFromCloud, watchDocRef } from './watchBotLease';

export type WatchStatus = 'listed' | 'sold' | 'watching' | 'dropped';
export type BidHint = 'under' | 'at' | 'over' | 'unknown';

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
  wage?: number;
  role?: string;
  bowlingType?: string;
  skills?: {
    batting?: number;
    bowling?: number;
    keeping?: number;
    fielding?: number;
    stamina?: number;
    concentration?: number;
    consistency?: number;
    experience?: number;
  };
  buyFit?: {
    verdict: 'BUY' | 'MAYBE' | 'PASS';
    score: number;
    summary: string;
    reasons: string[];
    affordable: boolean;
  };
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

export type TransferAlert = {
  id: string;
  at: string;
  message: string;
  playerId?: string;
  read?: boolean;
};

const WL_KEY = 'bt_transfer_watchlist';
const REMOVED_KEY = 'bt_transfer_watchlist_removed';
const LOCAL_META_KEY = 'bt_transfer_watchlist_meta';
const SCAN_META_KEY = 'bt_transfer_last_scan';
const ALERTS_KEY = 'bt_transfer_alerts';
export const WATCH_CHANGED_EVENT = 'bt_transfer_watchlist_changed';
export const WATCH_SYNC_EVENT = 'bt_watch_sync_status';

let lastCloudError: string | null = null;
let lastCloudOkAt: string | null = null;
let liveUid: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let chain: Promise<any> = Promise.resolve();

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
function notify() {
  try {
    window.dispatchEvent(new Event(WATCH_CHANGED_EVENT));
  } catch {}
}
function setSyncStatus(msg: string | null) {
  lastCloudError = msg;
  try {
    window.dispatchEvent(new CustomEvent(WATCH_SYNC_EVENT, { detail: getWatchCloudStatus() }));
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
    ? data.items.filter((w: any) => w?.playerId).map((w: any) => ({ ...w, playerId: String(w.playerId) }))
    : [];
  const removed: Tombstones = {};
  if (data?.removed && typeof data.removed === 'object') {
    for (const [k, v] of Object.entries(data.removed)) {
      if (typeof v === 'string') removed[k] = v;
    }
  }
  return { items, removed, updatedAt: data?.updatedAt };
}

function loadLocalState(): WatchState {
  const items = readJson<WatchEntry[]>(WL_KEY, []);
  const removed = readJson<Tombstones>(REMOVED_KEY, {});
  const meta = readJson<{ updatedAt?: string }>(LOCAL_META_KEY, {});
  return {
    items: Array.isArray(items) ? items.map((w) => ({ ...w, playerId: String(w.playerId) })) : [],
    removed: removed && typeof removed === 'object' ? removed : {},
    updatedAt: meta?.updatedAt,
  };
}

function writeLocalState(state: WatchState, updatedAt?: string) {
  writeJson(WL_KEY, state.items || []);
  writeJson(REMOVED_KEY, state.removed || {});
  writeJson(LOCAL_META_KEY, { updatedAt: updatedAt || state.updatedAt || new Date().toISOString() });
  notify();
}

function ingestCloud(cloud: WatchState): WatchEntry[] {
  const local = loadLocalState();
  const merged = mergeWatchState(local, cloud);
  writeLocalState(merged, cloud.updatedAt || local.updatedAt);
  return merged.items;
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function schedulePush(delayMs = 400) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void enqueue(syncOnce);
  }, delayMs);
}

type SyncResult = { ok: boolean; error?: string };

async function syncOnce(): Promise<SyncResult> {
  const user = getCustomUser();
  if (!user?.uid || !auth.currentUser) {
    return { ok: false, error: 'Sign in to BattrickIQ with the same account on every device' };
  }
  const uid = user.uid;
  const local = loadLocalState();
  try {
    await runTransaction(db, async (tx) => {
      const ref = watchDocRef(uid);
      const snap = await tx.get(ref);
      const cloud = snap.exists() ? parseCloud(snap.data()) : { items: [], removed: {} };
      const merged = mergeWatchState(local, cloud);
      const payload = {
        items: merged.items,
        removed: merged.removed || {},
        updatedAt: new Date().toISOString(),
      };
      tx.set(ref, payload, { merge: true });
      writeLocalState({ ...merged, updatedAt: payload.updatedAt }, payload.updatedAt);
    });
    lastCloudOkAt = new Date().toISOString();
    lastCloudError = null;
    setSyncStatus(null);
    return { ok: true };
  } catch (e: any) {
    const err = friendlyCloudError(e);
    setSyncStatus(err);
    return { ok: false, error: err };
  }
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
  const unsub = onSnapshot(
    watchDocRef(uid),
    (snap) => {
      if (stopped || snap.metadata.hasPendingWrites) return;
      if (snap.exists()) {
        setBotLeaseFromCloud((snap.data() as any)?.botLease);
        ingestCloud(parseCloud(snap.data()));
      } else if (loadWatchlist().length > 0) {
        schedulePush(0);
      }
      setSyncStatus(null);
    },
    (err) => {
      setSyncStatus('Live sync paused: ' + friendlyCloudError(err));
    }
  );
  return () => {
    stopped = true;
    liveUid = null;
    unsub();
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
  entry: Omit<WatchEntry, 'addedAt' | 'status' | 'lastCost'> & { lastCost?: number; status?: WatchStatus }
): WatchEntry[] {
  const list = loadWatchlist();
  const id = String(entry.playerId);
  const now = new Date().toISOString();
  const next = list.filter((w) => w.playerId !== id);
  next.unshift({
    ...entry,
    playerId: id,
    addedAt: now,
    status: entry.status || 'listed',
    lastCost: entry.lastCost ?? entry.lastCurrentBid ?? entry.lastAskingPrice ?? 0,
    updatedAt: now,
  } as WatchEntry);
  saveWatchlist(next);
  return loadWatchlist();
}

export function removeFromWatchlist(playerId: string): WatchEntry[] {
  const id = String(playerId);
  const list = loadWatchlist().filter((w) => w.playerId !== id);
  const removed = readJson<Tombstones>(REMOVED_KEY, {});
  removed[id] = new Date().toISOString();
  writeJson(REMOVED_KEY, removed);
  saveWatchlist(list);
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

export function hoursSinceLastScan(): number {
  const meta = getLastTransferScan();
  if (!meta?.at) return 999;
  const t = Date.parse(meta.at);
  if (!Number.isFinite(t)) return 999;
  return (Date.now() - t) / 3600000;
}

export function shouldAutoScanTransfers(maxHours = 12): boolean {
  return hoursSinceLastScan() >= maxHours;
}

export function loadAlerts(): TransferAlert[] {
  const list = readJson<TransferAlert[]>(ALERTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function unreadAlertCount(): number {
  return loadAlerts().filter((a) => !a.read).length;
}

export function markAlertsRead(): TransferAlert[] {
  const next = loadAlerts().map((a) => ({ ...a, read: true }));
  writeJson(ALERTS_KEY, next);
  return next;
}

export function computeBidHint(
  currentBid?: number | null,
  maxBid?: number | null
): BidHint {
  const cur = Number(currentBid) || 0;
  const max = Number(maxBid) || 0;
  if (!max) return 'unknown';
  if (cur > max) return 'over';
  if (cur === max) return 'at';
  return 'under';
}

export function addRecommendationToWatchlist(rec: any, reason?: string): WatchEntry[] {
  if (!rec?.playerId && !rec?.id) return loadWatchlist();
  return addToWatchlist({
    playerId: String(rec.playerId || rec.id),
    name: rec.name || `Player #${rec.playerId || rec.id}`,
    reason: reason || rec.reason || 'From transfer scan',
    playerUrl: rec.playerUrl || rec.url,
    lastAskingPrice: rec.askingPrice || rec.price,
    lastCurrentBid: rec.currentBid,
    lastDeadline: rec.deadline,
    age: rec.age,
    wage: rec.wage,
    role: rec.role,
    skills: rec.skills,
  });
}

export function refreshWatchlistFromListings(_listings?: any[]): WatchEntry[] {
  return loadWatchlist();
}

export function getWatchlistMonitorSummary(_cash?: number) {
  const list = loadWatchlist();
  const active = list.filter((w) => w.status !== 'sold');
  const bots = active.filter((w) => w.botEnabled);
  const overMax = bots.filter((w) => {
    const cur = w.lastCurrentBid || 0;
    const max = w.maxBid || 0;
    return max > 0 && cur > max;
  });
  return {
    total: list.length,
    active: active.length,
    botsArmed: bots.length,
    overMax: overMax.length,
    staleHours: hoursSinceLastScan(),
    unreadAlerts: unreadAlertCount(),
    topLines: [] as string[],
  };
}
