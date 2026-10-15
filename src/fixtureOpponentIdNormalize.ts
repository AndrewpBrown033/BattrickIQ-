/**
 * Side-effect module: re-process fixtures in localStorage so
 * opponentTeamId never equals our own club.
 * Full parse-time persistence lives in parser.ts (teamIdentity).
 */
import type { BattrickGame } from './types';
import {
  getOwnTeamId,
  resolveOpponentIdFromSides,
} from './utils/teamIdentity';

function normalizeFixtures(games: BattrickGame[]): BattrickGame[] {
  const own = getOwnTeamId();
  let changed = false;
  const next = games.map((g) => {
    const resolved =
      resolveOpponentIdFromSides({
        homeTeamId: g.homeTeamId,
        awayTeamId: g.awayTeamId,
        venue: g.venue,
        ownTeamId: own,
        explicitOpponentId: g.opponentTeamId,
      }) || undefined;
    if (resolved && resolved !== g.opponentTeamId) {
      changed = true;
      return { ...g, opponentTeamId: resolved };
    }
    if (own && g.opponentTeamId && String(g.opponentTeamId) === own) {
      changed = true;
      return { ...g, opponentTeamId: resolved };
    }
    return g;
  });
  return changed ? next : games;
}

function run() {
  try {
    const raw = localStorage.getItem('bt_fixtures');
    if (!raw) return;
    const games = JSON.parse(raw) as BattrickGame[];
    if (!Array.isArray(games) || !games.length) return;
    const normalized = normalizeFixtures(games);
    if (normalized !== games) {
      localStorage.setItem('bt_fixtures', JSON.stringify(normalized));
      window.dispatchEvent(new Event('storage'));
    }
  } catch {
    // ignore
  }
}

if (typeof window !== 'undefined') {
  run();
  window.addEventListener('storage', run);
  window.addEventListener('bt_team_id_updated', run);
}

export {};
