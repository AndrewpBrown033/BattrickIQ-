/** RESTORED - see auctionDeadline.ts for timers */
export {
  DEADLINE_TZ,
  parseDeadlineGmtMs,
  parseDeadlineSydneyMs,
  hoursUntilDeadline,
  getDeadlineCountdown,
} from './auctionDeadline';

// Minimal stub so imports resolve if full restore missing — full file follows in restore script
export function loadWatchlist(): any[] {
  try {
    const raw = localStorage.getItem('bt_transfer_watchlist');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export function saveWatchlist(list: any[]) {
  try {
    localStorage.setItem('bt_transfer_watchlist', JSON.stringify(list));
    window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
  } catch {}
}
export async function hydrateWatchlistFromCloud() {
  return loadWatchlist();
}
export async function syncWatchlistFromCloud() {
  return { list: loadWatchlist(), source: 'local' as const, error: 'Full watchlist restore required' };
}
export function addToWatchlist(entry: any) {
  const list = loadWatchlist().filter((w: any) => w.playerId !== String(entry.playerId));
  const now = new Date().toISOString();
  list.unshift({ ...entry, playerId: String(entry.playerId), addedAt: now, updatedAt: now, status: 'listed', lastCost: entry.lastCost || 0 });
  saveWatchlist(list);
  return list;
}
export function removeFromWatchlist(playerId: string) {
  const next = loadWatchlist().filter((w: any) => w.playerId !== String(playerId));
  saveWatchlist(next);
  return next;
}
export function acknowledgeWatch(playerId: string) {
  const next = loadWatchlist().map((w: any) =>
    w.playerId === String(playerId) ? { ...w, acknowledged: true } : w
  );
  saveWatchlist(next);
  return next;
}
export function getWatchCloudStatus() {
  return { signedIn: false, firebaseSession: false, lastError: 'stub', lastOkAt: null, uid: null };
}
export function getWatchlistMonitorSummary() {
  const list = loadWatchlist();
  return { watched: list.length, listed: list.length, sold: 0, actionable: 0, endingSoon: 0, lastScanAt: null, staleHours: null, unreadAlerts: 0, topLines: [] };
}
export function loadAlerts() { return []; }
export function markAlertsRead() {}
export function unreadAlertCount() { return 0; }
export function mergeWatchEntries(a: any[], b: any[]) {
  const m = new Map();
  for (const x of [...(a||[]), ...(b||[])]) if (x?.playerId) m.set(String(x.playerId), x);
  return [...m.values()];
}
export function applyIncomingCloudWatchlist(items: any[]) {
  saveWatchlist(mergeWatchEntries(loadWatchlist(), items||[]));
  return loadWatchlist();
}
export function recordTransferScan() {}
export function getLastTransferScan() { return null; }
export function hoursSinceLastScan() { return null; }
export function shouldAutoScanTransfers() { return true; }
export function computeBidHint() { return { hint: 'monitor', text: 'On watch' }; }
export function addRecommendationToWatchlist() { return loadWatchlist(); }
export function refreshWatchlistFromListings() { return { watchlist: loadWatchlist(), alerts: [] }; }
