/**
 * Briefing for the Lineup page's Jarvis panel. Pure (no DOM / network) so it can be unit-tested.
 * Everything Jarvis is told comes from the synced squad, the XI on screen and the next fixture; it is told
 * explicitly when the opponent squad is unavailable so it does not invent players.
 */
import { getSkillLabel } from '../types';
import { looksLikeMySquad, resolveFixtureOpponent, stripMine, type OwnIdentity } from './opponentResolve';

export interface BriefPlayer {
  id?: string | number;
  name: string;
  role?: string;
  bowlingType?: string;
  form?: number;
  fitness?: number;
  fitnessLabel?: string;
  skills?: { batting?: number; bowling?: number; keeping?: number; fielding?: number };
}

export interface BriefXIPlayer {
  name: string;
  role?: string;
  bowlingType?: string;
  batting?: number;
  bowling?: number;
  keeping?: number;
}

export interface BriefFixture {
  homeTeam?: string;
  awayTeam?: string;
  homeTeamId?: string | number;
  awayTeamId?: string | number;
  opponent?: string;
  opponentTeamId?: string | number;
  venue?: string;
  type?: string;
  date?: string;
  result?: string;
}

export interface OpponentBriefPlayer {
  id?: string | number;
  name: string;
  role?: string;
  bowlingType?: string;
  batting?: number;
  bowling?: number;
}

/** First fixture that has not been played yet (fixtures are stored in date order). */
export function nextUpcomingFixture<T extends BriefFixture>(fixtures: T[] | null | undefined): T | null {
  const list = Array.isArray(fixtures) ? fixtures : [];
  return list.find((f) => !f.result || f.result === 'Upcoming') || null;
}

const lvl = (key: string, v?: number) => getSkillLabel(key, Number(v) || 0);

export function buildLineupBriefing(input: {
  xi: BriefXIPlayer[];
  squad: BriefPlayer[];
  fixture: BriefFixture | null;
  own?: OwnIdentity;
  /** Scouted / cached opponent players, if any. Our own players are removed before use. */
  opponentPlayers?: OpponentBriefPlayer[];
}): { text: string; opponentName: string; opponentStatus: 'real' | 'unavailable' } {
  const { xi, squad, fixture } = input;

  let opponentName = '';
  let opponentPlayers: OpponentBriefPlayer[] = [];
  if (fixture) {
    opponentName = resolveFixtureOpponent(fixture, input.own || {}).opponent.name;
    const cand = input.opponentPlayers || [];
    // A roster that is really our own squad (what a bare squad.asp returns) is dropped, not shown as theirs.
    if (!looksLikeMySquad(cand, squad)) opponentPlayers = stripMine(cand, squad);
  }
  const opponentStatus = opponentPlayers.length > 0 ? 'real' : 'unavailable';

  const xiLines = xi.length
    ? xi.map((p, i) =>
        `${i + 1}. ${p.name} (${p.role || 'Player'}) - Bat: ${lvl('batting', p.batting)}, Bowl: ${lvl('bowling', p.bowling)} (${p.bowlingType && p.bowlingType !== 'None' ? p.bowlingType : 'N/A'}), Keep: ${p.keeping ?? 0}`
      ).join('\n')
    : 'No XI selected yet';

  const squadLines = squad.length
    ? squad.map((p, i) =>
        `${i + 1}. ${p.name} (${p.role || 'Player'}) - Bat: ${lvl('batting', p.skills?.batting)}, Bowl: ${lvl('bowling', p.skills?.bowling)} (${p.bowlingType || 'N/A'}), Keep: ${p.skills?.keeping ?? 0}, Form: ${p.form ?? 'N/A'}/10, Fitness: ${p.fitness ? p.fitness + '/10' : p.fitnessLabel || 'N/A'}`
      ).join('\n')
    : 'No squad loaded';

  const fixtureText = fixture
    ? `${fixture.homeTeam || 'Home'} vs ${fixture.awayTeam || 'Away'} - ${fixture.type || 'match'}${fixture.date ? ', ' + fixture.date : ''}${fixture.venue ? ', ' + fixture.venue : ''}`
    : 'No upcoming fixture found (give general selection advice from the squad only)';

  const opponentText =
    opponentStatus === 'real'
      ? opponentPlayers.slice(0, 11).map((p, i) =>
          `${i + 1}. ${p.name} (${p.role || 'Player'}) - Bat: ${lvl('batting', p.batting)}, Bowl: ${lvl('bowling', p.bowling)} (${p.bowlingType || 'N/A'})`
        ).join('\n')
      : 'No opponent players available';

  const text = `[NEXT FIXTURE]
${fixtureText}

[XI CURRENTLY PICKED - batting order]
${xiLines}

[MY FULL SQUAD - choose the XI from these]
${squadLines}

[OPPONENT: ${opponentName || 'unknown'} - squad is ${opponentStatus === 'real' ? 'real (scouted)' : 'unavailable'}]
${opponentText}
`;
  return { text, opponentName, opponentStatus };
}
