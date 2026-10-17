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
    // local is source of truth if cloud fails
  }
}

export async function hydrateWatchlistFromCloud(): Promise<WatchEntry[]> {
  const local = loadWatchlist();
  const user = getCustomUser();
  if (!user?.uid) return local;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'settings', 'transferWatch'));
    if (!snap.exists()) {
      if (local.length) await mirrorWatchlistToCloud(local);
      return local;
    }
    const items = (snap.data()?.items || []) as WatchEntry[];
    if (!Array.isArray(items) || !items.length) return local;
    const map = new Map<string, WatchEntry>();
    for (const e of local) map.set(e.playerId, e);
    for (const e of items) map.set(e.playerId, e);
    const merged = [...map.values()];
    writeJson(WL_KEY, merged);
    return merged;
  } catch {
    return local;
  }
}

export function isWatched(playerId: string): boolean {
  return loadWatchlist().some((w) => w.playerId === playerId);
}

export function addToWatchlist(
  listing: TransferListing,
  opts: {
    reason: string;
    fitsNeed?: string;
    ratingKey?: TeamRatingKey;
    cost?: number;
    cash?: number;
  }
): WatchEntry[] {
  const list = loadWatchlist().filter((w) => w.playerId !== listing.playerId);
  const cost = opts.cost ?? listing.currentBid ?? listing.askingPrice ?? 0;
  const hint = computeBidHint(listing, cost, opts.cash);
  const entry: WatchEntry = {
    playerId: listing.playerId,
    name: listing.name,
    addedAt: new Date().toISOString(),
    reason: opts.reason || 'Watched from transfer shortlist',
    fitsNeed: opts.fitsNeed,
    ratingKey: opts.ratingKey,
    lastAskingPrice: listing.askingPrice,
    lastCurrentBid: listing.currentBid,
    lastCost: cost,
    lastDeadline: listing.deadline,
    lastSeenAt: new Date().toISOString(),
    status: 'listed',
    playerUrl: listing.playerUrl,
    age: listing.age,
    skills: listing.skills,
    bidHint: hint.hint,
    bidHintText: hint.text,
    acknowledged: false,
  };
  list.unshift(entry);
  saveWatchlist(list.slice(0, 50));
  return loadWatchlist();
}

export function addRecommendationToWatchlist(
  rec: BuyRecommendation,
  cash?: number
): WatchEntry[] {
  return addToWatchlist(rec.listing, {
    reason: (rec.reasons || []).slice(0, 2).join(' · ') || 'Shortlist fit',
    fitsNeed: rec.fitsNeed,
    cost: rec.cost,
    cash,
  });
}

export function removeFromWatchlist(playerId: string): WatchEntry[] {
  saveWatchlist(loadWatchlist().filter((w) => w.playerId !== playerId));
  return loadWatchlist();
}

export function acknowledgeWatch(playerId: string): WatchEntry[] {
  const list = loadWatchlist().map((w) =>
    w.playerId === playerId ? { ...w, acknowledged: true, nowAffordable: false } : w
  );
  saveWatchlist(list);
  return list;
}

export function recordTransferScan(meta: TransferScanMeta) {
  writeJson(SCAN_META_KEY, meta);
}

export function getLastTransferScan(): TransferScanMeta | null {
  return readJson<TransferScanMeta | null>(SCAN_META_KEY, null);
}

export function hoursSinceLastScan(): number | null {
  const m = getLastTransferScan();
  if (!m?.at) return null;
  const t = Date.parse(m.at);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

export function loadAlerts(): TransferAlert[] {
  const a = readJson<TransferAlert[]>(ALERTS_KEY, []);
  return Array.isArray(a) ? a : [];
}

export function saveAlerts(alerts: TransferAlert[]) {
  writeJson(ALERTS_KEY, alerts.slice(0, 40));
  try {
    window.dispatchEvent(new Event('bt_transfer_alerts_changed'));
  } catch {}
}

export function pushAlert(alert: Omit<TransferAlert, 'id' | 'at'> & { id?: string; at?: string }) {
  const full: TransferAlert = {
    id: alert.id || `ta_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: alert.at || new Date().toISOString(),
    playerId: alert.playerId,
    name: alert.name,
    message: alert.message,
    kind: alert.kind,
    read: false,
  };
  const next = [full, ...loadAlerts().filter((a) => a.playerId !== full.playerId || a.kind !== full.kind)];
  saveAlerts(next);
  return full;
}

export function markAlertsRead() {
  saveAlerts(loadAlerts().map((a) => ({ ...a, read: true })));
}

export function unreadAlertCount(): number {
  return loadAlerts().filter((a) => !a.read).length;
}

/**
 * Battrick prints deadlines in its server time, which tracks UK time (the page's own
 * server clock matches Europe/London, BST in summer). Interpreting them as the browser's
 * local time makes "ends in Xh" wrong for anyone outside the UK, so convert explicitly.
 */
function lastSundayUtc(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month + 1, 0, 1, 0)); // last day of month, 01:00 UTC
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.getTime();
}

function londonToDate(y: number, mo: number, d: number, hh: number, mm: number): Date {
  const asUtc = Date.UTC(y, mo, d, hh, mm);
  const bst = asUtc >= lastSundayUtc(y, 2) && asUtc < lastSundayUtc(y, 9);
  return new Date(asUtc - (bst ? 3_600_000 : 0));
}

export function parseDeadline(deadline?: string): Date | null {
  if (!deadline) return null;
  const s = deadline.trim();
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    const hh = m[4] ? Number(m[4]) : 12;
    const mm = m[5] ? Number(m[5]) : 0;
    const d = londonToDate(year, month, day, hh, mm);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

export function hoursUntilDeadline(deadline?: string): number | null {
  const d = parseDeadline(deadline);
  if (!d) return null;
  return (d.getTime() - Date.now()) / 3_600_000;
}

export function computeBidHint(
  listing: Pick<TransferListing, 'deadline' | 'askingPrice' | 'currentBid'>,
  cost: number,
  cash?: number
): { hint: BidHint; text: string } {
  const hoursLeft = hoursUntilDeadline(listing.deadline);
  const hasCash = cash != null && Number.isFinite(cash);
  const affordable = hasCash ? cost <= 0 || cash! >= cost * 0.9 : true;

  if (hoursLeft != null && hoursLeft >= 0 && hoursLeft <= 12) {
    if (affordable) {
      return {
        hint: 'ending_soon',
        text: `Ends in ~${Math.max(1, Math.round(hoursLeft))}h — bid soon if you want him`,
      };
    }
    return {
      hint: 'over_budget',
      text: `Ends in ~${Math.max(1, Math.round(hoursLeft))}h but over budget`,
    };
  }

  if (hasCash && cost > 0 && cash! < cost) {
    const short = cost - cash!;
    return {
      hint: 'wait_cash',
      text: `Need ~£${Math.round(short).toLocaleString()} more — watch and raise cash`,
    };
  }

  if (hasCash && cost > 0 && cash! >= cost * 1.15) {
    return {
      hint: 'bid_now',
      text: 'Comfortably in budget — strong candidate to bid',
    };
  }

  if (affordable && cost > 0) {
    return {
      hint: 'consider',
      text: 'In range of your cash — review vs XI needs then bid',
    };
  }

  return {
    hint: 'monitor',
    text: 'On your watchlist — refresh scan to update price / deadline',
  };
}

export function refreshWatchlistFromListings(
  listings: TransferListing[],
  opts?: { cash?: number }
): { watchlist: WatchEntry[]; alerts: TransferAlert[] } {
  const byId = new Map(listings.map((l) => [l.playerId, l]));
  const byName = new Map(listings.map((l) => [l.name.trim().toLowerCase(), l]));
  const newAlerts: TransferAlert[] = [];
  const cash = opts?.cash;

  const updated = loadWatchlist().map((w) => {
    const hit = byId.get(w.playerId) || byName.get(w.name.trim().toLowerCase()) || null;

    if (!hit) {
      if (w.status === 'listed') {
        const a = pushAlert({
          playerId: w.playerId,
          name: w.name,
          kind: 'sold',
          message: `${w.name} no longer on the transfer list (sold or expired).`,
        });
        newAlerts.push(a);
      }
      return { ...w, status: 'sold' as WatchStatus, lastSeenAt: new Date().toISOString() };
    }

    const cost = hit.currentBid || hit.askingPrice || w.lastCost || 0;
    const prevCost = w.lastCost || 0;
    const hint = computeBidHint(hit, cost, cash);
    const wasUnaffordable = cash != null && prevCost > 0 && cash < prevCost * 0.9;
    const nowOk = cash != null && (cost <= 0 || cash >= cost * 0.9);
    const becameAffordable = Boolean(wasUnaffordable && nowOk);

    if (becameAffordable) {
      newAlerts.push(
        pushAlert({
          playerId: w.playerId,
          name: w.name,
          kind: 'affordable',
          message: `${w.name} is now within ~your cash (≈£${cost.toLocaleString()}).`,
        })
      );
    } else if (hint.hint === 'ending_soon') {
      newAlerts.push(
        pushAlert({
          playerId: w.playerId,
          name: w.name,
          kind: 'ending_soon',
          message: `${w.name}: ${hint.text}`,
        })
      );
    } else if (prevCost > 0 && cost > 0 && cost < prevCost * 0.85) {
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
            {
              deadline: w.lastDeadline,
              askingPrice: w.lastAskingPrice,
              currentBid: w.lastCurrentBid,
            },
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

export function shouldAutoScanTransfers(maxAgeHours = 6): boolean {
  const h = hoursSinceLastScan();
  if (h == null) return true;
  return h >= maxAgeHours;
}
