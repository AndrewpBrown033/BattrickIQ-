/**
 * Optional maximum price for the Estimator's transfer search.
 *
 * "Price" is what the player costs right now: the current bid when there is one, otherwise the asking price
 * (the same rule the costing code uses). A max of 0 / empty / undefined means "no limit". Listings that show no
 * price at all are kept (like the age filter) rather than silently hidden.
 */

interface PricedListing {
  askingPrice?: number;
  currentBid?: number;
}

/** Turn whatever is typed ("2,500,000", "£2.5m", "750k") into a whole-number limit, or undefined for none. */
export function parseMaxPrice(raw: string | number | null | undefined): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : undefined;
  const t = raw.toLowerCase().replace(/[£$€,\s]/g, '');
  const m = t.match(/^(\d+(?:\.\d+)?)([km]?)$/);
  if (!m) return undefined;
  const mult = m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1;
  const n = Math.round(parseFloat(m[1]) * mult);
  return n > 0 ? n : undefined;
}

export function listingPrice(l: PricedListing): number | undefined {
  const p = l.currentBid || l.askingPrice || 0;
  return p > 0 ? p : undefined;
}

export function passesMaxPrice(l: PricedListing, maxPrice: number | undefined | null): boolean {
  if (maxPrice == null || !(maxPrice > 0)) return true;
  const p = listingPrice(l);
  return p == null || p <= maxPrice;
}

export function filterListingsByMaxPrice<T extends PricedListing>(items: T[], maxPrice: number | undefined | null): T[] {
  if (maxPrice == null || !(maxPrice > 0)) return items;
  return items.filter((i) => passesMaxPrice(i, maxPrice));
}
