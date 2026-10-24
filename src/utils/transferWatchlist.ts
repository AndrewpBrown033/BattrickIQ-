/**
 * Transfer market watchlist + bid timing + light monitor.
 * Persists in localStorage; Firestore mirror under users/{uid}/settings/transferWatch
 * so the watch list is shared across devices (last-write-wins).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  /** ISO time of last edit — cross-device last-write-wins */
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
  } catch {
    // ignore
  }
}

/** Hours until a Battrick deadline string (dd/mm/yyyy HH:mm). Null if unparseable. */
export function hoursUntilDeadline(deadline?: string | null): number | null {
  if (!deadline) return null;
  const m = String(deadline).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const dt = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
  if (Number.isNaN(dt.getTime())) return null;
  return (dt.getTime() - Date.now()) / 3600000;
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

/** Stamp entries and persist locally + mirror to Firestore for cross-device sharing. */
export function saveWatchlist(list: WatchEntry[]) {
  const now = new Date().toISOString();
  const stamped = (Array.isArray(list) ? list : []).map((w) => ({
    ...w,
    updatedAt: w.updatedAt || now,
  }));
  writeJson(WL_KEY, stamped);
  setLocalWatchMeta(now);
  try {
    window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
  } catch {
    // ignore
  }
  void mirrorWatchlistToCloud(stamped, now);
}

async function mirrorWatchlistToCloud(list: WatchEntry[], updatedAt: string) {
  const user = getCustomUser();
  if (!user?.uid) return;
  try {
    await setDoc(
      doc(db, 'users', user.uid, 'settings', 'transferWatch'),
      { items: list, updatedAt },
      { merge: true }
    );
  } catch {
    // offline / rules — local still works
  }
}

/**
 * Pull cloud watchlist and apply last-write-wins vs local.
 * Call on login and when the Watch page opens so phones/tablets share one list.
 */
export async function hydrateWatchlistFromCloud(): Promise<WatchEntry[]> {
  const local = loadWatchlist();
  const localMeta = getLocalWatchMeta();
  const user = getCustomUser();
  if (!user?.uid) return local;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'transferWatch'));
    if (!snap.exists()) {
      if (local.length > 0) {
        const at = localMeta.updatedAt || new Date().toISOString();
        await mirrorWatchlistToCloud(local, at);
      }
      return local;
    }

    const data = snap.data() as { items?: WatchEntry[]; updatedAt?: string };
    const cloudItems = Array.isArray(data.items) ? data.items.filter((w) => w?.playerId) : [];
    const cloudAt = typeof data.updatedAt === 'string' ? data.updatedAt : '';
    const localAt = localMeta.updatedAt || '';

    if (cloudAt && (!localAt || cloudAt >= localAt)) {
      writeJson(WL_KEY, cloudItems);
      setLocalWatchMeta(cloudAt);
      try {
        window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
      } catch {
        // ignore
      }
      return cloudItems;
    }

    if (local.length > 0 && localAt && (!cloudAt || localAt > cloudAt)) {
      await mirrorWatchlistToCloud(local, localAt);
    }

    if (!cloudItems.length) return local;

    const byId = new Map<string, WatchEntry>();
    for (const w of cloudItems) byId.set(String(w.playerId), w);
    for (const w of local) {
      const id = String(w.playerId);
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, w);
        continue;
      }
      const prevT = prev.updatedAt || prev.lastSeenAt || prev.addedAt || '';
      const curT = w.updatedAt || w.lastSeenAt || w.addedAt || '';
      byId.set(id, curT >= prevT ? { ...prev, ...w } : { ...w, ...prev });
    }
    const merged = Array.from(byId.values());
    const now = new Date().toISOString();
    writeJson(WL_KEY, merged);
    setLocalWatchMeta(now);
    try {
      window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
    } catch {
      // ignore
    }
    void mirrorWatchlistToCloud(merged, now);
    return merged;
  } catch {
    return local;
  }
}

/** Force pull from cloud (Watch page Sync button). */
export async function syncWatchlistFromCloud(): Promise<{
  list: WatchEntry[];
  source: 'cloud' | 'local';
  error?: string;
}> {
  const user = getCustomUser();
  if (!user?.uid) {
    return {
      list: loadWatchlist(),
      source: 'local',
      error: 'Sign in to BattrickIQ to sync watch across devices',
    };
  }
  try {
    const list = await hydrateWatchlistFromCloud();
    return { list, source: 'cloud' };
  } catch (e: any) {
    return { list: loadWatchlist(), source: 'local', error: e?.message || 'Cloud sync failed' };
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

export function refreshWatchlistFromListings(
  listings: TransferListing[],
  cash?: number
): { watchlist: WatchEntry[]; alerts: TransferAlert[] } {
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
      expectedBid: undefined,
    };
  });
  saveWatchlist(updated);
  return { watchlist: updated, alerts: newAlerts };
}

export function getWatchlistMonitorSummary(cash?: number): {
  watched: number;
  listed: number;
  sold: number;
  actionable: number;
  endingSoon: number;
  lastScanAt: string | null;
  staleHours: number | null;
  unreadAlerts: number;
  topLines: string[];
} {
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
