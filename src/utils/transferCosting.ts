/**
 * Transfer fee + forward wage cost helpers.
 * Battrick min contract is typically 6 weeks of wages on transfer.
 */

import type { TransferListing, BuyRecommendation } from './transferList';

export const DEFAULT_MIN_AGE = 17;
export const DEFAULT_MAX_AGE = 28;
/** Battrick-style minimum contract horizon after buying. */
export const MIN_CONTRACT_WEEKS = 6;
/** Optional season horizon for "can I carry this wage?" */
export const SEASON_WAGE_WEEKS = 16;

export type AgeFilter = {
  minAge?: number | null;
  maxAge?: number | null;
};

export type WageHorizon = 6 | 16;

export function passesAgeFilter(age: number | undefined, filter: AgeFilter): boolean {
  if (age == null || !Number.isFinite(age)) return true;
  const min = filter.minAge != null && filter.minAge > 0 ? filter.minAge : null;
  const max = filter.maxAge != null && filter.maxAge > 0 ? filter.maxAge : null;
  if (min != null && age < min) return false;
  if (max != null && age > max) return false;
  return true;
}

export function filterListingsByAge<T extends { age?: number }>(items: T[], filter: AgeFilter): T[] {
  if ((filter.minAge == null || filter.minAge <= 0) && (filter.maxAge == null || filter.maxAge <= 0)) {
    return items;
  }
  return items.filter((i) => passesAgeFilter(i.age, filter));
}

export type TotalOwnershipCost = {
  transferFee: number;
  weeklyWage: number;
  wageWeeks: number;
  wageTotal: number;
  totalCost: number;
  cashAfterFee?: number;
  cashAfterTotal?: number;
  solvent: boolean;
  feeAffordable: boolean;
};

export function estimateOwnershipCost(
  listing: Pick<TransferListing, 'askingPrice' | 'currentBid' | 'wage'>,
  opts: {
    cash?: number;
    weeklyOutgoings?: number;
    wageWeeks?: number;
    minReserve?: number;
  } = {}
): TotalOwnershipCost {
  const transferFee = Math.max(0, listing.currentBid || listing.askingPrice || 0);
  const weeklyWage = Math.max(0, listing.wage || 0);
  const wageWeeks = opts.wageWeeks ?? MIN_CONTRACT_WEEKS;
  const wageTotal = weeklyWage * wageWeeks;
  const totalCost = transferFee + wageTotal;
  const cash = opts.cash ?? 0;
  const minReserve = opts.minReserve ?? Math.max(50_000, (opts.weeklyOutgoings || 0) * 2);
  const cashAfterFee = cash - transferFee;
  const cashAfterTotal = cash - totalCost;
  const feeAffordable =
    transferFee <= 0 ? cash >= minReserve * 0.5 : cashAfterFee >= minReserve * 0.25;
  const solvent = weeklyWage <= 0 ? feeAffordable : cashAfterTotal >= minReserve * 0.1;
  return {
    transferFee,
    weeklyWage,
    wageWeeks,
    wageTotal,
    totalCost,
    cashAfterFee,
    cashAfterTotal,
    solvent,
    feeAffordable,
  };
}

export function formatOwnershipSummary(c: TotalOwnershipCost): string {
  const fee = `Fee £${c.transferFee.toLocaleString()}`;
  if (c.weeklyWage <= 0) return `${fee} · wage unknown`;
  return `${fee} + £${c.weeklyWage.toLocaleString()}/wk × ${c.wageWeeks}w = £${c.totalCost.toLocaleString()}`;
}

export function applyWageAwareFinance(
  rec: BuyRecommendation,
  opts: {
    cash?: number;
    weeklyOutgoings?: number;
    wageWeeks?: number;
    factorFinance: boolean;
    minReserve?: number;
  }
): BuyRecommendation & { ownership?: TotalOwnershipCost; wageNote?: string } {
  const ownership = estimateOwnershipCost(rec.listing, {
    cash: opts.cash,
    weeklyOutgoings: opts.weeklyOutgoings,
    wageWeeks: opts.wageWeeks,
    minReserve: opts.minReserve,
  });

  if (!opts.factorFinance) {
    return {
      ...rec,
      affordable: true,
      active: true,
      ownership,
      wageNote: formatOwnershipSummary(ownership),
    };
  }

  const active = ownership.feeAffordable && ownership.solvent;
  const reasons = [...rec.reasons];
  if (ownership.weeklyWage > 0) {
    reasons.push(formatOwnershipSummary(ownership));
    if (!ownership.solvent && ownership.feeAffordable) {
      reasons.push(`Wage strain over ${ownership.wageWeeks}w`);
    }
  } else if (ownership.feeAffordable) {
    reasons.push('Wage not on listing — fee only');
  }

  return {
    ...rec,
    affordable: ownership.feeAffordable,
    active,
    score: active ? rec.score : Math.max(0, rec.score - 8),
    reasons: reasons.slice(0, 5),
    ownership,
    wageNote: formatOwnershipSummary(ownership),
  };
}
