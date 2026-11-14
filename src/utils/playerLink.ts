/**
 * Is this link a PLAYER link, and what is the player's id?
 *
 * The parsers used to accept any href containing "id=<digits>". That also matches teamID=, leagueID=, matchID=,
 * userID= and so on, so a squad page's club link (teamID=555123, text "HairyBeanBags") was saved as a player.
 *
 * A player link has playerID / player_id in it. A bare "id=123" is only accepted on a page whose path says
 * "player" (e.g. playerdetails.asp?id=123).
 */
export function playerIdFromHref(href: string | null | undefined): string | undefined {
  if (!href) return undefined;
  const h = String(href).trim();
  const m = h.match(/(?:^|[?&#;/_-])player_?id(?:_|-|=|%3d|\s)*(\d+)/i);
  if (m) return m[1];
  const path = h.split('?')[0];
  if (/player/i.test(path)) {
    const b = h.match(/[?&]id=(\d+)/i);
    if (b) return b[1];
  }
  return undefined;
}

export const isPlayerHref = (href: string | null | undefined): boolean => playerIdFromHref(href) !== undefined;
