/**
 * Post-process transfer listings: age filter + wage-aware ranking.
 */
import {
  rankBuyRecommendations,
  type TransferListing,
  type SquadGapNeed,
  type BuyRecommendation,
} from './transferList';
import {
  filterListingsByAge,
  applyWageAwareFinance,
  type AgeFilter,
  type WageHorizon,
} from './transferCosting';

export function buildTransferShortlist(
  listings: TransferListing[],
  needs: SquadGapNeed[],
  opts: {
    cash?: number;
    weeklyOutgoings?: number;
    factorFinance: boolean;
    minAge?: number;
    maxAge?: number;
    wageWeeks?: WageHorizon;
  }
): BuyRecommendation[] {
  const ageFilter: AgeFilter = {
    minAge: opts.minAge,
    maxAge: opts.maxAge,
  };
  const aged = filterListingsByAge(listings, ageFilter);
  let recs = rankBuyRecommendations(aged, needs, {
    cash: opts.cash,
    weeklyOutgoings: opts.weeklyOutgoings,
    factorFinance: opts.factorFinance,
  });

  if (recs.length < aged.length) {
    const have = new Set(recs.map((r) => r.listing.playerId));
    for (const listing of aged) {
      if (have.has(listing.playerId)) continue;
      const cost = listing.currentBid || listing.askingPrice || 0;
      recs.push({
        listing,
        score: 0,
        reasons: ['On transfer list'],
        affordable: true,
        cost,
        active: true,
      });
    }
  }

  const wageWeeks = opts.wageWeeks ?? 6;
  recs = recs.map((r) =>
    applyWageAwareFinance(r, {
      cash: opts.cash,
      weeklyOutgoings: opts.weeklyOutgoings,
      wageWeeks,
      factorFinance: opts.factorFinance,
    })
  );

  return recs.sort((a, b) => b.score - a.score);
}
