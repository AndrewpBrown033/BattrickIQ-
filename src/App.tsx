import React, { useState, useEffect, useRef } from 'react';
import SummaryDashboard from './components/SummaryDashboard';
import SquadDashboard from './components/SquadDashboard';
import WageCalculator from './components/WageCalculator';
import LineupOptimizer from './components/LineupOptimizer';
import SyncHub from './components/SyncHub';
import StadiumPlanner from './components/StadiumPlanner';
import AICoach from './components/AICoach';
import AICoachHistory from './components/AICoachHistory';
import BusinessRules from './components/BusinessRules';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import PlayerDetails from './components/PlayerDetails';
import { onCustomAuthStateChanged, customSignOut, CustomUser } from './lib/customAuth';
import { Award, Calculator, Users, FolderOpen, Heart, RefreshCw, Landmark, Bot, BookOpen, Trophy, Clock, ShieldAlert, LogOut, Eye, Activity, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type TabType = 'summary' | 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'coach-history' | 'rules' | 'admin' | 'player-details';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>('My Battrick IQ Club');
  
  // Mobile bottom navigation scrolling
  const mobileNavRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mobileNavRef.current) {
      const activeEl = mobileNavRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTab]);
  
  // Theme state
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('bt_high_contrast') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('bt_high_contrast', String(highContrast));
  }, [highContrast]);
  
  // Auth state
  const [user, setUser] = useState<CustomUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Admin viewing mode states
  const [adminViewingEmail, setAdminViewingEmail] = useState<string | null>(null);
  const [adminViewingName, setAdminViewingName] = useState<string | null>(null);

  useEffect(() => {
    const handleStorage = () => {
      setAdminViewingEmail(localStorage.getItem('bt_admin_viewing_email'));
      setAdminViewingName(localStorage.getItem('bt_admin_viewing_name'));
    };
    handleStorage();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Inactivity timeout state (20 minutes = 1200 seconds)
  const [secondsLeft, setSecondsLeft] = useState<number>(1200);
  const [showTimeoutModal, setShowTimeoutModal] = useState<boolean>(false);
  const lastActivityTime = useRef<number>(Date.now());

  // 1. Listen for Authentication state
  useEffect(() => {
    const unsubscribe = onCustomAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setActiveTab('summary');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Track activity and handle automated sign-out
  useEffect(() => {
    if (!user) {
      setSecondsLeft(1200);
      return;
    }

    const resetActivityTimer = () => {
      lastActivityTime.current = Date.now();
    };

    // User interaction event listeners
    window.addEventListener('mousemove', resetActivityTimer);
    window.addEventListener('keydown', resetActivityTimer);
    window.addEventListener('click', resetActivityTimer);
    window.addEventListener('scroll', resetActivityTimer, { passive: true });
    window.addEventListener('touchstart', resetActivityTimer, { passive: true });

    // Tick every second to measure elapsed time since last active event
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastActivityTime.current) / 1000);
      const remaining = Math.max(0, 1200 - elapsed);
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        // Automatic log out
        customSignOut();
        // Clean up sensitive storage states
        localStorage.removeItem('bt_squad');
        localStorage.removeItem('bt_finances');
        localStorage.removeItem('bt_stadium');
        localStorage.removeItem('bt_team_name');
        // Trigger sync across components
        window.dispatchEvent(new Event('storage'));
        setShowTimeoutModal(true);
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', resetActivityTimer);
      window.removeEventListener('keydown', resetActivityTimer);
      window.removeEventListener('click', resetActivityTimer);
      window.removeEventListener('scroll', resetActivityTimer);
      window.removeEventListener('touchstart', resetActivityTimer);
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    const loadTeamName = () => {
      const name = localStorage.getItem('bt_team_name');
      if (name) setTeamName(name);
    };
    loadTeamName();
    window.addEventListener('storage', loadTeamName);
    return () => window.removeEventListener('storage', loadTeamName);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleHeaderSignOut = () => {
    if (window.confirm('Are you sure you want to sign out of BattrickIQ Cloud? Your cloud data will remain secure.')) {
      try {
        customSignOut();
        // Clear sensitive states from local storage so guests don't see them
        localStorage.removeItem('bt_squad');
        localStorage.removeItem('bt_finances');
        localStorage.removeItem('bt_stadium');
        localStorage.removeItem('bt_team_name');
        window.dispatchEvent(new Event('storage'));
      } catch (e: any) {
        console.error(e);
      }
    }
  };

  const baseTabs = [
    { id: 'summary' as TabType, step: '01', label: 'Club Summary', icon: <Activity className="w-4 h-4" />, desc: 'Overall Club Health', status: 'Overview' },
    { id: 'squad' as TabType, step: '02', label: 'Squad & Pops', icon: <FolderOpen className="w-4 h-4" />, desc: 'Roster & Skill Pops', status: 'Ready' },
    { id: 'lineup' as TabType, step: '03', label: 'Lineup XI', icon: <Users className="w-4 h-4" />, desc: 'Rating Optimizer', status: 'Draft' },
    { id: 'wage' as TabType, step: '04', label: 'Financial Forecast', icon: <Calculator className="w-4 h-4" />, desc: 'Wages & Cashflow Projections', status: 'Config' },
    { id: 'stadium' as TabType, step: '05', label: 'Stadium Plan', icon: <Landmark className="w-4 h-4" />, desc: 'Expansion Helper', status: 'Auto' },
    { id: 'coach' as TabType, step: '06', label: 'Tactical AI', icon: <Bot className="w-4 h-4" />, desc: 'AI Tactical Advice', status: 'AI Ready' },
    { id: 'sync' as TabType, step: '07', label: 'Roster Sync', icon: <RefreshCw className="w-4 h-4" />, desc: 'Paste Battrick Pages', status: 'Active' },
    { id: 'rules' as TabType, step: '08', label: 'Club Setup', icon: <BookOpen className="w-4 h-4" />, desc: 'Profile & Tactical Rules', status: 'Setup' },
  ];

  const tabs = user?.role === 'admin'
    ? [...baseTabs, { id: 'admin' as TabType, step: '10', label: 'Admin Portal', icon: <Trophy className="w-4 h-4 text-indigo-600" />, desc: 'Usage & Team Switcher', status: 'Control' }]
    : baseTabs;


  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] bg-blueprint-grid flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">Loading secure manager environment...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage onLoginSuccess={() => {
          setShowTimeoutModal(false);
          setActiveTab('summary');
        }} />
        {/* Floating security notification if timed out */}
        {showTimeoutModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl max-w-md w-full p-6 text-center flex flex-col items-center gap-4 animate-scaleUp">
              <div className="w-14 h-14 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-lg text-slate-900">Session Securely Terminated</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  For your security, your BattrickIQ cloud connection was logged out due to 20 minutes of complete inactivity. Your local database state has been cleared from memory.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTimeoutModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-md cursor-pointer shadow-blue-500/10"
              >
                Sign In Again
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`min-h-screen font-sans antialiased flex flex-col transition-colors duration-150 ${
      highContrast 
        ? 'bg-white text-black hc-mode selection:bg-slate-900 selection:text-white' 
        : 'bg-[#f9fafb] text-slate-800 selection:bg-blue-500/10 selection:text-blue-800'
    }`}>
      
      {/* Subtle background radial lights */}
      {!highContrast && (
        <>
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/2 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-indigo-500/2 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Main SaaS Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/15">
              <Award className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-display font-black text-base tracking-tight text-slate-900">
                  Battrick<span className="text-blue-600">IQ</span>
                </h1>
                <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-150">
                  PRO
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={() => setHighContrast(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition border cursor-pointer ${
                highContrast
                  ? 'bg-slate-900 text-white border-slate-900 hover:bg-black'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={highContrast ? 'Switch to Pro Blue' : 'Switch to High Contrast'}
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{highContrast ? 'Pro Look' : 'High Contrast'}</span>
              <span className="sm:hidden">{highContrast ? 'Pro' : 'Contrast'}</span>
            </button>

            {/* Interactive Session Timeout Countdown */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-[11px] font-mono text-slate-700">
              <Clock className="w-3 h-3 text-blue-600 animate-pulse shrink-0" />
              <span className="hidden sm:inline text-[10px] text-slate-400 font-semibold uppercase">Session:</span>
              <span className="font-bold text-slate-800">{formatTime(secondsLeft)}</span>
              <button
                type="button"
                onClick={() => { lastActivityTime.current = Date.now(); setSecondsLeft(600); }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[8px] font-bold px-1.5 py-0.5 rounded transition cursor-pointer uppercase"
                title="Extend session"
              >
                Extend
              </button>
            </div>

            {/* Team Association Badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg text-xs font-mono text-blue-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
              <span className="font-bold truncate max-w-[120px]">{teamName}</span>
            </div>

            {/* Log Out Button */}
            <button
              id="btn-header-logout"
              type="button"
              onClick={handleHeaderSignOut}
              className="flex items-center gap-1.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-600 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition duration-150 cursor-pointer shadow-sm"
              title="Sign Out of BattrickIQ Cloud"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* SaaS Admin Inspecting Banner */}
      {adminViewingEmail && (
        <div className="bg-amber-500 text-white font-mono text-xs px-4 py-2.5 flex items-center justify-between gap-4 shadow-md sticky top-15 z-40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>
              <strong>Admin Inspecting:</strong> Currently viewing team <strong>{adminViewingName || 'Selected Club'}</strong> ({adminViewingEmail}). All system dashboards are active for this manager.
            </span>
          </div>
          <button
            onClick={async () => {
              if (user) {
                localStorage.removeItem('bt_admin_selected_team');
                localStorage.removeItem('bt_admin_viewing_email');
                localStorage.removeItem('bt_admin_viewing_name');
                
                // Reload original from Firestore
                const { doc, getDoc } = await import('firebase/firestore');
                const { db } = await import('./lib/firebase');
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                  const data = docSnap.data();
                  if (data.squad) localStorage.setItem('bt_squad', JSON.stringify(data.squad));
                  if (data.finances) localStorage.setItem('bt_finances', JSON.stringify(data.finances));
                  if (data.stadium) localStorage.setItem('bt_stadium', JSON.stringify(data.stadium));
                  if (data.fixtures) localStorage.setItem('bt_fixtures', JSON.stringify(data.fixtures));
                  if (data.pavilion) localStorage.setItem('bt_pavilion', JSON.stringify(data.pavilion));
                  localStorage.setItem('bt_team_name', data.teamName || 'My Battrick IQ Club');
                }
                window.dispatchEvent(new Event('storage'));
              }
            }}
            className="bg-white hover:bg-slate-50 text-amber-700 font-bold px-3 py-1 rounded transition whitespace-nowrap cursor-pointer uppercase text-[10px]"
          >
            Revert to My Team
          </button>
        </div>
      )}

      {/* Main SaaS Layout Wrapper */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6">

        {/* Desktop 12-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Desktop Left Sidebar Navigation (Column 1 to 3) */}
          <aside className="hidden lg:col-span-3 lg:flex flex-col gap-6 sticky top-20">
            
            {/* Sidebar Navigation Card */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-4.5 shadow-sm">
              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider block mb-3 px-1">
                Strategic Navigation
              </span>
              
              <nav className="flex flex-col gap-1">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-bold transition flex items-center justify-between group cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1 rounded transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                          {tab.icon}
                        </div>
                        <span className="truncate">{tab.label}</span>
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        isActive 
                          ? 'bg-blue-600/10 text-blue-700 font-bold' 
                          : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600'
                      }`}>
                        {tab.step}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

          </aside>

          {/* Main Focused Panel (Column 4 to 12) */}
          <main className="lg:col-span-9 flex flex-col gap-6 min-h-[600px]">
            
            {/* Elegant Dynamic Page Title Header */}
            {activeTab !== 'player-details' && (
              <div className="bg-white border border-slate-200/80 rounded-xl px-6 py-4.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-display font-black text-slate-900 tracking-tight flex items-center gap-2">
                    {activeTab === 'summary' && "Club Overview & Health Analyzer"}
                    {activeTab === 'sync' && "Club Sync & Status Hub"}
                    {activeTab === 'squad' && "Squad Roster & Training"}
                    {activeTab === 'lineup' && "Matchday XI Rating Optimizer"}
                    {activeTab === 'wage' && "Financial Forecast & Club Health"}
                    {activeTab === 'stadium' && "Stadium Expansion Planner"}
                    {activeTab === 'coach' && "Coach Jarvis AI Assistant"}
                    {activeTab === 'rules' && "Club Setup & Business Rules"}
                    {activeTab === 'admin' && "Admin Suite & Usage Dashboard"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeTab === 'summary' && "Evaluate your club's overall health score, including stadium sizing, squad depth, and financial vitality at a glance."}
                    {activeTab === 'sync' && "Paste raw Battrick page source codes or text to sync your squad roster, fixtures, pavilion, and finances instantly."}
                    {activeTab === 'squad' && "Analyze player skills, track training pops, view BTR ratings, and verify hold/develop/sell advice."}
                    {activeTab === 'lineup' && "Formulate your match starting XI and model expected ratings for different pitches."}
                    {activeTab === 'wage' && "Evaluate club health, optimize backroom staff count, and forecast player wage growth and cashflow."}
                    {activeTab === 'stadium' && "Plan expansion projects, allocate ticket types, and balance seats against member count."}
                    {activeTab === 'coach' && "Consult with Coach Jarvis regarding lineup strategy, pitch matches, and transfer advise."}
                    {activeTab === 'rules' && "Configure parameters, fitness hierarchy multipliers, and tactical indicators."}
                    {activeTab === 'admin' && "Evaluate site telemetry, usage analytics, average parameters and toggle session focus to any manager club."}
                  </p>
                </div>
                
                {/* Dynamic Action indicators */}
                <div className="shrink-0 flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded-md border border-blue-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    Manager Console
                  </span>
                </div>
              </div>
            )}

            {/* Selected View Section with AnimatePresence */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === 'summary' && <SummaryDashboard setActiveTab={setActiveTab} />}
                  {activeTab === 'sync' && <SyncHub setActiveTab={setActiveTab} />}
                  {activeTab === 'squad' && (
                    <SquadDashboard 
                      setActiveTab={setActiveTab} 
                      onSelectPlayer={(id) => {
                        setSelectedPlayerId(id);
                        setActiveTab('player-details');
                      }}
                    />
                  )}
                  {activeTab === 'lineup' && <LineupOptimizer setActiveTab={setActiveTab} />}
                  {activeTab === 'wage' && <WageCalculator />}
                  {activeTab === 'stadium' && <StadiumPlanner setActiveTab={setActiveTab} />}
                  {activeTab === 'coach' && <AICoach />}
                  {activeTab === 'rules' && <BusinessRules />}
                  {activeTab === 'admin' && <AdminDashboard currentUserUid={user.uid} />}
                  {activeTab === 'player-details' && (
                    <PlayerDetails 
                      playerId={selectedPlayerId} 
                      onBack={() => setActiveTab('squad')} 
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

          </main>

        </div>
      </div>

      {/* Crisp White Footer */}
      <footer className="border-t border-slate-200/85 bg-white py-6 mt-12 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            © 2026 BattrickIQ. Built for professional Battrick cricket managers.
          </div>
          <div className="flex items-center gap-1.5 justify-center">
            <span>Crafted with passion</span>
            <Heart className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
            <span>for Battrick Cricket</span>
          </div>
        </div>
      </footer>

      {/* Mobile Friendly Sticky Bottom Navigation Bar */}
      <div 
        ref={mobileNavRef}
        className={`fixed bottom-0 left-0 right-0 border-t z-50 lg:hidden px-2.5 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-colors duration-150 ${
          highContrast 
            ? 'bg-white border-black text-black' 
            : 'bg-white/95 backdrop-blur-md border-slate-200/85'
        }`}
      >
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x justify-start sm:justify-center">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id || (tab.id === 'squad' && activeTab === 'player-details');
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-active={isActive ? "true" : "false"}
                className={`flex flex-col items-center justify-center min-w-[76px] py-1 px-2 rounded-xl transition-all duration-150 snap-start cursor-pointer border ${
                  isActive
                    ? highContrast
                      ? 'text-black bg-slate-100 border-black font-black'
                      : 'text-blue-600 bg-blue-50/60 border-blue-100 font-bold'
                    : highContrast
                      ? 'text-slate-750 border-transparent font-semibold'
                      : 'text-slate-500 hover:text-slate-900 border-transparent font-medium'
                }`}
              >
                <div className="mb-0.5">
                  {tab.icon}
                </div>
                <span className="text-[10px] whitespace-nowrap tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
