/**
 * "Jarvis check" for a player on the Transfer Watch list: does this player make sense for the squad,
 * what does he do to the weekly bottom line, and does he move the team towards the rating goals?
 *
 * Everything numeric is computed HERE, in code, from the synced squad / finances / rating targets and the
 * player's own page. Jarvis (the LLM) is only given the finished numbers to judge and explain - it never
 * does the arithmetic, so it can't invent a wage or a surplus. Anything we could not read is reported as a
 * data gap rather than guessed.
 *
 * Pure module (no DOM / network) so it can be unit-tested.
 */
import { evaluateScoutBuyFit, type BuyFitPlayer, type BuyFitVerdict } from './scoutBuyFit';
import { estimateTeamRatings, levelToLabel, type TeamRatingKey } from './transferList';

// ---------------------------------------------------------------------------------------------
// 1. The watched player, from the stored Watch entry
// ---------------------------------------------------------------------------------------------

export interface WatchedPlayerProfile {
  name?: string;
  age?: number;
  /** Weekly wage in £ as read from his Battrick page (can be the contract minimum). Undefined if not read. */
  wage?: number;
  wageSource: 'page' | 'unknown';
  btRating?: number;
  bowlingType?: string;
  /** Only skills that were read. */
  skills: Partial<Record<'batting' | 'bowling' | 'keeping' | 'fielding' | 'stamina' | 'concentration' | 'consistency', number>>;
}

/** The fields of a Watch entry we use (structural, so this module doesn't import the Watch store). */
export interface WatchEntryLike {
  name: string;
  age?: number;
  wage?: number;
  bowlingType?: string;
  skills?: {
    batting?: number;
    bowling?: number;
    keeping?: number;
    fielding?: number;
    stamina?: number;
    concentration?: number;
    consistency?: number;
  };
}

/**
 * The page reader stores 0 for any skill label it could not find, so "not read" and "useless" look the same.
 * Keeping 0 is normal; but a player whose batting AND bowling are both 0 has not been read.
 */
export function skillsWereRead(e: WatchEntryLike): boolean {
  const s = e.skills;
  return !!s && ((s.batting || 0) > 0 || (s.bowling || 0) > 0);
}

export function profileFromWatchEntry(e: WatchEntryLike): WatchedPlayerProfile {
  const read = skillsWereRead(e);
  const s = e.skills || {};
  const bt = (e.bowlingType || '').trim();
  return {
    name: e.name,
    age: e.age && e.age > 0 ? e.age : undefined,
    wage: e.wage && e.wage > 0 ? e.wage : undefined,
    wageSource: e.wage && e.wage > 0 ? 'page' : 'unknown',
    bowlingType: bt && bt.toLowerCase() !== 'none' ? bt : undefined,
    skills: read
      ? {
          batting: s.batting || 0,
          bowling: s.bowling || 0,
          keeping: s.keeping || 0,
          fielding: s.fielding,
          stamina: s.stamina,
          concentration: s.concentration,
          consistency: s.consistency,
        }
      : {},
  };
}

// ---------------------------------------------------------------------------------------------
// 2. The check itself
// ---------------------------------------------------------------------------------------------

export type Level = 'ok' | 'warn' | 'bad';

export interface WatchSquadPlayer extends BuyFitPlayer {
  bowlingType?: string;
}

export interface WatchFinances {
  cash?: number;
  sponsorsIncome?: number;
  gateReceipts?: number;
  interestReceived?: number;
  playerWages?: number;
  staffWages?: number;
}

export const RATING_LABELS: Record<TeamRatingKey, string> = {
  topOrder: 'Top order',
  middleOrder: 'Middle order',
  lowerOrder: 'Lower order',
  seamBowling: 'Seam',
  spinBowling: 'Spin',
  fielding: 'Fielding',
  wicketKeeping: 'Wicket-keeping',
};

export interface MoneyImpact {
  /** Weekly income minus weekly wages (players + staff), as Jarvis' manager briefing computes it. */
  surplusBefore: number;
  /** Wage added by the player; undefined if the page didn't state one. */
  wage?: number;
  wageSource: WatchedPlayerProfile['wageSource'];
  surplusAfter?: number;
  /** If he replaces the weakest same-role player and that player is let go. */
  replacesName?: string;
  replacesWage?: number;
  surplusAfterIfReplaces?: number;
  /** The price the comparison is based on (max bid if set, else the next expected bid). */
  price?: number;
  cashBefore: number;
  cashAfter?: number;
  level: Level;
  note: string;
}

export interface GoalRow {
  key: TeamRatingKey;
  label: string;
  target: number;
  before: number;
  after: number;
  /** after - before (>0 = he lifts this rating) */
  change: number;
  closedGap: boolean;
}

export interface GoalImpact {
  rows: GoalRow[];
  improved: GoalRow[];
  level: Level;
  note: string;
}

export interface WatchFitReport {
  player: { name: string; age?: number; bowlingType?: string; skills: WatchedPlayerProfile['skills'] };
  squad: { verdict: BuyFitVerdict | null; level: Level; note: string };
  money: MoneyImpact | null;
  goals: GoalImpact | null;
  /** Things we could not read / compute. Always shown, never papered over. */
  dataGaps: string[];
  level: Level;
  headline: string;
}

const gbp = (n: number) => (n < 0 ? '-£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');
const worst = (...ls: (Level | undefined)[]): Level =>
  ls.includes('bad') ? 'bad' : ls.includes('warn') ? 'warn' : 'ok';

/** Weekly income - weekly wages, using the same fields as the Jarvis manager briefing. */
export function weeklySurplus(f: WatchFinances): number {
  const income = (f.sponsorsIncome || 0) + (f.gateReceipts || 0) + (f.interestReceived || 0);
  const wages = (f.playerWages || 0) + (f.staffWages || 0);
  return income - wages;
}

function toRatingInput(p: BuyFitPlayer) {
  return {
    skills: {
      batting: p.skills.batting || 0,
      bowling: p.skills.bowling || 0,
      keeping: p.skills.keeping || 0,
      fielding: p.skills.fielding,
      concentration: p.skills.concentration,
    },
    bowlingType: p.bowlingType,
    role: p.role,
  };
}

export function buildWatchFit(input: {
  name: string;
  profile: WatchedPlayerProfile;
  /** Age already known from the watch entry, used only if the page didn't show one. */
  fallbackAge?: number;
  price?: number;
  squad: WatchSquadPlayer[];
  finances: WatchFinances | null;
  targets: Partial<Record<TeamRatingKey, number>> | null;
}): WatchFitReport {
  const { profile, squad, finances } = input;
  const dataGaps: string[] = [];
  const age = profile.age ?? input.fallbackAge;
  const haveSkills = ['batting', 'bowling', 'keeping'].some((k) => (profile.skills as any)[k] !== undefined);

  if (!haveSkills) dataGaps.push("His skills haven't been read from Battrick yet, so squad fit and goals can't be judged.");
  if (profile.wageSource === 'unknown') dataGaps.push("His weekly wage isn't shown on the page, so the weekly income impact is unknown.");
  if (age === undefined) dataGaps.push('His age was not found.');
  if (!squad.length) dataGaps.push('Your squad is not synced.');
  if (!finances) dataGaps.push('Your finances are not synced.');
  if (!input.targets || !Object.keys(input.targets).length) dataGaps.push('No team rating goals are set (Squad → Estimator).');

  const cand: WatchSquadPlayer = {
    name: input.name,
    age: age ?? 25,
    wage: profile.wage,
    btRating: profile.btRating,
    skills: { ...profile.skills },
    bowlingType: profile.bowlingType,
  };

  // --- squad fit ---------------------------------------------------------------------------
  let verdict: BuyFitVerdict | null = null;
  let squadLevel: Level = 'warn';
  let squadNote = 'Not judged (skills or squad missing).';
  if (haveSkills && squad.length) {
    verdict = evaluateScoutBuyFit(cand, squad, {
      cash: finances?.cash,
      ratingTargets: input.targets || undefined,
      factorFinance: false, // money is judged separately below
    });
    squadLevel = verdict.verdict === 'BUY' ? 'ok' : verdict.verdict === 'PASS' ? 'bad' : 'warn';
    squadNote = verdict.summary + (verdict.replaces ? ` Would replace ${verdict.replaces}.` : '');
  }

  // --- weekly money ------------------------------------------------------------------------
  let money: MoneyImpact | null = null;
  if (finances) {
    const surplusBefore = weeklySurplus(finances);
    const cashBefore = finances.cash || 0;
    const wage = profile.wage;
    const surplusAfter = wage !== undefined ? surplusBefore - wage : undefined;

    let replacesWage: number | undefined;
    const replacesName = verdict?.replaces;
    if (replacesName) {
      const r = squad.find((p) => p.name === replacesName);
      if (r && r.wage) replacesWage = r.wage;
    }
    const surplusAfterIfReplaces =
      surplusAfter !== undefined && replacesWage !== undefined ? surplusAfter + replacesWage : undefined;

    const price = input.price && input.price > 0 ? input.price : undefined;
    const cashAfter = price !== undefined ? cashBefore - price : undefined;

    let level: Level = 'ok';
    const bits: string[] = [];
    if (surplusAfter === undefined) {
      level = 'warn';
      bits.push('Weekly wage unknown, so the weekly impact cannot be worked out.');
    } else {
      bits.push(
        `Weekly surplus ${gbp(surplusBefore)} → ${gbp(surplusAfter)} with his ${gbp(profile.wage!)} wage` +
          (surplusAfterIfReplaces !== undefined
            ? ` (${gbp(surplusAfterIfReplaces)} if you let ${replacesName} go).`
            : '.')
      );
      if (surplusAfter < -10000) level = 'bad';
      else if (surplusAfter < 0) level = surplusBefore >= 0 ? 'bad' : 'warn';
    }
    if (cashAfter !== undefined) {
      bits.push(`Cash after paying ${gbp(price!)}: ${gbp(cashAfter)}.`);
      if (cashAfter < 0) level = 'bad';
      else if (profile.wage !== undefined && cashAfter < profile.wage * 4) level = worst(level, 'warn');
    }
    money = {
      surplusBefore,
      wage,
      wageSource: profile.wageSource,
      surplusAfter,
      replacesName,
      replacesWage,
      surplusAfterIfReplaces,
      price,
      cashBefore,
      cashAfter,
      level,
      note: bits.join(' '),
    };
  }

  // --- team goals --------------------------------------------------------------------------
  let goals: GoalImpact | null = null;
  const targets = input.targets;
  if (haveSkills && squad.length && targets && Object.keys(targets).length) {
    const before = estimateTeamRatings(squad.map(toRatingInput));
    const after = estimateTeamRatings([...squad, cand].map(toRatingInput));
    const rows: GoalRow[] = (Object.keys(targets) as TeamRatingKey[])
      .filter((k) => (targets[k] || 0) > 0 && before[k])
      .map((k) => ({
        key: k,
        label: RATING_LABELS[k] || k,
        target: targets[k] as number,
        before: before[k].level,
        after: after[k].level,
        change: after[k].level - before[k].level,
        closedGap: before[k].level < (targets[k] as number) && after[k].level >= (targets[k] as number),
      }));
    const improved = rows.filter((r) => r.change > 0 && r.before < r.target);
    const level: Level = improved.length ? 'ok' : 'warn';
    goals = {
      rows,
      improved,
      level,
      note: improved.length
        ? 'Lifts ' +
          improved
            .map((r) => `${r.label} ${levelToLabel(r.before)} → ${levelToLabel(r.after)} (goal ${levelToLabel(r.target)})`)
            .join('; ') +
          '.'
        : 'Does not move any rating that is still below its goal.',
    };
  }

  const level = worst(squadLevel, money?.level, goals?.level);
  const headline =
    level === 'ok'
      ? 'Makes sense for the squad'
      : level === 'warn'
        ? 'Questionable — check the flagged items'
        : "Doesn't stack up — see the red items";

  return {
    player: { name: input.name, age, bowlingType: profile.bowlingType, skills: profile.skills },
    squad: { verdict, level: squadLevel, note: squadNote },
    money,
    goals,
    dataGaps,
    level,
    headline,
  };
}

// ---------------------------------------------------------------------------------------------
// 3. Briefing + prompt for Jarvis
// ---------------------------------------------------------------------------------------------

const skillLine = (s: WatchedPlayerProfile['skills']) =>
  (['batting', 'bowling', 'keeping', 'fielding', 'stamina'] as const)
    .map((k) => `${k} ${s[k] !== undefined ? levelToLabel(s[k] as number) : 'unknown'}`)
    .join(', ');

export function buildWatchFitBriefing(
  r: WatchFitReport,
  extra: { squad: WatchSquadPlayer[]; maxBid?: number; deadline?: string }
): string {
  const L: string[] = [];
  L.push(`[WATCHED PLAYER]\n${r.player.name}, age ${r.player.age ?? 'unknown'}, ${skillLine(r.player.skills)}${r.player.bowlingType ? `, bowling ${r.player.bowlingType}` : ''}`);
  if (extra.maxBid) L.push(`Manager's current max bid: ${gbp(extra.maxBid)}`);

  L.push(`\n[SQUAD FIT - computed]\n${r.squad.verdict ? `${r.squad.verdict.verdict} (score ${r.squad.verdict.score}/100). ${r.squad.note}\n- ${r.squad.verdict.reasons.join('\n- ')}` : r.squad.note}`);

  if (r.money) {
    const m = r.money;
    L.push(
      `\n[WEEKLY INCOME IMPACT - computed]\n- Weekly surplus now: ${gbp(m.surplusBefore)} (income minus player+staff wages)\n- His wage: ${m.wage !== undefined ? `${gbp(m.wage)}/wk (as read from his Battrick page)` : 'UNKNOWN'}\n- Weekly surplus after signing: ${m.surplusAfter !== undefined ? gbp(m.surplusAfter) : 'unknown'}${m.surplusAfterIfReplaces !== undefined ? `\n- If ${m.replacesName} (${gbp(m.replacesWage!)}/wk) is let go: ${gbp(m.surplusAfterIfReplaces)}` : ''}\n- Cash now ${gbp(m.cashBefore)}${m.price !== undefined ? `; after paying ${gbp(m.price)}: ${gbp(m.cashAfter!)}` : ''}`
    );
  } else {
    L.push('\n[WEEKLY INCOME IMPACT]\nFinances not synced.');
  }

  if (r.goals) {
    L.push(
      `\n[TEAM GOALS - computed, rating before → after he joins, vs goal]\n` +
        r.goals.rows
          .map((g) => `- ${g.label}: ${levelToLabel(g.before)} → ${levelToLabel(g.after)} (goal ${levelToLabel(g.target)})${g.closedGap ? ' GOAL REACHED' : g.change > 0 ? ' improved' : ''}`)
          .join('\n')
    );
  } else {
    L.push('\n[TEAM GOALS]\nNot assessed (skills, squad or goals missing).');
  }

  L.push(
    `\n[SQUAD]\n` +
      extra.squad
        .slice(0, 25)
        .map((p) => `- ${p.name}, ${p.age}y, bat ${levelToLabel(p.skills.batting || 0)}, bowl ${levelToLabel(p.skills.bowling || 0)}, keep ${levelToLabel(p.skills.keeping || 0)}, wage ${p.wage ? gbp(p.wage) : 'n/a'}`)
        .join('\n')
  );

  if (r.dataGaps.length) L.push(`\n[DATA GAPS]\n- ${r.dataGaps.join('\n- ')}`);
  return L.join('\n');
}

export const WATCH_FIT_SYSTEM_PROMPT = `You are Coach Jarvis, checking ONE player the manager is watching on the transfer list. Answer three questions only: (1) does he make sense for this squad, (2) what does he do to the weekly income, (3) does he move the team towards the rating goals.

RULES
- Every number in the briefing was already computed by the app. Use them exactly; never recalculate, estimate or invent wages, cash, ratings or skills.
- If the briefing lists a DATA GAP, say plainly what can't be judged because of it. Do not fill the gap with a guess.
- Judge, don't recap: lead with the call, then the single most important reason for each question.
- Out of scope: match tactics, lineups, training plans, other players on the market. If asked about them, say you only check this player.
- No more than about 160 words.

FORMAT
## Verdict
BID / HOLD AT MAX / SKIP - one line why
## Squad fit
1-2 lines (name who he'd replace or back up)
## Weekly income
1-2 lines using the surplus figures
## Team goals
1-2 lines naming the ratings he does or doesn't move
## Watch out
only if there is a real risk or data gap (omit otherwise)`;
