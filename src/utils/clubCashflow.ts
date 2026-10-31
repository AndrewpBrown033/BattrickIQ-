/**
 * Club cash-flow, the way Battrick actually pays it:
 *   - every WEEK:   sponsorship + interest come in; player salaries, staff salaries and ground maintenance go out
 *   - every HOME game: a gate-receipts payment comes in (nothing for away games)
 *
 * The old screens added ONE gate payment to the weekly figures and called it "weekly surplus". That is wrong
 * twice: gate money isn't weekly, and ground maintenance was left out. A club with 3 home games left could be
 * shown a negative "income stream" because the weeks without a home game are (correctly) negative on their
 * own while the home games carry the season.
 *
 * Pure module: no DOM, no storage. Everything comes in as arguments so it can be unit-tested.
 */
import type { ClubFinances, BattrickGame } from '../types';
import { parseGameDateToTimestamp } from './history';

export interface OwnClub {
  teamId?: string;
  teamName?: string;
}

const norm = (s?: string | null) =>
  String(s ?? '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const idOf = (v: unknown) => (v == null ? '' : String(v).trim());
const PLACEHOLDER = new Set(['', 'my club', 'my battrick iq club', 'your club', 'my team']);

/**
 * Is this fixture at OUR ground? Our own team id / name is trusted over the stored `venue`, because the
 * fixtures parser defaults every game to 'Home' and can get it wrong when it doesn't know our club.
 */
export function isHomeFixture(f: Partial<BattrickGame>, own: OwnClub = {}): { home: boolean; certain: boolean } {
  const ownId = idOf(own.teamId);
  const ownNameRaw = (own.teamName || '').trim();
  const ownName = PLACEHOLDER.has(norm(ownNameRaw)) ? '' : ownNameRaw;
  const is = (id: unknown, name?: string) =>
    (ownId !== '' && idOf(id) !== '' && idOf(id) === ownId) ||
    (ownName !== '' && !!name && norm(name) === norm(ownName));
  const homeOwn = is(f.homeTeamId, f.homeTeam);
  const awayOwn = is(f.awayTeamId, f.awayTeam);
  if (homeOwn !== awayOwn) return { home: homeOwn, certain: true };
  return { home: f.venue !== 'Away', certain: false };
}

const isUpcoming = (f: BattrickGame) => !f.result || String(f.result).toLowerCase() === 'upcoming';

/** Monday-based week key so two games in the same week share one weekly bill. */
function weekKey(ts: number): string {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export interface Cashflow {
  /** What goes in / out EVERY week, gate not included. Negative is normal for most clubs. */
  weekly: { income: number; costs: number; net: number; source: 'ledger' | 'latest-sync' };
  /** Average gate per home game and how many payments that average is based on. */
  gate: { average: number; samples: number; source: 'ledger' | 'latest-sync' | 'none' };
  remaining: {
    games: number;
    home: number;
    away: number;
    /** false = home/away came from the stored venue flag only (our team id wasn't known) */
    homeAwayCertain: boolean;
    weeks: number;
    fixturesKnown: boolean;
  };
  /** Weekly bills for the remaining weeks + expected gates for the remaining home games. */
  projectedNet: number;
  /** projectedNet spread over the remaining weeks - the honest "per week" figure. */
  avgWeeklyNet: number;
  cash: number;
  projectedCash: number;
  notes: string[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function computeCashflow(
  f: ClubFinances | null | undefined,
  fixtures: BattrickGame[] | null | undefined,
  own: OwnClub = {},
  nowMs: number = Date.now()
): Cashflow {
  const notes: string[] = [];
  const fin = (f || {}) as Partial<ClubFinances>;
  const cash = fin.cash || 0;

  // ---- weekly bills: the latest real billing run if we have the ledger, else the synced summary fields
  const wh = fin.weeklyHistory || [];
  const latest = wh.length ? wh[wh.length - 1] : undefined;
  let weekly: Cashflow['weekly'];
  if (latest) {
    const income = (latest.sponsorship || 0) + (latest.interestReceived || 0);
    const costs =
      (latest.playerSalaries || 0) + (latest.staffSalaries || 0) + (latest.groundMaintenance || 0) + (latest.interestPaid || 0);
    weekly = { income, costs, net: income - costs, source: 'ledger' };
  } else {
    const income = (fin.sponsorsIncome || 0) + (fin.interestReceived || 0);
    const costs = (fin.playerWages || 0) + (fin.staffWages || 0) + (fin.groundMaintenance || 0);
    weekly = { income, costs, net: income - costs, source: 'latest-sync' };
    if (f) notes.push('Weekly bills come from the last finance sync (no ledger history yet).');
  }

  // ---- gate per home game
  const gates = (fin.gateHistory || []).map((g) => g.amount).filter((n) => n > 0);
  let gate: Cashflow['gate'];
  if (gates.length) {
    const recent = gates.slice(-5);
    gate = { average: mean(recent), samples: recent.length, source: 'ledger' };
  } else if ((fin.gateReceipts || 0) > 0) {
    gate = { average: fin.gateReceipts as number, samples: 1, source: 'latest-sync' };
    notes.push('Gate estimate is one payment - sync a season to date for a better average.');
  } else {
    gate = { average: 0, samples: 0, source: 'none' };
    notes.push('No gate receipts found yet, so home games are counted as £0.');
  }

  // ---- what is left of the season
  const upcoming = (fixtures || []).filter(isUpcoming);
  let home = 0;
  let away = 0;
  let certain = true;
  const weeks = new Set<string>();
  const today = new Date(nowMs).setHours(0, 0, 0, 0);
  for (const g of upcoming) {
    const ts = parseGameDateToTimestamp(g.date, g.time);
    if (ts != null && ts < today) continue; // stale "upcoming" row for a date already gone
    const h = isHomeFixture(g, own);
    if (h.home) home++;
    else away++;
    if (!h.certain) certain = false;
    if (ts != null) weeks.add(weekKey(ts));
  }
  const games = home + away;
  const fixturesKnown = games > 0;
  const weekCount = fixturesKnown ? Math.max(1, weeks.size || games) : 1;
  if (!fixturesKnown) notes.push('No upcoming fixtures synced, so only the weekly bills are shown.');
  if (fixturesKnown && !certain) notes.push("Home/away is taken from Battrick's venue flag (your team id isn't known yet) - check the count.");

  const projectedNet = weekCount * weekly.net + home * gate.average;
  const avgWeeklyNet = fixturesKnown ? projectedNet / weekCount : weekly.net;

  return {
    weekly,
    gate,
    remaining: { games, home, away, homeAwayCertain: certain, weeks: weekCount, fixturesKnown },
    projectedNet,
    avgWeeklyNet,
    cash,
    projectedCash: cash + projectedNet,
    notes,
  };
}

export const gbp = (n: number) => (n < 0 ? '-£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');

/** One plain-English line for screens and for Jarvis. */
export function describeCashflow(c: Cashflow): string {
  const r = c.remaining;
  const parts = [
    `Every week: ${gbp(c.weekly.net)} (income ${gbp(c.weekly.income)}, bills ${gbp(c.weekly.costs)}).`,
    c.gate.samples ? `Each home game adds about ${gbp(c.gate.average)} gate.` : 'No gate figure yet.',
  ];
  if (r.fixturesKnown) {
    parts.push(
      `${r.games} game${r.games === 1 ? '' : 's'} left (${r.home} home, ${r.away} away) over ${r.weeks} week${r.weeks === 1 ? '' : 's'}: ` +
        `${gbp(c.projectedNet)} → cash ${gbp(c.projectedCash)}, about ${gbp(c.avgWeeklyNet)} a week.`
    );
  }
  return parts.join(' ');
}
