/**
 * Battrick secondary skills: Concentration & Consistency.
 *
 * Official mechanics (rules + keggut helpfile):
 * - Needs Sports Psychologists (assumed present unless callers pass hasSportsPsych=false).
 * - Concentration from batting OR keeping OR fielding nets.
 * - Consistency from bowling OR keeping OR fielding nets.
 * - Psychologists only attend the first net of each TYPE per day, so extra nets of the
 *   same type do not stack for secondaries.
 * - Combining different qualifying types speeds pops (BA+F ≈ half of single; BA+WK+F best).
 * - Age works OPPOSITE to technical skills: older players train secondaries faster.
 *
 * Single-type weeks-to-pop (helpfile):
 *   17→14.2 … −0.6/yr … 34+→4.0
 */

/** Weeks to next secondary pop for one qualifying net type, by integer age 17–35. */
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

/** @deprecated Kept for import compatibility; secondaries are not a fraction of primary speed. */
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

/**
 * Count distinct qualifying net TYPES for a secondary skill.
 * Same-type multi-nets do not stack (psychologists once per type).
 */
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
 * Uses helpfile combo multipliers:
 *   1 type → single table
 *   2 types → ~0.5× (e.g. BA+F, BO+F)
 *   3 types → ~5.2/14.2 at 17 (BA+WK+F / BO+WK+F), floor 4.0
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

  let weeks = secondaryBaseWeeks(playerAge);
  if (types >= 3) {
    // Helpfile BA+WK+F / BO+WK+F: 5.2 @17 → 4.0 from ~21
    weeks = Math.max(4.0, secondaryBaseWeeks(playerAge) * (5.2 / 14.2));
  } else if (types === 2) {
    // Helpfile BA+F / BO+F: ~half of single, floor 4.0
    weeks = Math.max(4.0, secondaryBaseWeeks(playerAge) * 0.5);
  }

  return parseFloat(weeks.toFixed(1));
}

/**
 * Backward-compatible wrapper used by older call sites.
 * primary / primaryNets / coachLevel map onto the new net-type model.
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
