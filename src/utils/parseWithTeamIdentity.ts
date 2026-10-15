/**
 * Wrap parseBattrickPage so own-club teamID is always stored from #pagetitle
 * on squad / fixtures / pavilion / office HTML.
 */
import { parseBattrickPage as baseParse } from '../parser';
import { persistOwnTeamFromHtml } from './teamIdentity';

export function parseBattrickPage(content: string, forcedType?: string) {
  try {
    persistOwnTeamFromHtml(content);
  } catch {
    // ignore storage errors
  }
  return baseParse(content, forcedType);
}
