/**
 * Client-side fixture identity fixes:
 * 1) Infer bt_team_id from home/away ids when missing
 * 2) Ensure opponentTeamId is never our own club
 *
 * Parse-time persistence also lives in parser.ts (teamIdentity) when that ships.
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

/** Infer own team id from fixtures when bt_team_id is empty but team name matches a side. */
function tryPersistTeamIdFromKnownFixtures() {
  try {
    const ownName = (localStorage.getItem('bt_team_name') || '').toLowerCase().trim();
    const ownId = getOwnTeamId();
    if (ownId || !ownName || ownName === 'your club' || ownName === 'my club') return;
    const raw = localStorage.getItem('bt_fixtures');
    if (!raw) return;
    const games = JSON.parse(raw) as BattrickGame[];
    const candidates: Record<string, number> = {};
    for (const g of games) {
      const h = (g.homeTeam || '').toLowerCase();
      const a = (g.awayTeam || '').toLowerCase();
      if (
        g.venue === 'Home' &&
        g.homeTeamId &&
        (h === ownName || h.includes(ownName) || ownName.includes(h))
      ) {
        candidates[String(g.homeTeamId)] = (candidates[String(g.homeTeamId)] || 0) + 1;
      }
      if (
        g.venue === 'Away' &&
        g.awayTeamId &&
        (a === ownName || a.includes(ownName) || ownName.includes(a))
      ) {
        candidates[String(g.awayTeamId)] = (candidates[String(g.awayTeamId)] || 0) + 1;
      }
    }
    let best = '';
    let n = 0;
    for (const [id, c] of Object.entries(candidates)) {
      if (c > n) {
        n = c;
        best = id;
      }
    }
    if (best && n >= 1) {
      localStorage.setItem('bt_team_id', best);
      window.dispatchEvent(new Event('bt_team_id_updated'));
    }
  } catch {
    // ignore
  }
}

function run() {
  tryPersistTeamIdFromKnownFixtures();
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
  window.addEventListener('bt_team_name_updated', run);
}
