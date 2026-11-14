/**
 * Training advice for Coach Jarvis (and anything else that needs a plain-text training briefing).
 *
 * Jarvis used to be told only "On nets: N", so a training question was answered from generic cricket knowledge.
 * This module gives it the facts instead: the weekly net budget, who is training what and how long each pop takes
 * (using the SAME forecast the player page uses), who has nothing assigned, and a deterministic suggestion for
 * the free nets. Everything here is pure (no localStorage) so it can be tested.
 *
 * The forecast numbers are the app's community-sourced estimates (see trainingNets.ts), so the briefing says so.
 */
import type { BattrickPlayer, ClubFinances } from '../types';
import { estimateWeeksToNextLevel } from '../parser';
import { MAX_NETS_PER_WEEK } from './trainingNets';
import { primaryOf } from './scoutBuyFit';

export type TrainSkill = 'batting' | 'bowling' | 'keeping' | 'fielding' | 'stamina';
export type PrimarySkill = 'batting' | 'bowling' | 'keeping';

export interface RatingGapLike {
  key: string;
  current: number;
  target: number;
  gap: number;
}

/** Which team-rating gaps a primary skill helps close. */
const SKILL_TO_GAPS: Record<PrimarySkill, string[]> = {
  batting: ['topOrder', 'middleOrder', 'lowerOrder'],
  bowling: ['seamBowling', 'spinBowling'],
  keeping: ['wicketKeeping'],
};

const DEFAULT_COACH_LEVEL = 9; // "Superb", the same default the player page uses

export const TRAINING_MECHANICS_PROMPT = `TRAINING MECHANICS (community sources + Battrick rules page; the numbers are estimates, say so when you quote them)
- A club has ${MAX_NETS_PER_WEEK} nets (coaching sessions) a week in total. Skills only rise through training, and one pop is one skill level.
- Extra nets on the SAME skill for one player have diminishing returns: total effect is 1x, 1.5x, 1.75x, 1.875x for 1, 2, 3, 4 nets. A third or fourth net gives little, so spreading nets across players usually beats stacking them.
- Batting, bowling and keeping train faster when the player is young; the forecast slows steeply with age. Higher current level also takes longer.
- Stamina maxes at level 11 (other skills 20). Individual stamina nets take about 6 / 4 / 3 weeks for 1 / 2 / 3 nets (ages 17-32). Squad training for stamina or fielding is about 5.5 weeks per pop.
- Concentration and Consistency need Sports Psychologists. Concentration comes from batting, keeping or fielding nets; Consistency from bowling, keeping or fielding nets. Psychologists attend only the first net of each TYPE, so extra nets of one type do not stack, but mixing types speeds it up. These train FASTER with age (about 14 weeks at 17 down to 4 weeks from 34 on, single net type).
- Weeks-to-pop figures assume a Superb (9) coach unless the briefing says otherwise.

TRAINING ANSWERS: when asked about training, nets or who to develop, answer from the [TRAINING] section of the briefing. Use its numbers exactly, name players and skills, say how many nets each gets, and give the weeks. If the section says data is missing (no nets synced, no staff counts), say so instead of guessing. Never promise a pop date; call forecasts estimates.`;

function numOrUndef(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

export function netsOf(p: BattrickPlayer): Record<TrainSkill, number> {
  const n: any = p?.nets || {};
  return {
    batting: Math.max(0, Number(n.batting) || 0),
    bowling: Math.max(0, Number(n.bowling) || 0),
    keeping: Math.max(0, Number(n.keeping) || 0),
    fielding: Math.max(0, Number(n.fielding) || 0),
    stamina: Math.max(0, Number(n.stamina) || 0),
  };
}

export function netsUsed(squad: BattrickPlayer[]): number {
  return squad.reduce((s, p) => {
    const n = netsOf(p);
    return s + n.batting + n.bowling + n.keeping + n.fielding + n.stamina;
  }, 0);
}

function levelOf(p: BattrickPlayer, key: TrainSkill): number {
  const v = Number((p?.skills as any)?.[key]);
  return Number.isFinite(v) ? v : 0;
}

/** Weeks to the next level for one skill with n nets, using the right skill rules (stamina and fielding differ). */
export function weeksFor(
  p: BattrickPlayer,
  key: TrainSkill,
  nets: number,
  opts: { coachLevel?: number; squadTraining?: boolean } = {}
): number {
  return estimateWeeksToNextLevel(
    levelOf(p, key),
    p.age || 25,
    nets,
    opts.coachLevel ?? DEFAULT_COACH_LEVEL,
    key,
    !!opts.squadTraining
  );
}

export interface NetSuggestion {
  name: string;
  skill: PrimarySkill;
  nets: number; // nets to ADD this week
  weeksBefore: number; // Infinity when he currently has none on this skill
  weeksAfter: number;
  closesGap?: string;
}

/**
 * Hand out the free nets one at a time to whichever player's PRIMARY skill speeds up most (pops per week gained),
 * with a 1.5x preference when the skill helps close a team-rating gap. Greedy, deterministic, and it only adds nets:
 * it never moves nets you already assigned. Stamina / fielding are left to the manager (they are listed as options).
 */
export function suggestNetAllocation(
  squad: BattrickPlayer[],
  freeNets: number,
  gaps: RatingGapLike[] = [],
  coachLevel = DEFAULT_COACH_LEVEL
): NetSuggestion[] {
  if (!(freeNets > 0)) return [];
  const openGapKeys = new Set(gaps.filter((g) => g.gap > 0).map((g) => g.key));

  type State = { p: BattrickPlayer; skill: PrimarySkill; base: number; added: number; weeks0: number; gap?: string };
  const states: State[] = [];
  for (const p of squad) {
    if (!p || !p.name) continue;
    const prim = primaryOf({ name: p.name, age: p.age || 25, role: p.role, skills: (p.skills || {}) as any });
    const skill = prim.key as PrimarySkill;
    if (levelOf(p, skill) >= 20) continue;
    const base = netsOf(p)[skill];
    const gap = SKILL_TO_GAPS[skill].find((k) => openGapKeys.has(k));
    states.push({ p, skill, base, added: 0, weeks0: weeksFor(p, skill, base, { coachLevel }), gap });
  }

  const pops = (st: State, extra: number) => {
    const w = weeksFor(st.p, st.skill, st.base + extra, { coachLevel });
    return Number.isFinite(w) && w > 0 ? 1 / w : 0;
  };

  for (let i = 0; i < freeNets; i++) {
    let best: State | null = null;
    let bestGain = 0;
    for (const st of states) {
      const gain = (pops(st, st.added + 1) - pops(st, st.added)) * (st.gap ? 1.5 : 1);
      if (gain > bestGain) {
        bestGain = gain;
        best = st;
      }
    }
    if (!best) break;
    best.added += 1;
  }

  return states
    .filter((s) => s.added > 0)
    .map((s) => ({
      name: s.p.name,
      skill: s.skill,
      nets: s.added,
      weeksBefore: s.weeks0,
      weeksAfter: weeksFor(s.p, s.skill, s.base + s.added, { coachLevel }),
      closesGap: s.gap,
    }))
    .sort((a, b) => b.nets - a.nets || a.weeksAfter - b.weeksAfter);
}

const fmtWeeks = (w: number) => (Number.isFinite(w) ? `~${w}w` : 'no nets');

function staffLine(f: Partial<ClubFinances> | null | undefined): string {
  if (!f) return 'Staff: not synced (assume a Superb coach, level 9).';
  const known: [string, number | undefined][] = [
    ['batting coaches', numOrUndef(f.battingCoaches)],
    ['bowling coaches', numOrUndef(f.bowlingCoaches)],
    ['keeping coaches', numOrUndef(f.keepingCoaches)],
    ['fielding coaches', numOrUndef(f.fieldingCoaches)],
    ['stamina coaches', numOrUndef(f.staminaCoaches)],
    ['sports psychologists', numOrUndef(f.psychologists)],
  ];
  const have = known.filter(([, v]) => v !== undefined) as [string, number][];
  if (!have.length) return 'Staff: counts not synced (assume a Superb coach, level 9).';
  const line = have.map(([k, v]) => `${v} ${k}`).join(', ');
  const noPsych = numOrUndef(f.psychologists) === 0 ? ' No psychologists, so Concentration and Consistency cannot be trained.' : '';
  return `Staff: ${line}.${noPsych} Forecasts assume a Superb coach (level 9).`;
}

/** The [TRAINING] block appended to Jarvis' manager briefing. */
export function buildTrainingBriefing(
  squad: BattrickPlayer[],
  finances?: Partial<ClubFinances> | null,
  gaps: RatingGapLike[] = []
): string {
  const lines: string[] = ['\n[TRAINING - computed by BattrickIQ, use these numbers]'];

  if (!squad.length) {
    lines.push('No squad synced, so no training advice is possible. Ask the manager to sync the roster first.');
    return lines.join('\n');
  }

  const used = netsUsed(squad);
  const free = Math.max(0, MAX_NETS_PER_WEEK - used);
  lines.push(
    used > MAX_NETS_PER_WEEK
      ? `- Nets: ${used} assigned, which is over the ${MAX_NETS_PER_WEEK}-a-week limit (check the synced nets).`
      : `- Nets: ${used} of ${MAX_NETS_PER_WEEK} assigned, ${free} free.`
  );
  lines.push(`- ${staffLine(finances)}`);

  const open = gaps.filter((g) => g.gap > 0);
  if (open.length) {
    lines.push(
      '- Team rating gaps (current vs target level): ' +
        open
          .slice(0, 5)
          .map((g) => `${g.key} ${g.current}/${g.target}`)
          .join(', ') +
        '. Training batting helps top/middle/lower order, bowling helps seam/spin, keeping helps WK.'
    );
  }

  const training: string[] = [];
  const idle: BattrickPlayer[] = [];
  for (const p of squad) {
    if (!p || !p.name) continue;
    const n = netsOf(p);
    const parts = (['batting', 'bowling', 'keeping', 'fielding', 'stamina'] as TrainSkill[])
      .filter((k) => n[k] > 0)
      .map((k) => `${k} x${n[k]} (level ${levelOf(p, k)}, ${fmtWeeks(weeksFor(p, k, n[k]))} to next level)`);
    if (parts.length) training.push(`  - ${p.name} (${p.age ?? '?'}y): ${parts.join('; ')}`);
    else idle.push(p);
  }
  if (training.length) {
    lines.push('- Currently training:');
    lines.push(...training.slice(0, 25));
  } else {
    lines.push('- Currently training: nobody has nets assigned.');
  }

  if (idle.length) {
    const youngest = [...idle]
      .sort((a, b) => (a.age || 99) - (b.age || 99))
      .slice(0, 6)
      .map((p) => {
        const prim = primaryOf({ name: p.name, age: p.age || 25, role: p.role, skills: (p.skills || {}) as any });
        return `${p.name} (${p.age ?? '?'}y, ${prim.key} ${prim.value}, ${fmtWeeks(weeksFor(p, prim.key as TrainSkill, 1))} with 1 net)`;
      });
    lines.push(`- No nets (${idle.length} players). Youngest, who gain most from training: ${youngest.join('; ')}.`);
  }

  if (free > 0) {
    const sug = suggestNetAllocation(squad, free, gaps);
    if (sug.length) {
      lines.push(`- Suggested use of the ${free} free net(s) (primary skills only, highest pops-per-week gain, gap skills favoured):`);
      for (const s of sug) {
        lines.push(
          `  - ${s.name}: +${s.nets} ${s.skill} net(s), ${fmtWeeks(s.weeksBefore)} -> ${fmtWeeks(s.weeksAfter)}` +
            (s.closesGap ? ` (helps ${s.closesGap} gap)` : '')
        );
      }
      lines.push('  Stamina and fielding nets are also possible; they are the manager\'s call and are not in this suggestion.');
    }
  } else if (used >= MAX_NETS_PER_WEEK) {
    lines.push('- All nets are in use: any new net means moving one from another player.');
  }

  return lines.join('\n');
}
