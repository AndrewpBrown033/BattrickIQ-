/**
 * Resolve home/away team IDs from matchinfo.asp "More Details" box,
 * and backfill fixtures so Scout rarely needs a manual team ID.
 */
import type { BattrickGame } from '../types';
import { getOwnTeamId, resolveOpponentIdFromSides } from './teamIdentity';

function norm(s: string): string {
  return (s || '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function looseMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.includes(a)) return true;
  if (b.length >= 3 && a.includes(b)) return true;
  return false;
}

/**
 * Parse both club office.asp?teamID= links from matchinfo HTML.
 * Regex-first so partial/server HTML still works; DOM as secondary.
 */
export function extractTeamIdsFromMatchInfoHtml(
  content: string,
  homeTeamName?: string,
  awayTeamName?: string
): { homeTeamId?: string; awayTeamId?: string } {
  if (!content) return {};

  const entries: { id: string; name: string }[] = [];

  const moreIdx = content.search(/more\s+details/i);
  const slice =
    moreIdx >= 0 ? content.slice(moreIdx, moreIdx + 4000) : content;

  const re =
    /office\.asp\?teamID=(\d+)[^"']*["'][^>]*>([^<]{1,80})</gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(slice)) !== null) {
    const id = m[1];
    if (!id || seen.has(id)) continue;
    if (id === '0' || id === '-2' || Number(id) < 1) continue;
    seen.add(id);
    entries.push({ id, name: m[2].replace(/\s+/g, ' ').trim() });
    if (entries.length >= 6) break;
  }

  if (entries.length < 2 && typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(content, 'text/html');
      const moreDetailsHeading = Array.from(doc.querySelectorAll('h3')).find((h) =>
        /more details/i.test(h.textContent || '')
      );
      const box =
        moreDetailsHeading?.closest('.menu-box') ||
        moreDetailsHeading?.parentElement ||
        null;
      const links = Array.from(
        (box || doc).querySelectorAll('a[href*="office.asp?teamID="]')
      );
      for (const a of links) {
        const idMatch = (a.getAttribute('href') || '').match(/teamID=(\d+)/i);
        const id = idMatch?.[1];
        if (!id || seen.has(id) || Number(id) < 1) continue;
        seen.add(id);
        entries.push({ id, name: (a.textContent || '').trim() });
      }
    } catch {
      // ignore
    }
  }

  if (entries.length === 0) return {};

  const homeN = norm(homeTeamName || '');
  const awayN = norm(awayTeamName || '');

  let homeTeamId = homeN
    ? entries.find((e) => looseMatch(norm(e.name), homeN))?.id
    : undefined;
  let awayTeamId = awayN
    ? entries.find((e) => looseMatch(norm(e.name), awayN))?.id
    : undefined;

  if (entries.length >= 2) {
    if (!homeTeamId) homeTeamId = entries[0].id;
    if (!awayTeamId) awayTeamId = entries[1].id;
  }

  return { homeTeamId, awayTeamId };
}

export function applyTeamIdsToFixture(
  f: BattrickGame,
  homeTeamId?: string,
  awayTeamId?: string
): BattrickGame {
  const nextHome = homeTeamId || f.homeTeamId;
  const nextAway = awayTeamId || f.awayTeamId;
  const opponentTeamId =
    resolveOpponentIdFromSides({
      homeTeamId: nextHome,
      awayTeamId: nextAway,
      venue: f.venue,
      ownTeamId: getOwnTeamId(),
      explicitOpponentId: f.opponentTeamId,
    }) || undefined;
  return {
    ...f,
    homeTeamId: nextHome,
    awayTeamId: nextAway,
    opponentTeamId,
  };
}

export type EnrichAuth = {
  username: string;
  password: string;
  sessionToken?: string;
};

/**
 * Fetch matchinfo for fixtures missing team IDs and persist updates.
 */
export async function enrichFixtureTeamIds(
  fixtures: BattrickGame[],
  auth: EnrichAuth,
  opts?: { maxLookups?: number; onProgress?: (msg: string) => void }
): Promise<BattrickGame[]> {
  const max = opts?.maxLookups ?? 20;
  const targets = fixtures
    .filter(
      (f) =>
        f.matchId &&
        (!f.homeTeamId || !f.awayTeamId || !f.opponentTeamId)
    )
    .slice(0, max);

  if (!targets.length) return fixtures;

  let sessionToken = auth.sessionToken || localStorage.getItem('bt_sync_session') || '';
  let updated = [...fixtures];
  let resolved = 0;

  for (const target of targets) {
    try {
      opts?.onProgress?.(
        `Resolving team IDs: ${target.opponent || target.matchId}…`
      );
      const response = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: 'matchinfo',
          matchId: target.matchId,
          pageUrl:
            target.matchUrl ||
            `https://www.battrick.org/nl/matchinfo.asp?matchID=${target.matchId}`,
          username: auth.username,
          password: auth.password,
          sessionToken,
        }),
      });
      const data = await response.json().catch(() => ({} as any));
      if (data.sessionToken) {
        sessionToken = data.sessionToken;
        try {
          localStorage.setItem('bt_sync_session', data.sessionToken);
        } catch {}
      }
      if (!response.ok || !data.success || !data.html) continue;

      const { homeTeamId, awayTeamId } = extractTeamIdsFromMatchInfoHtml(
        data.html,
        target.homeTeam,
        target.awayTeam
      );
      if (!homeTeamId && !awayTeamId) continue;

      updated = updated.map((f) =>
        f.matchId === target.matchId
          ? applyTeamIdsToFixture(f, homeTeamId, awayTeamId)
          : f
      );
      resolved += 1;

      try {
        localStorage.setItem('bt_fixtures', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch {}
    } catch {
      // continue
    }
  }

  if (resolved > 0) {
    opts?.onProgress?.(`Resolved team IDs for ${resolved} fixture(s).`);
  }
  return updated;
}

export function countFixturesMissingOpponentId(fixtures: BattrickGame[]): number {
  return fixtures.filter(
    (f) => f.matchId && !String((f as any).opponentTeamId || '').trim()
  ).length;
}
