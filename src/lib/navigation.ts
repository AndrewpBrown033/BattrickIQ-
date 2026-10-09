/** Hash-based navigation helpers for BattrickIQ (no react-router dependency). */

export type AppTab =
  | 'summary'
  | 'sync'
  | 'squad'
  | 'lineup'
  | 'scout'
  | 'league'
  | 'wage'
  | 'stadium'
  | 'coach'
  | 'coach-history'
  | 'rules'
  | 'admin'
  | 'player-details'
  | 'fixtures';

export type SquadSubTab = 'roster' | 'training' | 'trading' | 'estimator';
export type WageSubTab = 'forecast' | 'health';

export interface RouteState {
  tab: AppTab;
  playerId?: string | null;
  squadSub?: SquadSubTab;
  wageSub?: WageSubTab;
}

const VALID_TABS = new Set<string>([
  'summary', 'sync', 'squad', 'lineup', 'scout', 'league', 'wage',
  'stadium', 'coach', 'coach-history', 'rules', 'admin', 'player-details', 'fixtures',
]);

const TAB_LABELS: Record<string, string> = {
  summary: 'Club Summary',
  fixtures: 'Fixtures & Draw',
  squad: 'Squad',
  lineup: 'Lineup XI',
  scout: 'Opponent Scout',
  league: 'League Ladders',
  wage: 'Financial Forecast',
  stadium: 'Stadium Plan',
  coach: 'Coach Jarvis',
  'coach-history': 'Coach History',
  sync: 'Roster Sync',
  rules: 'Business Rules',
  admin: 'Admin',
  'player-details': 'Player Details',
};

const SQUAD_SUB_LABELS: Record<SquadSubTab, string> = {
  roster: 'Roster',
  training: 'Training',
  trading: 'Trading',
  estimator: 'Squad Estimator',
};

const WAGE_SUB_LABELS: Record<WageSubTab, string> = {
  forecast: 'Forecast',
  health: 'Club Health',
};

export function tabLabel(tab: string): string {
  return TAB_LABELS[tab] || tab;
}

export function squadSubLabel(sub: SquadSubTab): string {
  return SQUAD_SUB_LABELS[sub] || sub;
}

export function wageSubLabel(sub: WageSubTab): string {
  return WAGE_SUB_LABELS[sub] || sub;
}

/** Parse location.hash into a route. Examples: #/squad/training, #/player/abc123, #/wage/health */
export function parseHash(hash: string = window.location.hash): RouteState {
  const raw = (hash || '').replace(/^#\/?/, '').trim();
  if (!raw) return { tab: 'summary' };

  const parts = raw.split('/').filter(Boolean);
  const head = parts[0]?.toLowerCase() || 'summary';

  if (head === 'player' || head === 'player-details') {
    return {
      tab: 'player-details',
      playerId: parts[1] || null,
    };
  }

  if (!VALID_TABS.has(head)) {
    return { tab: 'summary' };
  }

  const tab = head as AppTab;
  const state: RouteState = { tab };

  if (tab === 'squad' && parts[1]) {
    const sub = parts[1].toLowerCase();
    if (sub === 'roster' || sub === 'training' || sub === 'trading' || sub === 'estimator') {
      state.squadSub = sub;
    }
  }

  if (tab === 'wage' && parts[1]) {
    const sub = parts[1].toLowerCase();
    if (sub === 'forecast' || sub === 'health') {
      state.wageSub = sub;
    }
  }

  return state;
}

/** Build a hash path from route pieces. */
export function buildHash(route: RouteState): string {
  if (route.tab === 'player-details') {
    return route.playerId ? `#/player/${route.playerId}` : '#/squad';
  }
  if (route.tab === 'squad' && route.squadSub && route.squadSub !== 'roster') {
    return `#/squad/${route.squadSub}`;
  }
  if (route.tab === 'wage' && route.wageSub && route.wageSub !== 'forecast') {
    return `#/wage/${route.wageSub}`;
  }
  if (route.tab === 'summary') return '#/';
  return `#/${route.tab}`;
}

/**
 * Navigate to a route. Uses pushState by default so the browser Back button works.
 * Pass replace: true for initial hydration (avoids an extra history entry).
 */
export function navigateTo(route: RouteState, opts?: { replace?: boolean }) {
  const next = buildHash(route);
  const url = `${window.location.pathname}${window.location.search}${next}`;
  if (opts?.replace) {
    window.history.replaceState(route, '', url);
  } else {
    const current = window.location.hash || '#/';
    if (current === next || current === next.replace(/^#\/$/, '#/')) {
      window.history.replaceState(route, '', url);
      return;
    }
    window.history.pushState(route, '', url);
  }
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function buildBreadcrumbs(route: RouteState, playerName?: string | null): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '#/' },
  ];

  if (route.tab === 'summary') {
    crumbs.push({ label: 'Club Summary' });
    return crumbs;
  }

  if (route.tab === 'player-details') {
    crumbs.push({ label: 'Squad', href: '#/squad' });
    crumbs.push({ label: playerName || 'Player' });
    return crumbs;
  }

  crumbs.push({
    label: tabLabel(route.tab),
    href: route.squadSub || route.wageSub ? buildHash({ tab: route.tab }) : undefined,
  });

  if (route.tab === 'squad' && route.squadSub && route.squadSub !== 'roster') {
    crumbs.push({ label: squadSubLabel(route.squadSub) });
  }
  if (route.tab === 'wage' && route.wageSub && route.wageSub !== 'forecast') {
    crumbs.push({ label: wageSubLabel(route.wageSub) });
  }

  return crumbs;
}
