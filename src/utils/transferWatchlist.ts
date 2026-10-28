/** Transfer watchlist + cloud mirror (users/{uid}/settings/transferWatch). */
export {
  DEADLINE_TZ,
  parseDeadlineGmtMs,
  parseDeadlineSydneyMs,
  getDeadlineCountdown,
  hoursUntilDeadline,
} from './auctionDeadline';

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

export type TransferAlert = {
  id: string;
  at: string;
  message: string;
  playerId?: string;
  read?: boolean;
};

const WL_KEY = 'bt_transfer_watchlist';
const REMOVED_KEY = 'bt_transfer_watchlist_removed';
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
function notify() {
  try {
    window.dispatchEvent(new Event(WATCH_CHANGED_EVENT));
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
        map.set(id, { ...w, playerId: id });
        continue;
      }
      const prevT = Date.parse(prev.updatedAt || prev.addedAt || '') || 0;
      const nextT = Date.parse(w.updatedAt || w.addedAt || '') || 0;
      const base = nextT >= prevT ? { ...prev, ...w } : { ...w, ...prev };
      map.set(id, {
        ...base,
        playerId: id,
        skills: base.skills || prev.skills || w.skills,
        buyFit: base.buyFit || prev.buyFit || w.buyFit,
      });
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
  notify();
}

export async function hydrateWatchlistFromCloud(): Promise<WatchEntry[]> {
  return loadWatchlist();
}

export function applyIncomingCloudWatchlist(cloudItems: WatchEntry[]): WatchEntry[] {
  const merged = mergeWatchEntries(loadWatchlist(), cloudItems || []);
  writeJson(WL_KEY, merged);
  notify();
  return merged;
}

export function getWatchCloudStatus(): { mode: string; message?: string } {
  return { mode: 'local' };
}

export function addToWatchlist(
  entry: Omit<WatchEntry, 'addedAt' | 'status' | 'lastCost'> & { lastCost?: number; status?: WatchStatus }
): WatchEntry[] {
  const list = loadWatchlist();
  if (list.some((w) => w.playerId === String(entry.playerId))) return list;
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

export function loadAlerts(): TransferAlert[] {
  const list = readJson<TransferAlert[]>(ALERTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function markAlertsRead(): TransferAlert[] {
  const next = loadAlerts().map((a) => ({ ...a, read: true }));
  writeJson(ALERTS_KEY, next);
  return next;
}

export function addTransferAlert(message: string, playerId?: string) {
  const alerts = loadAlerts();
  alerts.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    message,
    playerId,
    read: false,
  });
  writeJson(ALERTS_KEY, alerts.slice(0, 40));
}

function unreadAlertCount(): number {
  return loadAlerts().filter((a) => !a.read).length;
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

function hoursSinceLastScan(): number {
  const meta = getLastTransferScan();
  if (!meta?.at) return 999;
  const t = Date.parse(meta.at);
  if (!Number.isFinite(t)) return 999;
  return (Date.now() - t) / 3600000;
}

export function shouldAutoScanTransfers(maxHours = 12): boolean {
  return hoursSinceLastScan() >= maxHours;
}

/** Optional cash arg used by Manager desk monitor for affordability lines. */
export function getWatchlistMonitorSummary(_cash?: number) {
  const list = loadWatchlist();
  const active = list.filter((w) => w.status !== 'sold');
  const bots = active.filter((w) => w.botEnabled);
  const overMax = bots.filter((w) => {
    const cur = w.lastCurrentBid || 0;
    const max = w.maxBid || 0;
    return max > 0 && cur > max;
  });
  const topLines: string[] = [];
  for (const w of overMax.slice(0, 3)) {
    topLines.push(
      `${w.name}: bid £${(w.lastCurrentBid || 0).toLocaleString()} over max £${(w.maxBid || 0).toLocaleString()}`
    );
  }
  for (const w of bots.filter((x) => x.botStatus === 'leading').slice(0, 2)) {
    topLines.push(`${w.name}: leading`);
  }
  return {
    total: list.length,
    active: active.length,
    botsArmed: bots.length,
    overMax: overMax.length,
    staleHours: hoursSinceLastScan(),
    unreadAlerts: unreadAlertCount(),
    topLines,
  };
}

export function refreshWatchlistFromListings(_listings?: any[]): WatchEntry[] {
  return loadWatchlist();
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

export function startWatchlistLiveSync(_uid?: string): () => void {
  return () => {};
}
