import type { BattrickPlayer } from '../types';
import { parsePlayerStatsPage, STATVIEW_TO_FORMAT } from './playerStats';

export interface BattrickCreds {
  username: string;
  password: string;
}

const VIEWS = [1, 8, 2]; // OD, BT20, FC

/** Download one player's OD / BT20 / FC career tables from playerdetails.asp. */
export async function downloadPlayerStats(
  playerId: string,
  creds: BattrickCreds
): Promise<NonNullable<BattrickPlayer['stats']>> {
  const out: Record<string, unknown> = {};
  for (const view of VIEWS) {
    const res = await fetch('/api/sync-battrick-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageName: 'playerdetails',
        pageUrl: `/nl/playerdetails.asp?statview=${view}&playerID=${encodeURIComponent(playerId)}`,
        username: creds.username,
        password: creds.password,
        sessionToken: localStorage.getItem('bt_sync_session') || '',
      }),
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('json')) {
      throw new Error(`Stats server unavailable (HTTP ${res.status}). The sync API may not be deployed.`);
    }
    const data = await res.json();
    if (data.sessionToken) {
      try { localStorage.setItem('bt_sync_session', data.sessionToken); } catch {}
    }
    if (!data.success || !data.html) throw new Error(data.error || `Could not load stats page (view ${view})`);
    const parsed = parsePlayerStatsPage(data.html);
    if (!parsed) throw new Error('Battrick returned a page without stats tables — re-authenticate and try again.');
    if (parsed.statview !== null && parsed.statview !== view) {
      throw new Error(`Battrick returned tab ${parsed.statview} instead of ${view}.`);
    }
    out[STATVIEW_TO_FORMAT[view]] = parsed.stats;
  }
  const fc = out.firstClass as any, od = out.oneDay as any, t20 = out.bt20 as any;
  return {
    firstClass: fc,
    oneDay: od,
    bt20: t20,
    downloadedAt: new Date().toISOString(),
  };
}

/** Save downloaded stats onto the player in the local squad and notify listeners. */
export function savePlayerStats(playerId: string, stats: NonNullable<BattrickPlayer['stats']>): void {
  const raw = localStorage.getItem('bt_squad');
  if (!raw) return;
  const squad: BattrickPlayer[] = JSON.parse(raw);
  const next = squad.map((p) => {
    if (p.id !== playerId) return p;
    const s = stats as any;
    return {
      ...p,
      stats,
      careerStats: {
        matches: s.firstClass.matches + s.oneDay.matches + s.bt20.matches,
        runs: s.firstClass.runs + s.oneDay.runs + s.bt20.runs,
        overs: s.firstClass.oversBowled + s.oneDay.oversBowled + s.bt20.oversBowled,
        fc: { matches: s.firstClass.matches, runs: s.firstClass.runs, overs: s.firstClass.oversBowled },
        od: { matches: s.oneDay.matches, runs: s.oneDay.runs, overs: s.oneDay.oversBowled },
        t20: { matches: s.bt20.matches, runs: s.bt20.runs, overs: s.bt20.oversBowled },
      },
    };
  });
  localStorage.setItem('bt_squad', JSON.stringify(next));
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('bt_cloud_backup_request'));
}
