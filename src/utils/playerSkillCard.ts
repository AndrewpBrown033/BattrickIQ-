/**
 * Skill card + "Jarvis team alignment" for a transfer listing (Estimator results).
 *
 * Pure functions (no DOM / network). The alignment score is computed in code from the synced squad, the
 * rating targets and cash via the same buy-fit engine the Watch page uses - it is not an LLM guess.
 */
import { evaluateScoutBuyFit, type BuyFitPlayer, type BuyFitVerdict } from './scoutBuyFit';

export type SkillKey = 'batting' | 'bowling' | 'keeping' | 'fielding' | 'stamina' | 'concentration' | 'consistency';

export const SKILL_ROWS: { key: SkillKey; label: string }[] = [
  { key: 'batting', label: 'Batting' },
  { key: 'bowling', label: 'Bowling' },
  { key: 'keeping', label: 'Keeping' },
  { key: 'fielding', label: 'Fielding' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'concentration', label: 'Concentration' },
  { key: 'consistency', label: 'Consistency' },
];

const MAX_LEVEL = 20;
/** "strong" on Battrick's scale. At or above this a skill counts as a strength. */
export const STRENGTH_LEVEL = 9;

export interface SkillCardRow {
  key: SkillKey;
  label: string;
  value: number;
  /** 0-100, for a bar */
  pct: number;
  isStrength: boolean;
}

export interface SkillCard {
  rows: SkillCardRow[];
  /** Up to 3 best skills that reach STRENGTH_LEVEL, best first. */
  strengths: string[];
  /** False when the listing carried no skills at all (nothing to show, nothing to score). */
  hasSkills: boolean;
}

export function buildSkillCard(skills?: Partial<Record<SkillKey, number>> | null): SkillCard {
  const rows: SkillCardRow[] = [];
  for (const { key, label } of SKILL_ROWS) {
    const raw = Number(skills?.[key]);
    if (!Number.isFinite(raw) || raw <= 0) continue; // only skills that were actually read
    const value = Math.min(MAX_LEVEL, Math.round(raw));
    rows.push({ key, label, value, pct: Math.round((value / MAX_LEVEL) * 100), isStrength: value >= STRENGTH_LEVEL });
  }
  const strengths = rows
    .filter((r) => r.isStrength)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((r) => r.label);
  return { rows, strengths, hasSkills: rows.length > 0 };
}

export interface TeamAlignment {
  /** 0-100 */
  score: number;
  verdict: 'BUY' | 'MAYBE' | 'PASS';
  tone: 'good' | 'ok' | 'poor';
  summary: string;
  replaces?: string;
}

export function alignmentTone(score: number): TeamAlignment['tone'] {
  return score >= 70 ? 'good' : score >= 45 ? 'ok' : 'poor';
}

export function teamAlignment(
  candidate: BuyFitPlayer,
  squad: BuyFitPlayer[],
  opts: { cash?: number; ratingTargets?: Record<string, number>; factorFinance?: boolean } = {}
): TeamAlignment | null {
  if (!squad.length) return null; // no squad synced: an honest "no score" beats a made-up one
  if (!Object.values(candidate.skills || {}).some((v) => Number(v) > 0)) return null;
  const v: BuyFitVerdict = evaluateScoutBuyFit(candidate, squad, {
    cash: opts.cash,
    ratingTargets: opts.ratingTargets as any,
    factorFinance: opts.factorFinance,
  });
  const score = Math.max(0, Math.min(100, Math.round(v.score)));
  return { score, verdict: v.verdict, tone: alignmentTone(score), summary: v.summary, replaces: v.replaces };
}
