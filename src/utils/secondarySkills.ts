/**
 * Battrick secondary skills: Concentration & Consistency.
 *
 * Official mechanics (rules + keggut / Battrick helpfile):
 * - Needs Sports Psychologists.
 * - Concentration: batting OR keeping OR fielding nets.
 * - Consistency: bowling OR keeping OR fielding nets.
 * - Psychologists attend the first net of each TYPE only — same-type multi-nets do not stack.
 * - Combining different qualifying types speeds pops.
 * - Age is inverted vs technical skills: older players train secondaries faster.
 *
 * Helpfile weeks-to-pop (single qualifying type):
 *   age 17 → 14.2 … −0.6/yr … age 34+ → 4.0
 * Dual (e.g. BA+F / BO+F): ~half of single, floor 4.0
 * Triple (BA+WK+F / BO+WK+F): 5.2 @17 → 4.0 from ~21
 */

/** Single net-type weeks by age 17–35 (helpfile). */
export const SECONDARY_SINGLE_WEEKS_BY_AGE: Record<number, number> = {
  17: 14.2,
  18: 13.6,
  19: 13.0,
  20: 12.4,
  21: 11.8,
  22: 11.2,
  23: 10.6,
  24: 10.0,
  25: 9.4,
  26: 8.8,
  27: 8.2,
  28: 7.6,
  29: 7.0,
  30: 6.4,
  31: 5.8,
  32: 5.2,
  33: 4.6,
  34: 4.0,
  35: 4.0,
};

/** Dual types (BA+F, BO+F, …) — helpfile ~half single, floor 4.0. */
export const SECONDARY_DUAL_WEEKS_BY_AGE: Record<number, number> = {
  17: 7.1,
  18: 6.8,
  19: 6.5,
  20: 6.2,
  21: 5.9,
  22: 5.6,
  23: 5.3,
  24: 5.0,
  25: 4.7,
  26: 4.3,
  27: 4.0,
  28: 4.0,
  29: 4.0,
  30: 4.0,
  31: 4.0,
  32: 4.0,
  33: 4.0,
  34: 4.0,
  35: 4.0,
};

/** Triple types (BA+WK+F / BO+WK+F) — helpfile. */
export const SECONDARY_TRIPLE_WEEKS_BY_AGE: Record<number, number> = {
  17: 5.2,
  18: 4.9,
  19: 4.6,
  20: 4.3,
  21: 4.0,
  22: 4.0,
  23: 4.0,
  24: 4.0,
  25: 4.0,
  26: 4.0,
  27: 4.0,
  28: 4.0,
  29: 4.0,
  30: 4.0,
  31: 4.0,
  32: 4.0,
  33: 4.0,
  34: 4.0,
  35: 4.0,
};

/** @deprecated Secondaries are not a fraction of primary skill speed. */
export const SECONDARY_TRAINING_SYNERGY = 0.25;

export type SecondarySkill = 'concentration' | 'consistency';

export type SecondaryNets = {
  batting?: number;
  bowling?: number;
  keeping?: number;
  fielding?: number;
};

function clampAge(age: number): number {
  return Math.max(17, Math.min(35, Math.round(Number(age) || 17)));
}

export function secondaryBaseWeeks(playerAge: number): number {
  const a = clampAge(playerAge);
  return SECONDARY_SINGLE_WEEKS_BY_AGE[a] ?? 4.0;
}

/** Count distinct qualifying net TYPES (same-type multi-nets do not stack). */
export function countQualifyingNetTypes(
  skill: SecondarySkill,
  nets: SecondaryNets
): number {
  const bat = (nets.batting || 0) > 0;
  const bowl = (nets.bowling || 0) > 0;
  const keep = (nets.keeping || 0) > 0;
  const field = (nets.fielding || 0) > 0;
  if (skill === 'concentration') {
    return [bat, keep, field].filter(Boolean).length;
  }
  return [bowl, keep, field].filter(Boolean).length;
}

/**
 * Weeks to the next concentration or consistency pop.
 * Tables from Battrick helpfile Training page.
 */
export function weeksToSecondaryPop(
  skill: SecondarySkill,
  secondaryLevel: number,
  playerAge: number,
  nets: SecondaryNets,
  hasSportsPsych: boolean = true
): number {
  if (secondaryLevel >= 20) return 0;
  if (!hasSportsPsych) return Infinity;

  const types = countQualifyingNetTypes(skill, nets);
  if (types <= 0) return Infinity;

  const a = clampAge(playerAge);
  let weeks: number;
  if (types >= 3) {
    weeks = SECONDARY_TRIPLE_WEEKS_BY_AGE[a] ?? 4.0;
  } else if (types === 2) {
    weeks = SECONDARY_DUAL_WEEKS_BY_AGE[a] ?? 4.0;
  } else {
    weeks = SECONDARY_SINGLE_WEEKS_BY_AGE[a] ?? 4.0;
  }

  return parseFloat(Number(weeks).toFixed(1));
}

/**
 * Backward-compatible wrapper for older call sites (parser / PlayerDetails).
 * Prefer weeksToSecondaryPop when full net breakdown is available.
 */
export function estimateSecondarySkillWeeks(
  _primaryLevel: number,
  secondaryLevel: number,
  playerAge: number,
  primaryNets: number,
  _coachLevel: number,
  primary: 'batting' | 'bowling',
  extra?: SecondaryNets
): number {
  const skill: SecondarySkill = primary === 'batting' ? 'concentration' : 'consistency';
  const nets: SecondaryNets = {
    batting: extra?.batting ?? (primary === 'batting' ? primaryNets : 0),
    bowling: extra?.bowling ?? (primary === 'bowling' ? primaryNets : 0),
    keeping: extra?.keeping ?? 0,
    fielding: extra?.fielding ?? 0,
  };
  return weeksToSecondaryPop(skill, secondaryLevel, playerAge, nets, true);
}
