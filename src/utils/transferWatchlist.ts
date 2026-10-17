/**
 * Transfer market watchlist + bid timing + light monitor.
 * Persists in localStorage; optional Firestore mirror under users/{uid}/settings/transferWatch.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';
import type { TransferListing, BuyRecommendation, TeamRatingKey } from './transferList';

const WL_KEY = 'bt_transfer_watchlist';
const SCAN_META_KEY = 'bt_transfer_last_scan';
const ALERTS_KEY = 'bt_transfer_alerts';

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
  /** Bot bidder */
  botEnabled?: boolean;
  maxBid?: number;
  /** Next expected bid value (Battrick bidValue) */
  expectedBid?: number;
  lastBotCheckAt?: string;
  lastBotAction?: string;
  botStatus?: 'idle' | 'armed' | 'bidding' | 'leading' | 'maxed' | 'error' | 'sold';
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

export function loadWatchlist(): WatchEntry[] {
  const list = readJson<WatchEntry[]>(WL_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveWatchlist(list: WatchEntry[]) {
  writeJson(WL_KEY, list);
  try {
    window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
  } catch {}
  void mirrorWatchlistToCloud(list);
}

async function mirrorWatchlistToCloud(list: WatchEntry[]) {
  const user = getCustomUser();
  if (!user?.uid) return;
  try {
    await setDoc(
      doc(db, 'users', user.uid, 'settings', 'transferWatch'),
      { items: list, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch {
    // ignore offline / rules
  }
}

export async function hydrateWatchlistFromCloud(): Promise<WatchEntry[]> {
  const local = loadWatchlist();
  const user = getCustomUser();
  if (!user?.uid) return local;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'transferWatch'));
    if (!snap.exists()) return local;
    const items = (snap.data() as any)?.items;
    if (!Array.isArray(items) || !items.length) return local;
    const byId = new Map<string, WatchEntry>();
    for (const w of local) byId.set(String(w.playerId), w);
    for (const w of items as WatchEntry[]) {
      if (!w?.playerId) continue;
      const id = String(w.playerId);
      const prev = byId.get(id);
      byId.set(id, prev ? { ...w, ...prev, botEnabled: prev.botEnabled ?? w.botEnabled, maxBid: prev.maxBid ?? w.maxBid } : w);
    }
    const merged = Array.from(byId.values());
    saveWatchlist(merged);
    return merged;
  } catch {
    return local;
  }
}

export function addToWatchlist(entry: Omit<WatchEntry, 'addedAt' | 'status' | 'lastCost'> & { lastCost?: number }): WatchEntry[] {
  const list = loadWatchlist();
  const id = String(entry.playerId);
  const next = list.filter((w) => w.playerId !== id);
  next.unshift({
    ...entry,
    playerId: id,
    addedAt: new Date().toISOString(),
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
    w.playerId === String(playerId) ? { ...w, acknowledged: true } : w
  );
  saveWatchlist(next);
  return next;
}

export function recordTransferScan(listingCount: number, shortlistCount: number) {
  writeJson(SCAN_META_KEY, {
    at: new Date().toISOString(),
    listingCount,
    shortlistCount,
  } satisfies TransferScanMeta);
}

export function getLastTransferScan(): TransferScanMeta | null {
  return readJson<TransferScanMeta | null>(SCAN_META_KEY, null);
}

export function hoursSinceLastScan(): number | null {
  const meta = getLastTransferScan();
  if (!meta?.at) return null;
  return (Date.now() - new Date(meta.at).getTime()) / 3600000;
}

export function pushAlert(partial: Omit<TransferAlert, 'id' | 'at'> & { id?: string; at?: string }) {
  const alerts = readJson<TransferAlert[]>(ALERTS_KEY, []);
  const alert: TransferAlert = {
    id: partial.id || `${partial.playerId}-${Date.now()}`,
    at: partial.at || new Date().toISOString(),
    playerId: partial.playerId,
    name: partial.name,
    message: partial.message,
    kind: partial.kind,
    read: false,
  };
  alerts.unshift(alert);
  writeJson(ALERTS_KEY, alerts.slice(0, 50));
  return alert;
}

export function loadAlerts(): TransferAlert[] {
  return readJson<TransferAlert[]>(ALERTS_KEY, []);
}

export function unreadAlertCount(): number {
  return loadAlerts().filter((a) => !a.read).length;
}

export function markAlertsRead() {
  const alerts = loadAlerts().map((a) => ({ ...a, read: true }));
  writeJson(ALERTS_KEY, alerts);
}

export function computeBidHint(
  listing: { deadline?: string; askingPrice?: number; currentBid?: number },
  cost: number,
  cash?: number
): { hint: BidHint; text: string } {
  const deadline = listing.deadline || '';
  let endingSoon = false;
  if (deadline) {
    const m = deadline.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (m) {
      const dt = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
      const hrs = (dt.getTime() - Date.now()) / 3600000;
      if (hrs >= 0 && hrs <= 6) endingSoon = true;
    }
  }
  if (cash != null && cost > cash) {
    return { hint: 'over_budget', text: `Needs £${cost.toLocaleString()} — above cash` };
  }
  if (cash != null && cost > cash * 0.85) {
    return { hint: 'wait_cash', text: 'Affordable but tight on cash' };
  }
  if (endingSoon) {
    return { hint: 'ending_soon', text: 'Deadline within ~6 hours' };
  }
  if (cash != null && cost <= cash) {
    return { hint: 'consider', text: 'Within budget — consider a bid' };
  }
  return { hint: 'monitor', text: 'On watch — monitor price' };
}

export function addRecommendationToWatchlist(rec: BuyRecommendation, reason?: string): WatchEntry[] {
  const l = rec.listing;
  return addToWatchlist({
    playerId: l.playerId,
    name: l.name,
    reason: reason || rec.reasons?.[0] || 'Shortlist',
    fitsNeed: rec.fitsNeed,
    lastAskingPrice: l.askingPrice,
    lastCurrentBid: l.currentBid,
    lastCost: rec.cost || l.currentBid || l.askingPrice || 0,
    lastDeadline: l.deadline,
    playerUrl: l.playerUrl,
    age: l.age,
    skills: l.skills,
  });
}

export function refreshWatchlistFromListings(
  listings: TransferListing[],
  opts?: { cash?: number }
): { watchlist: WatchEntry[]; alerts: TransferAlert[] } {
  const byId = new Map(listings.map((l) => [String(l.playerId), l]));
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
            message: `${w.name} no longer on the scanned list (sold or expired?).`,
          })
        );
        return { ...w, status: 'sold' as WatchStatus, botEnabled: false, botStatus: 'sold' as const };
      }
      return w;
    }
    const cost = hit.currentBid || hit.askingPrice || w.lastCost || 0;
    const prevCost = w.lastCost || 0;
    const hint = computeBidHint(hit, cost, opts?.cash);
    const becameAffordable =
      opts?.cash != null && prevCost > opts.cash && cost <= opts.cash;
    if (becameAffordable) {
      newAlerts.push(
        pushAlert({
          playerId: w.playerId,
          name: w.name,
          kind: 'affordable',
          message: `${w.name} now within cash at £${cost.toLocaleString()}.`,
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
    if (hint.hint === 'bid_now' || hint.hint === 'consider' || hint.hint === 'ending_soon' || w.nowAffordable) {
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

export function shouldAutoScanTransfers(maxAgeHours = 6): boolean {
  const h = hoursSinceLastScan();
  if (h == null) return true;
  return h >= maxAgeHours;
}
