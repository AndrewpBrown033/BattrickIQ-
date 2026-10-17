/**
 * Battrick transfer bid helpers + client bot runner.
 *
 * Bid rules (from playerdetails.asp verifyForm):
 * - at least asking price
 * - raise by at least £1,000 over current bid
 * - raise by at least 2% over current bid
 * Next expected bid = max(asking, current+1000, ceil(current*1.02))
 * Form: POST playerdetails.asp?playerID=…  fields: bidValue
 */

import {
  loadWatchlist,
  saveWatchlist,
  type WatchEntry,
} from './transferWatchlist';

export const BID_MIN_RAISE = 1000;
export const BID_MIN_PCT = 0.02;

/** Next bid Battrick will accept (matches the pre-filled bidValue on the player page). */
export function nextExpectedBid(currentBid?: number | null, askingPrice?: number | null): number {
  const ask = Math.max(0, Number(askingPrice) || 0);
  const cur = Math.max(0, Number(currentBid) || 0);
  if (cur <= 0) return Math.max(ask, BID_MIN_RAISE);
  const byThousand = cur + BID_MIN_RAISE;
  const byPct = Math.ceil(cur * (1 + BID_MIN_PCT));
  return Math.max(ask, byThousand, byPct);
}

export function parseTransferPanelFromHtml(html: string): {
  playerId?: string;
  name?: string;
  askingPrice?: number;
  currentBid?: number;
  bidderTeam?: string;
  deadline?: string;
  suggestedBid?: number;
  wagesMinContract?: number;
  isTransferListed: boolean;
} {
  if (!html) return { isTransferListed: false };
  const text = html
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#163;|&pound;/gi, '£')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  const playerId =
    (html.match(/playerID=(\d+)/i) || [])[1] ||
    (html.match(/makeBid[^>]+playerID=(\d+)/i) || [])[1];
  const name =
    (html.match(/<h2[^>]*>\s*([^(<]+)\s*\((\d+)\)/i) || [])[1]?.trim() ||
    (text.match(/([A-Za-z][A-Za-z .'-]{1,40})\s*\(\d{5,}\)/) || [])[1];

  const asking = parseMoney((text.match(/Asking\s*Price:\s*£?\s*([\d,]+)/i) || [])[1]);
  const current = parseMoney((text.match(/Current\s*Bid:\s*£?\s*([\d,]+)/i) || [])[1]);
  const bidder =
    (text.match(/Current\s*Bid:\s*£?[\d,]+\s*by\s+([A-Za-z0-9 .'-]{2,50})/i) || [])[1]?.trim();
  const deadline =
    (text.match(/Deadline:\s*(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})/i) || [])[1];
  const suggested = parseMoney(
    (html.match(/name=["']bidValue["'][^>]*value=["'](\d+)["']/i) ||
      html.match(/id=["']bidvalue["'][^>]*value=["'](\d+)["']/i) ||
      [])[1]
  );
  const wagesMin = parseMoney((text.match(/at least\s*£?\s*([\d,]+)/i) || [])[1]);

  const isTransferListed =
    /Transfer\s*Listed/i.test(html) ||
    /name=["']makeBid["']/i.test(html) ||
    /name=["']bidValue["']/i.test(html) ||
    asking != null;

  return {
    playerId,
    name,
    askingPrice: asking,
    currentBid: current,
    bidderTeam: bidder,
    deadline,
    suggestedBid: suggested ?? nextExpectedBid(current, asking),
    wagesMinContract: wagesMin,
    isTransferListed,
  };
}

function parseMoney(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

export type BotTickResult = {
  playerId: string;
  name: string;
  action: 'bid_placed' | 'already_leading' | 'at_max' | 'outbid_over_max' | 'not_listed' | 'skipped' | 'error';
  message: string;
  currentBid?: number;
  nextBid?: number;
  maxBid?: number;
};

export function enableBotBid(playerId: string, maxBid: number): WatchEntry[] {
  const list = loadWatchlist();
  const next = list.map((w) => {
    if (w.playerId !== String(playerId)) return w;
    return {
      ...w,
      botEnabled: true,
      maxBid: Math.max(BID_MIN_RAISE, Math.round(maxBid)),
      botStatus: 'armed' as const,
      lastBotAction: `Bot armed — max £${Math.round(maxBid).toLocaleString()}`,
      lastBotCheckAt: new Date().toISOString(),
    };
  });
  saveWatchlist(next);
  return next;
}

export function disableBotBid(playerId: string): WatchEntry[] {
  const list = loadWatchlist();
  const next = list.map((w) => {
    if (w.playerId !== String(playerId)) return w;
    return {
      ...w,
      botEnabled: false,
      botStatus: 'idle' as const,
      lastBotAction: 'Bot stopped',
      lastBotCheckAt: new Date().toISOString(),
    };
  });
  saveWatchlist(next);
  return next;
}

export function setMaxBid(playerId: string, maxBid: number): WatchEntry[] {
  const list = loadWatchlist();
  const next = list.map((w) => {
    if (w.playerId !== String(playerId)) return w;
    return {
      ...w,
      maxBid: Math.max(BID_MIN_RAISE, Math.round(maxBid)),
      lastBotAction: `Max bid set to £${Math.round(maxBid).toLocaleString()}`,
    };
  });
  saveWatchlist(next);
  return next;
}

export function updateWatchAfterBotTick(
  playerId: string,
  patch: Partial<WatchEntry> & { botStatus?: WatchEntry['botStatus'] }
): WatchEntry[] {
  const list = loadWatchlist();
  const next = list.map((w) => {
    if (w.playerId !== String(playerId)) return w;
    return {
      ...w,
      ...patch,
      lastBotCheckAt: new Date().toISOString(),
    };
  });
  saveWatchlist(next);
  return next;
}

export function planBotBid(
  entry: WatchEntry,
  panel: ReturnType<typeof parseTransferPanelFromHtml>,
  opts?: { myTeamName?: string }
): BotTickResult {
  const name = entry.name || panel.name || entry.playerId;
  const maxBid = entry.maxBid || 0;
  if (!panel.isTransferListed) {
    return {
      playerId: entry.playerId,
      name,
      action: 'not_listed',
      message: 'Player is no longer transfer listed',
      maxBid,
    };
  }
  const current = panel.currentBid || 0;
  const next = panel.suggestedBid ?? nextExpectedBid(panel.currentBid, panel.askingPrice);
  const myTeam = (opts?.myTeamName || '').toLowerCase();
  const leading =
    myTeam && panel.bidderTeam && panel.bidderTeam.toLowerCase().includes(myTeam);

  if (leading) {
    return {
      playerId: entry.playerId,
      name,
      action: 'already_leading',
      message: `You are current high bidder at £${current.toLocaleString()}`,
      currentBid: current,
      nextBid: next,
      maxBid,
    };
  }
  if (next > maxBid) {
    return {
      playerId: entry.playerId,
      name,
      action: current > 0 ? 'outbid_over_max' : 'at_max',
      message: `Next expected bid £${next.toLocaleString()} exceeds your max £${maxBid.toLocaleString()}`,
      currentBid: current,
      nextBid: next,
      maxBid,
    };
  }
  return {
    playerId: entry.playerId,
    name,
    action: 'bid_placed',
    message: `Plan bid £${next.toLocaleString()} (current £${current.toLocaleString() || 'none'})`,
    currentBid: current,
    nextBid: next,
    maxBid,
  };
}
