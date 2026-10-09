import React, { useState, useEffect, useRef } from 'react';
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
import {
  ChevronRight, LayoutGrid, Calendar, Users, Swords, MoreHorizontal, X,
  Trophy, Calculator, Landmark, Bot, RefreshCw, BookOpen, ShieldAlert, ListOrdered
} from 'lucide-react';

type TabType = AppTab;

const PRIMARY_TABS: { id: TabType; label: string; icon: React.ReactNode; activeBg: string; iconBg: string }[] = [
  { id: 'summary', label: 'Home', icon: <LayoutGrid className="w-5 h-5" />, activeBg: 'bg-blue-50 text-blue-900', iconBg: 'bg-blue-100 text-blue-700' },
  { id: 'fixtures', label: 'Draw', icon: <Calendar className="w-5 h-5" />, activeBg: 'bg-indigo-50 text-indigo-900', iconBg: 'bg-indigo-100 text-indigo-700' },
  { id: 'squad', label: 'Squad', icon: <Users className="w-5 h-5" />, activeBg: 'bg-purple-50 text-purple-900', iconBg: 'bg-purple-100 text-purple-700' },
  { id: 'lineup', label: 'XI', icon: <ListOrdered className="w-5 h-5" />, activeBg: 'bg-emerald-50 text-emerald-900', iconBg: 'bg-emerald-100 text-emerald-700' },
  { id: 'scout', label: 'Scout', icon: <Swords className="w-5 h-5" />, activeBg: 'bg-rose-50 text-rose-900', iconBg: 'bg-rose-100 text-rose-700' },
];

const MORE_TABS: { id: TabType; label: string; desc: string; icon: React.ReactNode; iconBg: string }[] = [
  { id: 'league', label: 'League Ladders', desc: 'FC · OD · BT20 standings', icon: <Trophy className="w-4 h-4" />, iconBg: 'bg-amber-100 text-amber-700' },
  { id: 'wage', label: 'Finance', desc: 'Wages & cash forecast', icon: <Calculator className="w-4 h-4" />, iconBg: 'bg-teal-100 text-teal-700' },
  { id: 'stadium', label: 'Stadium', desc: 'Capacity & expansion', icon: <Landmark className="w-4 h-4" />, iconBg: 'bg-sky-100 text-sky-700' },
  { id: 'coach', label: 'Coach Jarvis', desc: 'AI match advice', icon: <Bot className="w-4 h-4" />, iconBg: 'bg-violet-100 text-violet-700' },
  { id: 'sync', label: 'Sync', desc: 'Import Battrick pages', icon: <RefreshCw className="w-4 h-4" />, iconBg: 'bg-slate-100 text-slate-700' },
  { id: 'rules', label: 'Rules', desc: 'Club setup & multipliers', icon: <BookOpen className="w-4 h-4" />, iconBg: 'bg-orange-100 text-orange-700' },
  { id: 'admin', label: 'Admin', desc: 'Usage & club switch', icon: <ShieldAlert className="w-4 h-4" />, iconBg: 'bg-red-100 text-red-700' },
];

const DESKTOP_TABS: { id: TabType; label: string }[] = [
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

function isPrimaryTab(tab: TabType): boolean {
  if (tab === 'player-details') return true;
  return PRIMARY_TABS.some((t) => t.id === tab);
}

export default function App() {
  const initial = parseHash();
  const [user, setUser] = useState<CustomUser | null>(() => getCustomUser());
  const [activeTab, setActiveTabState] = useState<TabType>(initial.tab as TabType);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(initial.playerId || null);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);

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

  const moreActive = showMobileMore || !isPrimaryTab(activeTab);

  const goTab = (tab: TabType) => {
    setShowMobileMore(false);
    setActiveTab(tab);
  };

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
          <div className="font-bold text-sm sm:text-base text-indigo-700 tracking-tight">BattrickIQ</div>
          <div className="min-w-0 flex-1 flex justify-end">
            <BattrickAuthBar />
          </div>
        </div>

        <nav
          aria-label="Breadcrumb"
          className="hidden sm:flex max-w-7xl mx-auto px-3 sm:px-4 pb-2 items-center flex-wrap gap-1 text-[11px] font-medium text-slate-500"
        >
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

        <div className="hidden lg:flex max-w-7xl mx-auto px-4 pb-2 gap-1 overflow-x-auto">
          {DESKTOP_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => goTab(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === t.id || (t.id === 'squad' && activeTab === 'player-details')
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6">
        {activeTab === 'summary' && <SummaryDashboard setActiveTab={setActiveTab as any} />}
        {activeTab === 'fixtures' && <FixturesDashboard setActiveTab={setActiveTab as any} />}
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
          <PlayerDetails playerId={selectedPlayerId} onBack={() => setActiveTab('squad')} />
        )}
      </main>

      {showMobileMore && (
        <div className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setShowMobileMore(false)}
          />
          <div
            className="relative bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 max-h-[70dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
            role="dialog"
            aria-label="More sections"
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10">
              <div>
                <div className="text-sm font-bold text-slate-900">More</div>
                <div className="text-[11px] text-slate-500">Finance, ladders, sync & tools</div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMore(false)}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MORE_TABS.map((t) => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => goTab(t.id)}
                    className={`flex items-center gap-3 p-3 min-h-[52px] rounded-xl border text-left transition active:scale-[0.98] ${
                      active
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.iconBg}`}>
                      {t.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{t.label}</div>
                      <div className="text-[11px] text-slate-500 truncate">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav
        ref={mobileNavRef}
        aria-label="Primary"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-6 gap-0.5 max-w-lg mx-auto px-1 pt-1.5 pb-1">
          {PRIMARY_TABS.map((t) => {
            const active =
              !showMobileMore &&
              (activeTab === t.id || (t.id === 'squad' && activeTab === 'player-details'));
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => goTab(t.id)}
                data-active={active ? 'true' : undefined}
                className={`flex flex-col items-center justify-center min-h-[52px] rounded-xl transition active:scale-95 border ${
                  active ? `${t.activeBg} font-bold border-current/10` : 'border-transparent text-slate-500 font-medium'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center mb-0.5 ${
                    active ? t.iconBg : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {t.icon}
                </div>
                <span className="text-[10px] leading-none tracking-tight">{t.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowMobileMore((v) => !v)}
            className={`flex flex-col items-center justify-center min-h-[52px] rounded-xl transition active:scale-95 border ${
              moreActive && (showMobileMore || !isPrimaryTab(activeTab))
                ? 'bg-slate-900 text-white font-bold border-slate-900'
                : 'border-transparent text-slate-500 font-medium'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center mb-0.5 ${
                moreActive && (showMobileMore || !isPrimaryTab(activeTab))
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className="text-[10px] leading-none tracking-tight">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
