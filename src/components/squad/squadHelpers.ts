import type { BattrickPlayer } from '../../types';
import type { TeamRatingKey } from '../../utils/transferList';
import { labelToLevel } from '../../utils/transferList';

export type SubTab = 'roster' | 'training' | 'trading' | 'estimator';
export type EffortMode = 'TIE' | 'PAN' | 'GFI';

export const EFFORT_MULT: Record<EffortMode, number> = { TIE: 0.85, PAN: 1.0, GFI: 1.15 };

export function totalNets(p: BattrickPlayer): number {
  const n = p.nets;
  if (!n) return 0;
  return (n.batting || 0) + (n.bowling || 0) + (n.keeping || 0) + (n.fielding || 0) + (n.stamina || 0);
}

export function getTradeAction(p: BattrickPlayer): { action: 'KEEP' | 'SELL' | 'WATCH'; reason: string } {
  const age = p.age ?? 25;
  const primary = Math.max(p.skills?.batting ?? 0, p.skills?.bowling ?? 0, p.skills?.keeping ?? 0);
  const wage = p.wage ?? 0;
  const btr = p.btRating ?? 0;
  if (age >= 32 && primary <= 8) return { action: 'SELL', reason: 'Aging with limited primary skill' };
  if (age >= 30 && wage > 15000 && primary < 10) return { action: 'SELL', reason: 'High wage vs skill' };
  if (age <= 22 && primary >= 7) return { action: 'KEEP', reason: 'Young with development upside' };
  if (primary >= 11 || btr >= 12000) return { action: 'KEEP', reason: 'Core squad quality' };
  if (age >= 28 && primary <= 7) return { action: 'WATCH', reason: 'Fringe — monitor form & wage' };
  return { action: 'WATCH', reason: 'Review vs XI needs' };
}

export function estimateWeeksToNextLevel(level: number, age: number, netsOnSkill: number): number {
  const base = Math.max(4, (level + 1) * 3);
  const agePenalty = age >= 30 ? 1.4 : age >= 27 ? 1.2 : age <= 21 ? 0.85 : 1.0;
  const netsBoost = Math.max(0.35, 1 - netsOnSkill * 0.04);
  return Math.max(1, Math.round(base * agePenalty * netsBoost));
}

export const RATING_KEYS: { key: TeamRatingKey; label: string }[] = [
  { key: 'topOrder', label: 'Top Order' },
  { key: 'middleOrder', label: 'Middle Order' },
  { key: 'lowerOrder', label: 'Lower Order' },
  { key: 'seamBowling', label: 'Seam' },
  { key: 'spinBowling', label: 'Spin' },
  { key: 'fielding', label: 'Fielding' },
  { key: 'wicketKeeping', label: 'WK' },
];

export const defaultRatings = (): Record<TeamRatingKey, number> => ({
  topOrder: labelToLevel('elite'),
  middleOrder: labelToLevel('remarkable'),
  lowerOrder: labelToLevel('woeful'),
  seamBowling: labelToLevel('quality'),
  spinBowling: labelToLevel('wonderful'),
  fielding: labelToLevel('strong'),
  wicketKeeping: labelToLevel('exquisite'),
});
