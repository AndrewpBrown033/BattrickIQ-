/** Transfer watchlist — local + Firestore sync */

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
  /** Last scout buy-fit verdict vs your squad (salary, plan, affordability) */
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

function notifyWatchChanged() {
  try {
    window.dispatchEvent(new Event(WATCH_CHANGED_EVENT));
  } catch {}
}

export type WatchState = {
  items: WatchEntry[];
  removed: Record<string, string>;
};

export type WatchCloudStatus = {
  mode: 'local' | 'cloud' | 'syncing' | 'error';
  message?: string;
};

let cloudStatus: WatchCloudStatus = { mode: 'local' };

export function getWatchCloudStatus(): WatchCloudStatus {
  return cloudStatus;
}

function setCloudStatus(next: WatchCloudStatus) {
  cloudStatus = next;
  try {
    window.dispatchEvent(new CustomEvent(WATCH_SYNC_EVENT, { detail: next }));
  } catch {}
}

export function mergeWatchEntries(a: WatchEntry[], b: WatchEntry[]): WatchEntry[] {
  const map = new Map<string, WatchEntry>();
  for (const list of [a, b]) {
    for (const w of list) {
      if (!w?.playerId) continue;
      const id = String(w.playerId);
      const prev = map.get(id);
      if (!prev) {
        map.set(id, w);
        continue;
      }
      const prevT = Date.parse(prev.updatedAt || prev.addedAt || '') || 0;
      const nextT = Date.parse(w.updatedAt || w.addedAt || '') || 0;
      map.set(id, nextT >= prevT ? { ...prev, ...w } : { ...w, ...prev });
    }
  }
  return Array.from(map.values());
}

export function loadWatchlist(): WatchEntry[] {
  const list = readJson<WatchEntry[]>(WL_KEY, []);
  return Array.isArray(list) ? list.filter((w) => w && w.playerId) : [];
}

export function saveWatchlist(list: WatchEntry[]) {
  writeJson(WL_KEY, list);
  notifyWatchChanged();
  void mirrorWatchlistToCloud(list);
}

async function mirrorWatchlistToCloud(_list: WatchEntry[]) {
  // soft no-op if cloud helper not present; full cloud path lives in other modules
  try {
    setCloudStatus({ mode: 'local' });
  } catch {}
}

export async function hydrateWatchlistFromCloud(): Promise<WatchEntry[]> {
  return loadWatchlist();
}

export function applyIncomingCloudWatchlist(cloudItems: WatchEntry[]): WatchEntry[] {
  const merged = mergeWatchEntries(loadWatchlist(), cloudItems || []);
  writeJson(WL_KEY, merged);
  notifyWatchChanged();
  return merged;
}

export function addToWatchlist(
  entry: Omit<WatchEntry, 'addedAt' | 'status' | 'lastCost'> & { lastCost?: number }
): WatchEntry[] {
  const list = loadWatchlist();
  if (list.some((w) => w.playerId === String(entry.playerId))) {
    return list;
  }
  const next: WatchEntry[] = [
    {
      ...entry,
      playerId: String(entry.playerId),
      addedAt: new Date().toISOString(),
      status: entry.status || 'listed',
      lastCost: entry.lastCost ?? entry.lastCurrentBid ?? entry.lastAskingPrice ?? 0,
      updatedAt: new Date().toISOString(),
    } as WatchEntry,
    ...list,
  ];
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

export function addTransferAlert(message: string) {
  const alerts = readJson<{ at: string; message: string }[]>(ALERTS_KEY, []);
  alerts.unshift({ at: new Date().toISOString(), message });
  writeJson(ALERTS_KEY, alerts.slice(0, 30));
}

export function getTransferAlerts(): { at: string; message: string }[] {
  return readJson(ALERTS_KEY, []);
}

// Re-export deadline helpers from auctionDeadline when available
export {
  getDeadlineCountdown,
  parseDeadlineGmtMs,
} from './auctionDeadline';

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
