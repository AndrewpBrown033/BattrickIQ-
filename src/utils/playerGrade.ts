/**
 * Player grading: two numbers instead of one.
 *
 *  - Quality   = skills only, weighted for the player's role. Stable week to week.
 *  - Selection = Quality adjusted for the form and fitness that matter for his job
 *                this week. This is what the lineup uses.
 *
 * What is known (Battrick rules / community help file): batting form and bowling form are
 * tracked separately, bowling form also affects keeping, fitness (PFL) has a major effect,
 * concentration matters more for batters and consistency for bowlers, more so in First Class.
 * The exact weights are NOT public, so every number here is an estimate. The form/fitness
 * modifiers match the ones in the Lineup Optimizer so both screens agree.
 */
import { SKILL_LEVELS } from '../types';
import type { BattrickPlayer, MatchFormat } from '../types';

/** Weight of the secondary skill (concentration for batting, consistency for bowling). */
export const SECONDARY_WEIGHT: Record<MatchFormat, number> = {
  'First Class': 0.35,
  'One Day': 0.25,
  Twenty20: 0.15,
};

const clamp10 = (v: number) => Math.min(10, Math.max(0, v));

/** Form/fitness label ("superb", "proficient"...) or number -> 0..10. */
export function toTen(label: string | undefined, fallback: number): number {
  if (!label) return clamp10(fallback);
  const cleaned = label.trim().toLowerCase();
  const v = SKILL_LEVELS.findIndex((l) => cleaned.includes(l));
  return v > 0 ? clamp10(v) : clamp10(fallback);
}

export function battingForm(p: BattrickPlayer): number {
  return toTen(p.battingFormLabel, p.form ?? 5);
}
export function bowlingForm(p: BattrickPlayer): number {
  return toTen(p.bowlingFormLabel, p.form ?? 5);
}
export function fitnessOf(p: BattrickPlayer): number {
  return clamp10(p.fitness ?? 5);
}

/** Same modifiers as the Lineup Optimizer: sublime form = 100%, woeful = -20%; saturated = 100%, shattered = -55%. */
export const formModifier = (form: number) => 0.8 + (clamp10(form) / 10) * 0.2;
export const fitnessModifier = (fit: number) => 0.45 + (clamp10(fit) / 10) * 0.55;

export interface PlayerGrade {
  /** Skills only. */
  quality: number;
  /** Quality x relevant form x fitness. */
  selection: number;
  /** Which form number was applied, for display. */
  formUsed: { kind: 'batting' | 'bowling' | 'both'; value: number };
  fitness: number;
}

export function getPlayerGrade(p: BattrickPlayer, format: MatchFormat = 'One Day'): PlayerGrade {
  const s = p.skills;
  const w = SECONDARY_WEIGHT[format];
  const batVal = s.batting + w * s.concentration;
  const bowlVal = s.bowling + w * s.consistency;
  const support = 0.15 * s.stamina + 0.15 * s.experience + 0.05 * (s.fielding || 0);
  const bf = battingForm(p);
  const wf = bowlingForm(p);

  let quality: number;
  let formValue: number;
  let kind: PlayerGrade['formUsed']['kind'];

  switch (p.role) {
    case 'Bowler':
      quality = bowlVal + 0.1 * s.batting + support;
      formValue = wf; kind = 'bowling';
      break;
    case 'Keeper':
      // Keeping ability is also affected by bowling form (Battrick rules), batting form drives his runs.
      quality = s.keeping + 0.5 * batVal + support;
      formValue = (bf + wf) / 2; kind = 'both';
      break;
    case 'All-rounder':
      quality = 0.7 * batVal + 0.7 * bowlVal + support;
      formValue = (bf + wf) / 2; kind = 'both';
      break;
    case 'Batter':
      quality = batVal + 0.1 * s.bowling + support;
      formValue = bf; kind = 'batting';
      break;
    default: {
      // Prospect / unknown: grade on whichever skill is his best.
      const best = Math.max(batVal, bowlVal, s.keeping);
      quality = best + support;
      formValue = bowlVal > batVal ? wf : bf;
      kind = bowlVal > batVal ? 'bowling' : 'batting';
    }
  }

  const fitness = fitnessOf(p);
  return {
    quality: parseFloat(quality.toFixed(1)),
    selection: parseFloat((quality * formModifier(formValue) * fitnessModifier(fitness)).toFixed(1)),
    formUsed: { kind, value: Math.round(formValue * 10) / 10 },
    fitness,
  };
}

/** Selection score only (used by the legacy getPlayerWeightedScore). */
export function gradePlayerSelection(p: BattrickPlayer, format: MatchFormat = 'One Day'): number {
  return getPlayerGrade(p, format).selection;
}
