import React, { useState, useEffect } from 'react';
import { LayoutGrid, Users, Calendar, Swords, Trophy, Calculator, Building2, Bot, Settings, BookOpen, RefreshCw, Shield, MoreHorizontal, X } from 'lucide-react';
import ManagerDesk from './components/ManagerDesk';
import SquadDashboard from './components/SquadDashboard';
import SquadManagerBar from './components/SquadManagerBar';
import FixturesDashboard from './components/FixturesDashboard';
import LineupOptimizer from './components/LineupOptimizer';
import LineupMatchBanner from './components/LineupMatchBanner';
import FixtureTeamIdEnrich from './components/FixtureTeamIdEnrich';
import OpponentScout from './components/OpponentScout';
import { LeagueStandings } from './components/LeagueStandings';
import WageCalculator from './components/WageCalculator';
import StadiumPlanner from './components/StadiumPlanner';
import AICoach from './components/AICoach';
import JarvisSettings from './components/JarvisSettings';
import JarvisFooter from './components/JarvisFooter';
import AICoachHistory from './components/AICoachHistory';
import SyncHub from './components/SyncHub';
import BusinessRules from './components/BusinessRules';
import AdminDashboard from './components/AdminDashboard';
import PlayerDetails from './components/PlayerDetails';
import LoginPage from './components/LoginPage';
import BattrickAuthBar from './components/BattrickAuthBar';
import { onCustomAuthStateChanged, getCustomUser, CustomUser } from './lib/customAuth';
import { parseHash, navigateTo, type AppTab } from './lib/navigation';
import { loadJarvisSettingsFromCloud } from './utils/jarvisSettingsStore';
import { hydrateWatchlistFromCloud } from './utils/transferWatchlist';

type TabType = AppTab | string;

const PRIMARY_TABS = [
  { id: 'summary', label: 'Manager', icon: <LayoutGrid className="w-5 h-5" />, activeBg: 'bg-blue-50 text-blue-900', iconBg: 'bg-blue-100 text-blue-700' },
  { id: 'squad', label: 'Squad', icon: <Users className="w-5 h-5" />, activeBg: 'bg-purple-50 text-purple-900', iconBg: 'bg-purple-100 text-purple-700' },
  { id: 'fixtures', label: 'Fixtures', icon: <Calendar className="w-5 h-5" />, activeBg: 'bg-emerald-50 text-emerald-900', iconBg: 'bg-emerald-100 text-emerald-700' },
  { id: 'lineup', label: 'Lineup', icon: <Swords className="w-5 h-5" />, activeBg: 'bg-orange-50 text-orange-900', iconBg: 'bg-orange-100 text-orange-700' },
] as const;

const MORE_TABS = [
  { id: 'coach', label: 'Jarvis', desc: 'AI club advisor', icon: <Bot className="w-4 h-4" />, iconBg: 'bg-indigo-100 text-indigo-700' },
  { id: 'jarvis-settings', label: 'Jarvis Settings', desc: 'OpenRouter API key & model', icon: <Settings className="w-4 h-4" />, iconBg: 'bg-slate-100 text-slate-700' },
  { id: 'scout', label: 'Scout', desc: 'Opponent & player scout', icon: <Swords className="w-4 h-4" />, iconBg: 'bg-rose-100 text-rose-700' },
  { id: 'league', label: 'League', desc: 'Tables & ladders', icon: <Trophy className="w-4 h-4" />, iconBg: 'bg-amber-100 text-amber-700' },
  { id: 'wage', label: 'Finances', desc: 'Cash, wages & forecast', icon: <Calculator className="w-4 h-4" />, iconBg: 'bg-green-100 text-green-700' },
  { id: 'stadium', label: 'Stadium', desc: 'Capacity planning', icon: <Building2 className="w-4 h-4" />, iconBg: 'bg-sky-100 text-sky-700' },
  { id: 'coach-history', label: 'Coach History', desc: 'Past Jarvis sessions', icon: <BookOpen className="w-4 h-4" />, iconBg: 'bg-violet-100 text-violet-700' },
  { id: 'sync', label: 'Sync', desc: 'Pull live Battrick data', icon: <RefreshCw className="w-4 h-4" />, iconBg: 'bg-cyan-100 text-cyan-700' },
  { id: 'rules', label: 'Rules', desc: 'Club setup & multipliers', icon: <BookOpen className="w-4 h-4" />, iconBg: 'bg-orange-100 text-orange-700' },
  { id: 'admin', label: 'Admin', desc: 'Internal tools', icon: <Shield className="w-4 h-4" />, iconBg: 'bg-slate-100 text-slate-700' },
] as const;

const BREADCRUMB_LABELS: Record<string, string> = {
  summary: 'Manager',
  squad: 'Squad',
  fixtures: 'Fixtures',
  lineup: 'Lineup',
  scout: 'Scout',
  league: 'League',
  wage: 'Finances',
  stadium: 'Stadium',
  coach: 'Jarvis',
  'jarvis-settings': 'Jarvis Settings',
  'coach-history': 'Coach History',
  sync: 'Sync',
  rules: 'Rules',
  admin: 'Admin',
  'player-details': 'Player',
};

function isPrimaryTab(tab: string) {
  return PRIMARY_TABS.some((t) => t.id === tab) || tab === 'player-details';
}

export default function App() {
  const initial = parseHash();
  const [user, setUser] = useState<CustomUser | null>(() => getCustomUser());
  const [activeTab, setActiveTabState] = useState<TabType>((initial.tab as TabType) || 'summary');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(initial.playerId || null);
  const [showMobileMore, setShowMobileMore] = useState(false);

  useEffect(() => {
    return onCustomAuthStateChanged((u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    loadJarvisSettingsFromCloud().catch(() => {});
    hydrateWatchlistFromCloud().catch(() => {});
  }, [user?.uid]);

  const setActiveTab = (tab: TabType | string, opts?: { playerId?: string | null }) => {
    const next = tab as TabType;
    setActiveTabState(next);
    if (next === 'player-details' && opts?.playerId) setSelectedPlayerId(opts.playerId);
    navigateTo({
      tab: next as AppTab,
      playerId: next === 'player-details' ? (opts?.playerId ?? selectedPlayerId) : null,
    });
    setShowMobileMore(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onHash = () => {
      const route = parseHash();
      setActiveTabState(route.tab as TabType);
      if (route.tab === 'player-details') setSelectedPlayerId(route.playerId || null);
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash || window.location.hash === '#') {
      navigateTo({ tab: activeTab as AppTab });
    }
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!user) return <LoginPage />;

  const crumbs = [
    { tab: 'summary' as AppTab, label: 'Manager' },
    { tab: activeTab as AppTab, playerId: selectedPlayerId },
  ].filter((c, i, arr) => i === 0 || c.tab !== arr[0].tab);

  const moreActive = showMobileMore || !isPrimaryTab(String(activeTab));

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col pb-[calc(8rem+env(safe-area-inset-bottom,0px))] sm:pb-16">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-3 sm:px-4 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display font-extrabold text-slate-900 text-sm sm:text-base tracking-tight truncate">
                BattrickIQ
              </div>
              <nav className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-500 font-medium overflow-x-auto">
                {crumbs.map((c, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className="text-slate-300">/</span>}
                    <button
                      type="button"
                      onClick={() => {
                        if (c.tab === 'player-details' && c.playerId) {
                          setActiveTab('player-details', { playerId: c.playerId });
                        } else {
                          setActiveTab(c.tab);
                        }
                      }}
                      className={`hover:text-indigo-600 truncate ${idx === crumbs.length - 1 ? 'text-slate-800 font-semibold' : ''}`}
                    >
                      {BREADCRUMB_LABELS[c.tab] || c.tab}
                    </button>
                  </React.Fragment>
                ))}
              </nav>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('jarvis-settings')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-700 hover:bg-indigo-50 border border-indigo-200 bg-indigo-50/50 text-xs font-bold shrink-0"
              title="Jarvis Settings - API key & model"
              aria-label="Jarvis Settings"
            >
              <Settings className="w-4 h-4 text-indigo-600" />
              <span>Settings</span>
            </button>
            <div className="hidden sm:flex items-center gap-1 flex-wrap justify-end">
              {[...PRIMARY_TABS, ...MORE_TABS.filter((t) => ['coach', 'jarvis-settings', 'scout', 'wage', 'sync'].includes(t.id))].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === t.id || (t.id === 'squad' && activeTab === 'player-details')
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <BattrickAuthBar />
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {activeTab === 'summary' && (
          <ManagerDesk setActiveTab={setActiveTab as any} />
        )}
        {activeTab === 'fixtures' && <FixturesDashboard setActiveTab={setActiveTab as any} />}
        {activeTab === 'squad' && (
          <div className="flex flex-col gap-3">
            <SquadManagerBar />
            <SquadDashboard
              setActiveTab={setActiveTab as any}
              onSelectPlayer={(id) => {
                setSelectedPlayerId(id);
                setActiveTab('player-details', { playerId: id });
              }}
            />
          </div>
        )}
        {activeTab === 'lineup' && (
          <div>
            <LineupMatchBanner />
            <LineupOptimizer />
          </div>
        )}
        {activeTab === 'scout' && (
          <div>
            <FixtureTeamIdEnrich />
            <OpponentScout setActiveTab={setActiveTab as any} />
          </div>
        )}
        {activeTab === 'league' && <LeagueStandings setActiveTab={setActiveTab as any} />}
        {activeTab === 'wage' && <WageCalculator />}
        {activeTab === 'stadium' && <StadiumPlanner />}
        {activeTab === 'coach' && <AICoach setActiveTab={setActiveTab as any} />}
        {activeTab === 'jarvis-settings' && <JarvisSettings />}
        {activeTab === 'coach-history' && <AICoachHistory />}
        {activeTab === 'sync' && <SyncHub />}
        {activeTab === 'rules' && <BusinessRules />}
        {activeTab === 'admin' && <AdminDashboard currentUserUid={user?.uid || ''} />}
        {activeTab === 'player-details' && selectedPlayerId && (
          <PlayerDetails playerId={selectedPlayerId} onBack={() => setActiveTab('squad')} />
        )}
      </main>

      <JarvisFooter onOpenFullSettings={() => setActiveTab('jarvis-settings')} />

      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="grid grid-cols-5 gap-0">
          {PRIMARY_TABS.map((t) => {
            const active =
              activeTab === t.id || (t.id === 'squad' && activeTab === 'player-details');
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-[10px] font-bold ${
                  active ? 'text-indigo-700' : 'text-slate-500'
                }`}
              >
                <span className={`p-1.5 rounded-lg ${active ? t.iconBg : ''}`}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowMobileMore((v) => !v)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] text-[10px] font-bold ${
              moreActive ? 'text-indigo-700' : 'text-slate-500'
            }`}
          >
            <span className={`p-1.5 rounded-lg ${moreActive ? 'bg-indigo-100' : ''}`}>
              {showMobileMore ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            </span>
            More
          </button>
        </div>
      </nav>

      {showMobileMore && (
        <div className="sm:hidden fixed inset-0 z-40" onClick={() => setShowMobileMore(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 bg-white rounded-t-2xl border-t border-slate-200 p-4 max-h-[60dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">More</div>
            <div className="grid grid-cols-2 gap-2">
              {MORE_TABS.map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`text-left p-3 rounded-xl border transition ${
                      active ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`p-1.5 rounded-lg ${t.iconBg}`}>{t.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{t.label}</div>
                        <div className="text-[10px] text-slate-500">{t.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
