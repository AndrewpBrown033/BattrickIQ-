import React, { useState, useEffect } from 'react';
import { onCustomAuthStateChanged, getCustomUser, CustomUser } from './lib/customAuth';
import LoginPage from './components/LoginPage';
import SummaryDashboard from './components/SummaryDashboard';
import SquadDashboard from './components/SquadDashboard';
import WageCalculator from './components/WageCalculator';
import SyncHub from './components/SyncHub';
import FixturesDashboard from './components/FixturesDashboard';
import LineupOptimizer from './components/LineupOptimizer';
import OpponentScout from './components/OpponentScout';
import { LeagueStandings } from './components/LeagueStandings';
import StadiumPlanner from './components/StadiumPlanner';
import AICoach from './components/AICoach';
import AICoachHistory from './components/AICoachHistory';
import BusinessRules from './components/BusinessRules';
import AdminDashboard from './components/AdminDashboard';
import PlayerDetails from './components/PlayerDetails';
import BattrickAuthBar from './components/BattrickAuthBar';
import { parseHash, navigateTo, buildBreadcrumbs, type AppTab } from './lib/navigation';
import { ChevronRight } from 'lucide-react';

type TabType = AppTab;

const TABS: { id: TabType; label: string }[] = [
  { id: 'summary', label: 'Club Summary' },
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'squad', label: 'Squad' },
  { id: 'lineup', label: 'Lineup XI' },
  { id: 'scout', label: 'Scout' },
  { id: 'league', label: 'Ladders' },
  { id: 'wage', label: 'Finance' },
  { id: 'stadium', label: 'Stadium' },
  { id: 'coach', label: 'Coach' },
  { id: 'sync', label: 'Sync' },
  { id: 'rules', label: 'Rules' },
  { id: 'admin', label: 'Admin' },
];

export default function App() {
  const initial = parseHash();
  const [user, setUser] = useState<CustomUser | null>(() => getCustomUser());
  const [activeTab, setActiveTabState] = useState<TabType>(initial.tab as TabType);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(initial.playerId || null);

  const setActiveTab = (tab: TabType | string, opts?: { playerId?: string | null }) => {
    const next = tab as TabType;
    setActiveTabState(next);
    if (next === 'player-details' && opts?.playerId) setSelectedPlayerId(opts.playerId);
    navigateTo({
      tab: next as AppTab,
      playerId: next === 'player-details' ? (opts?.playerId ?? selectedPlayerId) : null,
    });
  };

  useEffect(() => {
    const unsub = onCustomAuthStateChanged(setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    const apply = () => {
      const route = parseHash();
      setActiveTabState(route.tab as TabType);
      if (route.tab === 'player-details') setSelectedPlayerId(route.playerId || null);
    };
    if (!window.location.hash || window.location.hash === '#') {
      navigateTo({ tab: activeTab as AppTab }, { replace: true });
    }
    window.addEventListener('hashchange', apply);
    window.addEventListener('popstate', apply);
    return () => {
      window.removeEventListener('hashchange', apply);
      window.removeEventListener('popstate', apply);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return <LoginPage />;

  const crumbs = buildBreadcrumbs(
    { tab: activeTab as AppTab, playerId: selectedPlayerId },
    null
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between gap-3">
          <div className="font-bold text-sm text-indigo-700">BattrickIQ</div>
          <BattrickAuthBar />
        </div>
        <nav aria-label="Breadcrumb" className="max-w-7xl mx-auto px-3 pb-2 flex items-center flex-wrap gap-1 text-[11px] font-medium text-slate-500">
          {crumbs.map((crumb, idx, arr) => (
            <span key={`${crumb.label}-${idx}`} className="inline-flex items-center gap-1">
              {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
              {crumb.href && idx < arr.length - 1 ? (
                <a
                  href={crumb.href}
                  onClick={(e) => {
                    e.preventDefault();
                    const route = parseHash(crumb.href);
                    setActiveTab(route.tab, { playerId: route.playerId });
                  }}
                  className="text-indigo-600 hover:underline"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className={idx === arr.length - 1 ? 'text-slate-800 font-semibold' : ''}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
          <button
            type="button"
            onClick={() => window.history.back()}
            className="ml-2 text-[10px] font-mono font-bold uppercase text-slate-400 hover:text-slate-700 border border-slate-200 rounded px-1.5 py-0.5"
          >
            ← Back
          </button>
        </nav>
        <div className="max-w-7xl mx-auto px-3 pb-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                activeTab === t.id || (t.id === 'squad' && activeTab === 'player-details')
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-3 sm:p-4">
        {activeTab === 'summary' && (
          <SummaryDashboard setActiveTab={setActiveTab as any} />
        )}
        {activeTab === 'fixtures' && (
          <FixturesDashboard setActiveTab={setActiveTab as any} />
        )}
        {activeTab === 'squad' && (
          <SquadDashboard
            setActiveTab={setActiveTab as any}
            onSelectPlayer={(id) => {
              setSelectedPlayerId(id);
              setActiveTab('player-details', { playerId: id });
            }}
          />
        )}
        {activeTab === 'lineup' && <LineupOptimizer />}
        {activeTab === 'scout' && <OpponentScout />}
        {activeTab === 'league' && <LeagueStandings />}
        {activeTab === 'wage' && <WageCalculator />}
        {activeTab === 'stadium' && <StadiumPlanner />}
        {activeTab === 'coach' && <AICoach />}
        {activeTab === 'coach-history' && <AICoachHistory />}
        {activeTab === 'sync' && <SyncHub />}
        {activeTab === 'rules' && <BusinessRules />}
        {activeTab === 'admin' && <AdminDashboard />}
        {activeTab === 'player-details' && selectedPlayerId && (
          <PlayerDetails
            playerId={selectedPlayerId}
            onBack={() => setActiveTab('squad')}
          />
        )}
      </main>
    </div>
  );
}
