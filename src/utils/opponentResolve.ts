/**
 * Work out who the OPPONENT really is for a fixture, and make sure a roster we are about to show as
 * "their players" is not actually our own squad.
 *
 * Why: the fixtures parser starts every game as `opponent = awayTeam, venue = 'Home'` and only corrects
 * that when it already knows our club. When it doesn't (or the name match is fuzzy) an AWAY game ends up
 * with OUR club recorded as the opponent - and then the squad fetch, the archive prediction and the
 * "Key Opponent Threats" panel all quietly use our own players.
 *
 * Pure functions only (no DOM / network), so they can be unit-tested.
 */

export interface TeamRef {
  name: string;
  teamId: string;
}

export interface OwnIdentity {
  teamId?: string;
  teamName?: string;
}

export interface FixtureSides {
  homeTeam?: string;
  awayTeam?: string;
  homeTeamId?: string | number;
  awayTeamId?: string | number;
  opponent?: string;
  opponentTeamId?: string | number;
  venue?: string;
}

export interface ResolvedOpponent {
  opponent: TeamRef;
  /** The other side of the fixture (our club, as far as we can tell) - used if `opponent` turns out to be us. */
  alternate: TeamRef | null;
  /** True when our own club id/name matched exactly one side, so the choice is not a guess. */
  certain: boolean;
}

/** Placeholder club names the app uses before it has learned the real one. */
const PLACEHOLDER_OWN_NAMES = new Set(['', 'my club', 'my battrick iq club', 'your club', 'my team']);

export function normalizeTeamName(s?: string | null): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/['’`]/g, '') // St. John's == St Johns
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Exact (case / punctuation-insensitive) equality. Deliberately NOT substring: "Royals" != "Royal West Herts GC". */
export function sameTeamName(a?: string | null, b?: string | null): boolean {
  const x = normalizeTeamName(a);
  return x !== '' && x === normalizeTeamName(b);
}

const idOf = (v: unknown): string => (v == null ? '' : String(v).trim());

export function resolveFixtureOpponent(f: FixtureSides, own: OwnIdentity = {}): ResolvedOpponent {
  const home: TeamRef = { name: (f.homeTeam || '').trim(), teamId: idOf(f.homeTeamId) };
  const away: TeamRef = { name: (f.awayTeam || '').trim(), teamId: idOf(f.awayTeamId) };

  const ownId = idOf(own.teamId);
  const ownNameRaw = (own.teamName || '').trim();
  const ownName = PLACEHOLDER_OWN_NAMES.has(normalizeTeamName(ownNameRaw)) ? '' : ownNameRaw;

  const isOwn = (t: TeamRef) =>
    (ownId !== '' && t.teamId !== '' && t.teamId === ownId) ||
    (ownName !== '' && t.name !== '' && sameTeamName(t.name, ownName));

  const homeOwn = isOwn(home);
  const awayOwn = isOwn(away);

  if (homeOwn !== awayOwn) {
    return homeOwn
      ? { opponent: away, alternate: home, certain: true }
      : { opponent: home, alternate: away, certain: true };
  }

  // Our identity can't separate the sides (unknown club, or it matched both / neither): fall back to what the
  // fixture already says, and keep the other side as the alternate in case that guess is us.
  const storedName = (f.opponent || '').trim();
  const storedId = idOf(f.opponentTeamId);

  let side: TeamRef | null = null;
  if (storedId && storedId === home.teamId) side = home;
  else if (storedId && storedId === away.teamId) side = away;
  else if (storedName && sameTeamName(storedName, home.name)) side = home;
  else if (storedName && sameTeamName(storedName, away.name)) side = away;
  else if (home.name || away.name || home.teamId || away.teamId) {
    // 'Away' means WE are away, so they are the home side. (The parser's default is 'Home'.)
    side = String(f.venue || '').toLowerCase() === 'away' ? home : away;
  }

  if (!side) {
    return { opponent: { name: storedName, teamId: storedId }, alternate: null, certain: false };
  }

  return {
    opponent: { name: side.name || storedName, teamId: side.teamId || storedId },
    alternate: side === home ? away : home,
    certain: false,
  };
}

// ---------------------------------------------------------------------------------------------
// "Is this roster actually ours?"
// ---------------------------------------------------------------------------------------------

export interface RosterPlayerLike {
  id?: string | number;
  playerId?: string | number;
  name?: string;
}

function mySets(mine: RosterPlayerLike[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const p of mine || []) {
    const a = idOf(p?.id);
    const b = idOf(p?.playerId);
    if (a) ids.add(a);
    if (b) ids.add(b);
    const n = normalizeTeamName(p?.name);
    if (n) names.add(n);
  }
  return { ids, names };
}

/** How many of `players` are (by Battrick id, or by exact name) in our own squad. */
export function countOverlap(players: RosterPlayerLike[], mine: RosterPlayerLike[]): number {
  const { ids, names } = mySets(mine);
  let n = 0;
  for (const p of players || []) {
    const id = idOf(p?.id);
    if ((id && ids.has(id)) || names.has(normalizeTeamName(p?.name))) n++;
  }
  return n;
}

/**
 * True when the roster is (mostly) our own club. Three shared players is already far beyond coincidence;
 * two is enough when they are at least half of a short roster.
 */
export function looksLikeMySquad(players: RosterPlayerLike[], mine: RosterPlayerLike[]): boolean {
  if (!players?.length || !mine?.length) return false;
  const n = countOverlap(players, mine);
  return n >= 3 || (n >= 2 && n / players.length >= 0.5);
}

/** Remove any individual player who is provably ours (same Battrick id) from an opponent roster. */
export function stripMine<T extends RosterPlayerLike>(players: T[], mine: RosterPlayerLike[]): T[] {
  const { ids } = mySets(mine);
  if (!ids.size) return players;
  return (players || []).filter((p) => {
    const id = idOf(p?.id);
    return !(id && ids.has(id));
  });
}
