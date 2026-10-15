/**
 * Own-club identity helpers for Battrick.
 * Authoritative team id lives in #pagetitle → office.asp?teamID=NNNN.
 * Persist as bt_team_id so Scout / fixtures never confuse our club with the opponent.
 */

const OWN_TEAM_ID_KEY = 'bt_team_id';
const OWN_TEAM_NAME_KEY = 'bt_team_name';

/** Extract teamID from Battrick #pagetitle (preferred) or office.asp links near the title. */
export function extractOwnTeamIdFromHtml(html: string): string | null {
  if (!html) return null;
  const pageTitle = html.match(
    /id=["']pagetitle["'][^>]*>[\s\S]{0,1500}?office\.asp\?teamID=(\d+)/i
  );
  if (pageTitle?.[1]) return pageTitle[1];

  // Squad / office H2 often ends with (NNNN)
  const h2 = html.match(/<h2[^>]*subheadernew[^>]*>[^<]*\((\d{3,})\)\s*</i);
  if (h2?.[1]) return h2[1];

  // myoffice redirect sometimes embeds teamID once in a canonical office link in the breadcrumb
  const breadcrumb = html.match(
    /(?:You are here|breadcrumb|navpath)[\s\S]{0,400}?office\.asp\?teamID=(\d+)/i
  );
  if (breadcrumb?.[1]) return breadcrumb[1];

  return null;
}

export function extractOwnTeamNameFromHtml(html: string): string | null {
  if (!html) return null;
  const m = html.match(
    /id=["']pagetitle["'][^>]*>[\s\S]{0,900}?<a[^>]*office\.asp\?teamID=\d+[^>]*>([^<]+)</i
  );
  if (m?.[1]) {
    const name = m[1].replace(/\s+/g, ' ').trim();
    if (name && name.length >= 2 && name.length < 80) return name;
  }
  return null;
}

export function getOwnTeamId(): string {
  try {
    return (localStorage.getItem(OWN_TEAM_ID_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function getOwnTeamName(): string {
  try {
    return (localStorage.getItem(OWN_TEAM_NAME_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Persist own team id (and optional name) from a synced Battrick page.
 * Returns the id that was stored or already known.
 */
export function persistOwnTeamFromHtml(html: string, opts?: { teamName?: string }): string {
  const id = extractOwnTeamIdFromHtml(html);
  const nameFromHtml = extractOwnTeamNameFromHtml(html);
  const name = (opts?.teamName || nameFromHtml || '').trim();

  try {
    if (id) {
      const prev = (localStorage.getItem(OWN_TEAM_ID_KEY) || '').trim();
      if (prev !== id) {
        localStorage.setItem(OWN_TEAM_ID_KEY, id);
        try {
          window.dispatchEvent(new CustomEvent('bt_team_id_updated', { detail: { teamId: id } }));
        } catch {
          window.dispatchEvent(new Event('bt_team_id_updated'));
        }
      }
    }
    if (
      name &&
      name !== 'My Club' &&
      name !== 'My Battrick IQ Club' &&
      name !== 'Your Club'
    ) {
      localStorage.setItem(OWN_TEAM_NAME_KEY, name);
      try {
        window.dispatchEvent(new Event('bt_team_name_updated'));
      } catch {}
    }
  } catch {
    // SSR / private mode
  }
  return id || getOwnTeamId();
}

/** True if this id is our own club (when known). */
export function isOwnTeamId(teamId: string | undefined | null): boolean {
  const own = getOwnTeamId();
  if (!own || !teamId) return false;
  return String(teamId).trim() === own;
}

/**
 * Given home/away ids + venue + own id, pick the opponent team id.
 * Never returns our own club id.
 */
export function resolveOpponentIdFromSides(opts: {
  homeTeamId?: string;
  awayTeamId?: string;
  venue?: 'Home' | 'Away' | string;
  ownTeamId?: string;
  explicitOpponentId?: string;
}): string {
  const own = (opts.ownTeamId || getOwnTeamId() || '').trim();
  const home = String(opts.homeTeamId || '').trim();
  const away = String(opts.awayTeamId || '').trim();
  const explicit = String(opts.explicitOpponentId || '').trim();
  const venue = String(opts.venue || '').toLowerCase();

  const notOwn = (id: string) => id && (!own || id !== own);

  if (explicit && notOwn(explicit)) return explicit;

  if (venue === 'home' && notOwn(away)) return away;
  if (venue === 'away' && notOwn(home)) return home;

  if (own && home === own && notOwn(away)) return away;
  if (own && away === own && notOwn(home)) return home;

  if (notOwn(away)) return away;
  if (notOwn(home)) return home;
  return '';
}
