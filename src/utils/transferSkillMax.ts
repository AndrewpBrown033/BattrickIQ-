/**
 * Maximum skill levels for the Estimator's "Skills to look for" search (batting, seam bowling, spin bowling).
 * Applied to the parsed transfer listings BEFORE ranking, because players matching none of the wanted skills are
 * added back to the shortlist as "On transfer list" and would otherwise reappear.
 *
 * A max of 0 / empty / undefined means "no limit". Levels use the same 0-20 scale as the minimums.
 */
import { isSpinBowler } from './transferList';

export type SkillMaxKey = 'batting' | 'seam' | 'spin';
export type SkillMaxes = Partial<Record<SkillMaxKey, number>>;

/** Skills that get a maximum box in the UI. */
export const SKILL_MAX_KEYS: SkillMaxKey[] = ['batting', 'seam', 'spin'];

interface ListingLike {
  skills?: { batting?: number; bowling?: number };
  bowlingType?: string;
}

/** Keep only the maxes that are real limits for skills that are switched on. */
export function activeSkillMaxes(
  maxes: Partial<Record<string, number>>,
  selected: readonly string[]
): SkillMaxes {
  const out: SkillMaxes = {};
  for (const k of SKILL_MAX_KEYS) {
    const v = Number(maxes[k]);
    if (selected.includes(k) && Number.isFinite(v) && v > 0) out[k] = Math.min(20, Math.round(v));
  }
  return out;
}

export function passesSkillMax(l: ListingLike, maxes: SkillMaxes): boolean {
  const batting = l.skills?.batting || 0;
  const bowling = l.skills?.bowling || 0;

  if (maxes.batting != null && batting > maxes.batting) return false;

  if (bowling > 0 && (maxes.seam != null || maxes.spin != null)) {
    const type = (l.bowlingType || '').trim();
    let limit: number | undefined;
    if (!type) {
      // Bowling type not shown on the listing: use the more generous limit rather than wrongly dropping him.
      const both = [maxes.seam, maxes.spin].filter((x): x is number => x != null);
      limit = both.length === 2 ? Math.max(...both) : undefined;
      // With only one of the two limits set and the type unknown, he could be either kind, so do not drop him.
    } else {
      limit = isSpinBowler(type) ? maxes.spin : maxes.seam;
    }
    if (limit != null && bowling > limit) return false;
  }
  return true;
}

export function filterListingsBySkillMax<T extends ListingLike>(items: T[], maxes: SkillMaxes): T[] {
  if (maxes.batting == null && maxes.seam == null && maxes.spin == null) return items;
  return items.filter((i) => passesSkillMax(i, maxes));
}

/** True when a maximum is lower than the minimum set for the same skill (would match nobody). */
export function maxBelowMin(min: number | undefined, max: number | undefined): boolean {
  return max != null && max > 0 && min != null && min > 0 && max < min;
}
