/** Transfer watchlist + re-export auction deadline helpers (GMT → Sydney countdown). */
export {
  DEADLINE_TZ,
  parseDeadlineGmtMs,
  parseDeadlineSydneyMs,
  hoursUntilDeadline,
  getDeadlineCountdown,
} from './auctionDeadline';

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
}

const WL_KEY = 'bt_transfer_watchlist';

export function loadWatchlist(): WatchEntry[] {
  try {
    const raw = localStorage.getItem(WL_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(list: WatchEntry[]) {
  try {
    const now = new Date().toISOString();
    const stamped = (list || []).map((w) => ({
      ...w,
      playerId: String(w.playerId),
      updatedAt: w.updatedAt || now,
    }));
    localStorage.setItem(WL_KEY, JSON.stringify(stamped));
    window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
  } catch {}
}

export async function hydrateWatchlistFromCloud(): Promise<WatchEntry[]> {
  return loadWatchlist();
}

export async function syncWatchlistFromCloud(): Promise<{
  list: WatchEntry[];
  source: 'cloud' | 'local';
  error?: string;
}> {
  return {
    list: loadWatchlist(),
    source: 'local',
    error: undefined,
  };
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
  const next = loadWatchlist().map((w) =>
    w.playerId === String(playerId) ? { ...w, acknowledged: true, updatedAt: new Date().toISOString() } : w
  );
  saveWatchlist(next);
  return next;
}

export function getWatchCloudStatus() {
  return {
    signedIn: false,
    firebaseSession: false,
    lastError: null as string | null,
    lastOkAt: null as string | null,
    uid: null as string | null,
  };
}

export function getWatchlistMonitorSummary() {
  const list = loadWatchlist();
  return {
    watched: list.length,
    listed: list.filter((w) => w.status === 'listed').length,
    sold: list.filter((w) => w.status === 'sold').length,
    actionable: 0,
    endingSoon: 0,
    lastScanAt: null as string | null,
    staleHours: null as number | null,
    unreadAlerts: 0,
    topLines: [] as string[],
  };
}

export function loadAlerts() {
  return [] as any[];
}
export function markAlertsRead() {}
export function unreadAlertCount() {
  return 0;
}
export function mergeWatchEntries(a: WatchEntry[], b: WatchEntry[]) {
  const m = new Map<string, WatchEntry>();
  for (const x of [...(a || []), ...(b || [])]) {
    if (x?.playerId) m.set(String(x.playerId), { ...x, playerId: String(x.playerId) });
  }
  return Array.from(m.values());
}
export function applyIncomingCloudWatchlist(items: WatchEntry[]) {
  saveWatchlist(mergeWatchEntries(loadWatchlist(), items || []));
  return loadWatchlist();
}
export function recordTransferScan() {}
export function getLastTransferScan() {
  return null;
}
export function hoursSinceLastScan() {
  return null;
}
export function shouldAutoScanTransfers() {
  return true;
}
export function computeBidHint() {
  return { hint: 'monitor' as BidHint, text: 'On watch' };
}
export function addRecommendationToWatchlist() {
  return loadWatchlist();
}
export function refreshWatchlistFromListings() {
  return { watchlist: loadWatchlist(), alerts: [] as any[] };
}
