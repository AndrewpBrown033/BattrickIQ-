/**
 * Merge a freshly-synced Draw (fixtures.asp) into the fixtures already stored. Pure, so it can be tested.
 *
 * The page is the source of truth for dates, teams, venue, type and result, but it never carries the numeric
 * team IDs (those are backfilled from matchinfo.asp), and matches already played may have been enriched
 * elsewhere. So: fields the new page actually provides win; anything it leaves out is kept from what we had;
 * and played matches that have dropped off the page are kept rather than lost.
 */
import type { BattrickGame } from '../types';

export function fixtureKey(f: Partial<BattrickGame>): string {
  if (f.matchId) return `m:${f.matchId}`;
  return `d:${f.date || ''}|${(f.homeTeam || '').toLowerCase()}|${(f.awayTeam || '').toLowerCase()}|${(f.opponent || '').toLowerCase()}`;
}

function definedOnly<T extends object>(o: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

export function isPlayed(f: BattrickGame): boolean {
  return f.section === 'previous' || (!!f.result && f.result !== 'Upcoming');
}

export function mergeFixtures(existing: BattrickGame[], incoming: BattrickGame[]): BattrickGame[] {
  const old = new Map<string, BattrickGame>();
  for (const f of existing || []) old.set(fixtureKey(f), f);

  const seen = new Set<string>();
  const merged = (incoming || []).map((n) => {
    const key = fixtureKey(n);
    seen.add(key);
    const o = old.get(key);
    return o ? ({ ...o, ...definedOnly(n) } as BattrickGame) : n;
  });

  // Played matches that are no longer on the page keep their history (results, enriched IDs).
  const keptHistory = (existing || []).filter((f) => !seen.has(fixtureKey(f)) && isPlayed(f));
  return [...keptHistory, ...merged];
}

export function countUpcoming(fixtures: BattrickGame[]): number {
  return fixtures.filter((f) => (f.section ? f.section === 'upcoming' : !isPlayed(f))).length;
}
