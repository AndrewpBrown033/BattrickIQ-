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

const SKILL_LABELS =
  'useless|worthless|abysmal|woeful|feeble|mediocre|competent|respectable|proficient|strong|superb\\*|superb|quality|remarkable|wonderful|exceptional|sensational|exquisite|masterful|miraculous|phenomenal|elite';

function matchSkillLabel(text: string, skillName: string): string {
  const re = new RegExp('\\b' + skillName + '\\b:?\\s*(?:\\[|\\()?(' + SKILL_LABELS + ')\\b', 'i');
  const m = text.match(re);
  if (m) return m[1];
  const fb = text.match(new RegExp('\\b' + skillName + '\\b:?\\s*(?:\\[|\\()?([a-zA-Z*]+)\\b', 'i'));
  return fb?.[1] || '';
}

function skillLabelToLevel(text: string, isStamina = false): number {
  if (!text) return 0;
  const cleaned = text.trim().toLowerCase();
  if (isStamina) {
    if (cleaned.includes('superb*')) return 11;
    if (cleaned.includes('superb')) return 10;
    if (cleaned.includes('strong')) return 9;
    if (cleaned.includes('proficient')) return 8;
    if (cleaned.includes('respectable')) return 7;
    if (cleaned.includes('competent')) return 6;
    if (cleaned.includes('mediocre')) return 5;
    if (cleaned.includes('feeble')) return 4;
    if (cleaned.includes('woeful')) return 3;
    if (cleaned.includes('abysmal')) return 2;
    if (cleaned.includes('worthless')) return 1;
    return 0;
  }
  const levels = [
    'useless', 'worthless', 'abysmal', 'woeful', 'feeble', 'mediocre', 'competent', 'respectable',
    'proficient', 'strong', 'superb', 'quality', 'remarkable', 'wonderful', 'exceptional', 'sensational',
    'exquisite', 'masterful', 'miraculous', 'phenomenal', 'elite',
  ];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (cleaned.includes(levels[i])) return i;
  }
  return 0;
}

function parseMoney(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
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
  age?: number;
  wage?: number;
  role?: string;
  bowlingType?: string;
  skills?: {
    batting: number;
    bowling: number;
    keeping: number;
    fielding: number;
    stamina: number;
    concentration: number;
    consistency: number;
    experience: number;
  };
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
  const titleName = (html.match(/<title[^>]*>\s*Battrick\s*[-–]\s*([^<]+?)\s*(?:&#187;|»|&raquo;)/i) ||
    [])[1]
    ?.replace(/&#\d+;/g, '')
    .trim();
  const name =
    titleName ||
    (html.match(/<h2[^>]*>\s*([^(<]+)\s*\((\d+)\)/i) || [])[1]?.trim() ||
    (text.match(/([A-Za-z][A-Za-z .'-]{1,40})\s*\(\d{4,}\)/) || [])[1];

  const asking = parseMoney((text.match(/Asking\s*Price:\s*£?\s*([\d,]+)/i) || [])[1]);
  const current = parseMoney((text.match(/Current\s*Bid:\s*£?\s*([\d,]+)/i) || [])[1]);
  const bidder =
    (text.match(/Current\s*Bid:\s*£?[\d,]+\s*by\s+([A-Za-z0-9 .'-]{2,50})/i) || [])[1]?.trim();
  const deadline =
    (text.match(/Deadline:\s*(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/i) || [])[1];
  const suggested = parseMoney(
    (html.match(/name=["']bidValue["'][^>]*value=["'](\d+)["']/i) ||
      html.match(/id=["']bidvalue["'][^>]*value=["'](\d+)["']/i) ||
      [])[1]
  );
  const wagesMin = parseMoney((text.match(/at least\s*£?\s*([\d,]+)/i) || [])[1]);

  const age =
    Number((text.match(/\bAge:\s*(\d{1,2})\b/i) || text.match(/\((\d{1,2})\s*years?\s*old\)/i) || [])[1]) ||
    undefined;
  const wage =
    parseMoney((text.match(/\bWage:\s*£?\s*([\d,]+)/i) || text.match(/\bSalary:\s*£?\s*([\d,]+)/i) || [])[1]) ||
    wagesMin;

  const skills = {
    batting: skillLabelToLevel(matchSkillLabel(text, 'Batting')),
    bowling: skillLabelToLevel(matchSkillLabel(text, 'Bowling')),
    keeping: skillLabelToLevel(matchSkillLabel(text, 'Keeping')),
    fielding: skillLabelToLevel(matchSkillLabel(text, 'Fielding')),
    stamina: skillLabelToLevel(matchSkillLabel(text, 'Stamina'), true),
    concentration: skillLabelToLevel(matchSkillLabel(text, 'Concentration')),
    consistency: skillLabelToLevel(matchSkillLabel(text, 'Consistency')),
    experience: skillLabelToLevel(matchSkillLabel(text, 'Experience')),
  };

  let bowlingType = 'None';
  const bowlTypeMatch = text.match(/Bowls:?\s*([A-Za-z\s]+?)(?:,\s*|Style|$|\s+Rating)/i);
  if (bowlTypeMatch) {
    const type = bowlTypeMatch[1].trim().toLowerCase();
    if (type.includes('fast medium')) bowlingType = 'Fast Medium';
    else if (type.includes('fast')) bowlingType = 'Fast';
    else if (type.includes('medium')) bowlingType = 'Medium';
    else if (type.includes('spin') || type.includes('spinner') || type.includes('break') || type.includes('orthodox'))
      bowlingType = 'Spin';
  }
  if (bowlingType === 'None') {
    const low = text.toLowerCase();
    if (low.includes('fast medium') || low.includes('fast-medium')) bowlingType = 'Fast Medium';
    else if (low.includes('fast bowler') || low.includes('fast pace')) bowlingType = 'Fast';
    else if (low.includes('medium bowler')) bowlingType = 'Medium';
    else if (low.includes('spin') || low.includes('off break') || low.includes('leg break')) bowlingType = 'Spin';
  }

  let role = 'Prospect';
  const primary = Math.max(skills.batting, skills.bowling, skills.keeping);
  if (skills.keeping >= 5 && skills.keeping >= skills.batting && skills.keeping >= skills.bowling) role = 'Keeper';
  else if (skills.batting >= 5 && skills.bowling >= 5 && skills.batting >= primary - 2 && skills.bowling >= primary - 2)
    role = 'All-rounder';
  else if (skills.bowling >= skills.batting && skills.bowling >= 5) role = 'Bowler';
  else if (skills.batting >= 5) role = 'Batter';

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
    age: age && age > 0 && age < 60 ? age : undefined,
    wage,
    role,
    bowlingType,
    skills,
  };
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
      message: 'No longer transfer listed',
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
      message: 'You are the high bidder',
      currentBid: current,
      nextBid: next,
      maxBid,
    };
  }
  if (maxBid > 0 && next > maxBid) {
    return {
      playerId: entry.playerId,
      name,
      action: 'outbid_over_max',
      message: `Next bid £${next.toLocaleString()} is over max £${maxBid.toLocaleString()}`,
      currentBid: current,
      nextBid: next,
      maxBid,
    };
  }
  if (maxBid > 0 && current >= maxBid) {
    return {
      playerId: entry.playerId,
      name,
      action: 'at_max',
      message: `At or over max (£${maxBid.toLocaleString()})`,
      currentBid: current,
      nextBid: next,
      maxBid,
    };
  }
  if (maxBid > 0 && next <= maxBid) {
    return {
      playerId: entry.playerId,
      name,
      action: 'bid_placed',
      message: `Would bid £${next.toLocaleString()}`,
      currentBid: current,
      nextBid: next,
      maxBid,
    };
  }
  return {
    playerId: entry.playerId,
    name,
    action: 'skipped',
    message: 'No max bid set — refresh only',
    currentBid: current,
    nextBid: next,
    maxBid,
  };
}
