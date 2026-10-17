import React, { useState, useEffect } from 'react';
import { LayoutGrid, Users, Calendar, Swords, Trophy, Calculator, Building2, Bot, Settings, BookOpen, RefreshCw, Shield, MoreHorizontal, X, Eye } from 'lucide-react';
import TransferWatchPage from './components/TransferWatchPage';
import ManagerDesk from './components/ManagerDesk';
import SquadDashboard from './components/SquadDashboard';
import SquadManagerBar from './components/SquadManagerBar';
import FixturesDashboard from './components/FixturesDashboard';
import LineupOptimizer from './components/LineupOptimizer';
import LineupMatchBanner from './components/LineupMatchBanner';
import FixtureTeamIdEnrich from './components/FixtureTeamIdEnrich';
import OpponentScout from './components/OpponentScout';
import { LeagueStandings } from './components/LeagueStandings';
import { WageCalculator } from './components/WageCalculator';
import { StadiumPlanner } from './components/StadiumPlanner';
import AICoach from './components/AICoach';
import JarvisSettings from './components/JarvisSettings';
import CoachHistory from './components/CoachHistory';
import SyncHub from './components/SyncHub';
import RulesGuide from './components/RulesGuide';
import AdminPanel from './components/AdminPanel';
import PlayerDetails from './components/PlayerDetails';
import ClubHeroHeader from './components/ClubHeroHeader';
import { parseHash, navigateTo, type AppTab, type RouteState } from './lib/navigation';
import { BattrickAuthProvider, useBattrickAuth } from './lib/battrickAuthContext';
import { loadJarvisSettingsFromCloud } from './lib/jarvisSettingsStore';

type TabType = AppTab | string;

const PRIMARY_TABS = [
  { id: 'summary', label: 'Manager', icon: <LayoutGrid className="w-5 h-5" />, activeBg: 'bg-blue-50 text-blue-900', iconBg: 'bg-blue-100 text-blue-700' },
  { id: 'squad', label: 'Squad', icon: <Users className="w-5 h-5" />, activeBg: 'bg-purple-50 text-purple-900', iconBg: 'bg-purple-100 text-purple-700' },
  { id: 'fixtures', label: 'Fixtures', icon: <Calendar className="w-5 h-5" />, activeBg: 'bg-emerald-50 text-emerald-900', iconBg: 'bg-emerald-100 text-emerald-700' },
  { id: 'lineup', label: 'Lineup', icon: <Users className="w-5 h-5" />, activeBg: 'bg-cyan-50 text-cyan-900', iconBg: 'bg-cyan-100 text-cyan-700' },
];

const MORE_TABS = [
  { id: 'coach', label: 'Jarvis', desc: 'AI club advisor', icon: <Bot className="w-4 h-4" />, iconBg: 'bg-indigo-100 text-indigo-700' },
  { id: 'jarvis-settings', label: 'Jarvis Settings', desc: 'OpenRouter API key & model', icon: <Settings className="w-4 h-4" />, iconBg: 'bg-slate-100 text-slate-700' },
  { id: 'watch', label: 'Watch', desc: 'Transfer watchlist & bid bot', icon: <Eye className="w-4 h-4" />, iconBg: 'bg-amber-100 text-amber-800' },
  { id: 'scout', label: 'Scout', desc: 'Opponent & player scout', icon: <Swords className="w-4 h-4" />, iconBg: 'bg-rose-100 text-rose-700' },
  { id: 'league', label: 'League', desc: 'Tables & ladders', icon: <Trophy className="w-4 h-4" />, iconBg: 'bg-amber-100 text-amber-700' },
  { id: 'wage', label: 'Finances', desc: 'Cash, wages & forecast', icon: <Calculator className="w-4 h-4" />, iconBg: 'bg-green-100 text-green-700' },
  { id: 'stadium', label: 'Stadium', desc: 'Capacity & upgrades', icon: <Building2 className="w-4 h-4" />, iconBg: 'bg-orange-100 text-orange-700' },
  { id: 'sync', label: 'Sync', desc: 'Pull live Battrick data', icon: <RefreshCw className="w-4 h-4" />, iconBg: 'bg-sky-100 text-sky-700' },
  { id: 'rules', label: 'Rules', desc: 'Game rules guide', icon: <BookOpen className="w-4 h-4" />, iconBg: 'bg-slate-100 text-slate-700' },
  { id: 'admin', label: 'Admin', desc: 'Debug & tools', icon: <Shield className="w-4 h-4" />, iconBg: 'bg-red-100 text-red-700' },
];
