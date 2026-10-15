/** Hash-based routing for SPA navigation + browser back button. */

export type AppTab =
  | 'summary'
  | 'fixtures'
  | 'squad'
  | 'lineup'
  | 'scout'
  | 'league'
  | 'wage'
  | 'stadium'
  | 'coach'
  | 'jarvis-settings'
  | 'coach-history'
  | 'sync'
  | 'rules'
  | 'admin'
  | 'player-details';

export type SquadSubTab = 'roster' | 'training' | 'trading' | 'estimator';

/** Focus a Team Ratings gap when opening Estimator (e.g. middleOrder). */
export type RatingGapFocus = string;

export type WageSubTab = 'forecast' | 'health';

export type RouteState = {
  tab: AppTab;
  squadSub?: SquadSubTab;
  /** Estimator gap focus key (TeamRatingKey string) */
  ratingGap?: string;
  /** Auto-run transfer scan when landing on estimator */
  autoScan?: boolean;
  wageSub?: WageSubTab;
  playerId?: string | null;
};

const VALID_TABS = new Set<string>([
  'summary',
  'fixtures',
  'squad',
  'lineup',
  'scout',
  'league',
  'wage',
  'stadium',
  'coach',
  'jarvis-settings',
  'coach-history',
  'sync',
  'rules',
  'admin',
  'player-details',
]);

export function parseHash(hash?: string): RouteState {
  const raw = ((hash ?? (typeof window !== 'undefined' ? window.location.hash : '')) || '').replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);

  if (parts.length === 0) return { tab: 'summary' };

  const head = parts[0].toLowerCase();

  if (head === 'player') {
    return { tab: 'player-details', playerId: parts[1] || null };
  }

  if (!VALID_TABS.has(head)) return { tab: 'summary' };

  const tab = head as AppTab;
  const state: RouteState = { tab };

  if (tab === 'squad' && parts[1]) {
    const sub = parts[1].toLowerCase();
    if (sub === 'roster' || sub === 'training' || sub === 'trading' || sub === 'estimator') {
      state.squadSub = sub;
    }
    // #/squad/estimator/middleOrder — focus that rating gap
    if (sub === 'estimator' && parts[2]) {
      state.ratingGap = parts[2];
    }
    if (sub === 'estimator' && parts.includes('scan')) {
      state.autoScan = true;
    }
  }

  if (tab === 'wage' && parts[1]) {
    const sub = parts[1].toLowerCase();
    if (sub === 'forecast' || sub === 'health') state.wageSub = sub;
  }

  return state;
}

export function buildHash(route: RouteState): string {
  if (route.tab === 'player-details') {
    return route.playerId ? `#/player/${route.playerId}` : '#/squad';
  }
  if (route.tab === 'squad' && route.squadSub && route.squadSub !== 'roster') {
    if (route.squadSub === 'estimator' && route.ratingGap) {
      return `#/squad/estimator/${encodeURIComponent(route.ratingGap)}${route.autoScan ? '/scan' : ''}`;
    }
    if (route.squadSub === 'estimator' && route.autoScan) {
      return `#/squad/estimator/scan`;
    }
    return `#/squad/${route.squadSub}`;
  }
  if (route.tab === 'wage' && route.wageSub && route.wageSub !== 'forecast') {
    return `#/wage/${route.wageSub}`;
  }
  if (route.tab === 'summary') return '#/';
  return `#/${route.tab}`;
}

export function navigateTo(route: RouteState) {
  const next = buildHash(route);
  if (typeof window === 'undefined') return;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

export function parseFromHash(): RouteState {
  return parseHash();
}
