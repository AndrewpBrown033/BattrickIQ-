import React, { useState, useEffect } from 'react';
import { BattrickPlayer, ClubFinances, SKILL_LEVELS, STAMINA_LEVELS, getSkillLabel } from '../types';
import { 
  getPlayerWeightedScore, 
  getTradeAction, 
  estimateWeeksToNextLevel 
} from '../parser';
import { 
  Search, Coins, User, TrendingUp, 
  Shield, Award, Activity, Info, History, Plus, ChevronRight, Calendar, Sparkles,
  LayoutGrid, List, X, ArrowUpDown
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts';
import { generateRealisticHistory, getWeeklyChanges } from '../utils/history';

interface SquadDashboardProps {
  setActiveTab?: (tab: 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'rules' | 'admin' | 'player-details') => void;
  onSelectPlayer?: (playerId: string) => void;
}

export default function SquadDashboard({ setActiveTab, onSelectPlayer }: SquadDashboardProps) {
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [finances, setFinances] = useState<ClubFinances>({
    cash: 0,
    members: 0,
    prOfficers: 0,
    finAdvisors: 0,
    sponsorsIncome: 0,
    gateReceipts: 0,
    interestReceived: 0,
    playerWages: 0,
    staffWages: 0,
    morale: 'respectable',
    sponsorsMood: 'respectable',
    membersConfidence: 'respectable',
    academyCondition: 'feeble',
    academyInvestment: 0,
    academyIts: 0,
    bowlingCoaches: 0,
    battingCoaches: 0,
    fieldingCoaches: 0,
    keepingCoaches: 0,
    staminaCoaches: 0,
    psychologists: 0
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'age' | 'wage' | 'btRating' | 'score'>('score');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>(() => {
    return (localStorage.getItem('bt_squad_view_mode') as 'cards' | 'compact') || 'cards';
  });
  const [selectedPlayer, setSelectedPlayer] = useState<BattrickPlayer | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'skills' | 'history'>('skills');

  const handleSetViewMode = (mode: 'cards' | 'compact') => {
    setViewMode(mode);
    localStorage.setItem('bt_squad_view_mode', mode);
  };

  // Helper for top player skill
  const getTopSkillInfo = (p: BattrickPlayer) => {
    const list = [
      { key: 'batting' as const, label: 'BAT', val: p.skills.batting },
      { key: 'bowling' as const, label: 'BOWL', val: p.skills.bowling },
      { key: 'keeping' as const, label: 'KEEP', val: p.skills.keeping },
      { key: 'fielding' as const, label: 'FIELD', val: p.skills.fielding || 0 },
      { key: 'stamina' as const, label: 'STAM', val: p.skills.stamina }
    ];
    list.sort((a, b) => b.val - a.val);
    const top = list[0];
    return {
      label: top.label,
      name: getSkillLabel(top.key, top.val),
      val: top.val
    };
  };

  // Training planner states
  const [plannerNets, setPlannerNets] = useState<{ batting: number; bowling: number; keeping: number; stamina: number; fielding: number }>({
    batting: 0,
    bowling: 0,
    keeping: 0,
    stamina: 0,
    fielding: 0,
  });
  const [coachLevel, setCoachLevel] = useState<number>(9); // 9 = Superb Coach by default
  const [squadTrainingStamina, setSquadTrainingStamina] = useState<boolean>(() => {
    return localStorage.getItem('bt_squad_training_stamina') === 'true';
  });
  const [squadTrainingFielding, setSquadTrainingFielding] = useState<boolean>(() => {
    return localStorage.getItem('bt_squad_training_fielding') === 'true';
  });

  const handleToggleSquadStamina = (enabled: boolean) => {
    setSquadTrainingStamina(enabled);
    localStorage.setItem('bt_squad_training_stamina', String(enabled));
    window.dispatchEvent(new Event('storage'));
  };

  const handleToggleSquadFielding = (enabled: boolean) => {
    setSquadTrainingFielding(enabled);
    localStorage.setItem('bt_squad_training_fielding', String(enabled));
    window.dispatchEvent(new Event('storage'));
  };

  const handleSimulateWeeklyPop = (player: BattrickPlayer) => {
    if (!player.history || player.history.length === 0) return;
    const lastEntry = player.history[player.history.length - 1];
    
    // Auto-increment week
    let nextWeek = (lastEntry.week % 16) + 1;
    let nextSeason = lastEntry.season;
    if (nextWeek === 1) {
      nextSeason += 1;
    }
    
    const netsKeys = ['batting', 'bowling', 'keeping', 'stamina', 'fielding'] as const;
    const activeCandidates: ('batting' | 'bowling' | 'keeping' | 'stamina' | 'fielding')[] = [];
    
    netsKeys.forEach(k => {
      if (plannerNets[k] > 0) activeCandidates.push(k);
    });
    if (squadTrainingStamina && !activeCandidates.includes('stamina')) {
      activeCandidates.push('stamina');
    }
    if (squadTrainingFielding && !activeCandidates.includes('fielding')) {
      activeCandidates.push('fielding');
    }
    
    const chosenSkillKey = activeCandidates.length > 0 
      ? activeCandidates[Math.floor(Math.random() * activeCandidates.length)] 
      : 'batting';
      
    const updatedSkills = { ...player.skills };
    const oldLevel = updatedSkills[chosenSkillKey as keyof typeof updatedSkills] || 0;
    const maxLevel = chosenSkillKey === 'stamina' ? 11 : 20;
    const newLevel = Math.min(maxLevel, oldLevel + 1);
    updatedSkills[chosenSkillKey as keyof typeof updatedSkills] = newLevel;
    
    const isSquadPop = (chosenSkillKey === 'stamina' && squadTrainingStamina && plannerNets.stamina === 0) ||
                       (chosenSkillKey === 'fielding' && squadTrainingFielding && plannerNets.fielding === 0);
    const btrGain = Math.round(1200 + Math.random() * 800 + (plannerNets[chosenSkillKey] || (isSquadPop ? 1 : 0)) * 400);
    const nextBtr = player.btRating + btrGain;
    
    let nextWage = player.wage;
    if (nextWeek === 1) {
      const isYoung = player.age <= 21;
      nextWage = Math.round((player.wage * (isYoung ? 1.15 : 1.05)) / 100) * 100;
    }
    
    const note = `Training Pop: ${chosenSkillKey.toUpperCase()} popped ${getSkillLabel(chosenSkillKey, oldLevel)} -> ${getSkillLabel(chosenSkillKey, newLevel)}${isSquadPop ? ' (Squad Training)' : ''}`;
    
    const newHistoryEntry = {
      season: nextSeason,
      week: nextWeek,
      btRating: nextBtr,
      wage: nextWage,
      form: player.form,
      fitness: player.fitness,
      skills: updatedSkills,
      note
    };
    
    const updatedPlayer: BattrickPlayer = {
      ...player,
      btRating: nextBtr,
      wage: nextWage,
      skills: updatedSkills,
      history: [...player.history, newHistoryEntry]
    };
    
    const updatedSquad = squad.map(p => p.id === player.id ? updatedPlayer : p);
    setSquad(updatedSquad);
    saveToLocalStorage(updatedSquad);
    setSelectedPlayer(updatedPlayer);
  };

  const handleLogWeeklySnapshot = (player: BattrickPlayer) => {
    if (!player.history || player.history.length === 0) return;
    const lastEntry = player.history[player.history.length - 1];
    
    let nextWeek = (lastEntry.week % 16) + 1;
    let nextSeason = lastEntry.season;
    if (nextWeek === 1) {
      nextSeason += 1;
    }
    
    const btrGain = Math.round(150 + Math.random() * 250);
    const nextBtr = player.btRating + btrGain;
    
    let nextWage = player.wage;
    if (nextWeek === 1) {
      const isYoung = player.age <= 21;
      nextWage = Math.round((player.wage * (isYoung ? 1.15 : 1.05)) / 100) * 100;
    }
    
    const newHistoryEntry = {
      season: nextSeason,
      week: nextWeek,
      btRating: nextBtr,
      wage: nextWage,
      form: player.form,
      fitness: player.fitness,
      skills: { ...player.skills },
      note: 'Weekly snapshot'
    };
    
    const updatedPlayer: BattrickPlayer = {
      ...player,
      btRating: nextBtr,
      wage: nextWage,
      history: [...player.history, newHistoryEntry]
    };
    
    const updatedSquad = squad.map(p => p.id === player.id ? updatedPlayer : p);
    setSquad(updatedSquad);
    saveToLocalStorage(updatedSquad);
    setSelectedPlayer(updatedPlayer);
  };

  const handleUpdatePlayerNets = (key: keyof typeof plannerNets, count: number) => {
    if (!selectedPlayer) return;
    const updatedNets = {
      ...plannerNets,
      [key]: count
    };
    setPlannerNets(updatedNets);
    const updatedPlayer: BattrickPlayer = {
      ...selectedPlayer,
      nets: updatedNets
    };
    setSelectedPlayer(updatedPlayer);
    const updatedSquad = squad.map(p => p.id === selectedPlayer.id ? updatedPlayer : p);
    setSquad(updatedSquad);
    saveToLocalStorage(updatedSquad);
  };

  // Sync planner nets when selectedPlayer changes
  useEffect(() => {
    if (selectedPlayer) {
      setPlannerNets({
        batting: selectedPlayer.nets?.batting || 0,
        bowling: selectedPlayer.nets?.bowling || 0,
        keeping: selectedPlayer.nets?.keeping || 0,
        stamina: selectedPlayer.nets?.stamina || 0,
        fielding: selectedPlayer.nets?.fielding || 0,
      });
    }
  }, [selectedPlayer]);

  // Load from LocalStorage on mount & reactive update
  const loadFromLocalStorage = () => {
    const savedSquad = localStorage.getItem('bt_squad');
    const savedFin = localStorage.getItem('bt_finances');
    if (savedSquad) {
      try {
        const parsed: BattrickPlayer[] = JSON.parse(savedSquad);
        let hasChanges = false;
        const withHistory = parsed.map(player => {
          if (!player.history || player.history.length === 0) {
            hasChanges = true;
            return {
              ...player,
              history: generateRealisticHistory(player)
            };
          }
          return player;
        });

        if (hasChanges) {
          saveToLocalStorage(withHistory);
          setSquad(withHistory);
        } else {
          setSquad(parsed);
        }

        // Keep selected player reference updated
        setSelectedPlayer((prevSelected) => {
          if (!prevSelected) return null;
          const currentList = hasChanges ? withHistory : parsed;
          const updated = currentList.find(p => p.id === prevSelected.id);
          return updated || prevSelected;
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      setSquad([]);
    }
    if (savedFin) {
      try {
        setFinances(JSON.parse(savedFin));
      } catch (e) {
        console.error(e);
      }
    } else {
      setFinances({
        cash: 0,
        members: 0,
        prOfficers: 0,
        finAdvisors: 0,
        sponsorsIncome: 0,
        gateReceipts: 0,
        interestReceived: 0,
        playerWages: 0,
        staffWages: 0,
        morale: 'respectable',
        sponsorsMood: 'respectable',
        membersConfidence: 'respectable',
        academyCondition: 'feeble',
        academyInvestment: 0,
        academyIts: 0,
        bowlingCoaches: 0,
        battingCoaches: 0,
        fieldingCoaches: 0,
        keepingCoaches: 0,
        staminaCoaches: 0,
        psychologists: 0
      });
    }
  };

  useEffect(() => {
    loadFromLocalStorage();
    window.addEventListener('storage', loadFromLocalStorage);
    return () => {
      window.removeEventListener('storage', loadFromLocalStorage);
    };
  }, []);

  function saveToLocalStorage(newSquad: BattrickPlayer[], newFin?: ClubFinances) {
    localStorage.setItem('bt_squad', JSON.stringify(newSquad));
    if (newFin) {
      localStorage.setItem('bt_finances', JSON.stringify(newFin));
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('bt_cloud_backup_request'));
  }

  // Calculations for Coach Insights / Staff optimal values
  const getPRAdvice = () => {
    // PR officers count based on member count
    const members = finances.members;
    if (members <= 0) return { current: finances.prOfficers, optimal: 0, status: 'N/A' };
    
    // BTHF Formula: 1 PR Officer per 250 members (rounded up, max 10)
    const optimal = Math.min(10, Math.max(1, Math.ceil(members / 250)));

    const diff = finances.prOfficers - optimal;
    let text = 'Perfect PR staff ratio';
    let color = 'text-emerald-600';
    if (diff > 0) {
      text = `Overstaffed by ${diff} PR staff (£${(diff * 1250).toLocaleString()}/wk wasted)`;
      color = 'text-amber-600';
    } else if (diff < 0) {
      text = `Understaffed by ${Math.abs(diff)} PR staff. Hire to boost sponsors income.`;
      color = 'text-rose-600';
    }

    return { current: finances.prOfficers, optimal, status: text, color };
  };

  const getFAAdvice = () => {
    const cash = finances.cash;
    if (cash <= 0) return { current: finances.finAdvisors, optimal: 0, status: 'N/A' };

    // BTHF Formula: 0 FAs if cash < £2.5M, 10 FAs if cash >= £2.5M
    const optimal = cash >= 2500000 ? 10 : 0;

    const diff = finances.finAdvisors - optimal;
    let text = 'Perfect staff ratio';
    let color = 'text-emerald-600';
    if (diff > 0) {
      text = `Overstaffed by ${diff} FAs. Dismiss them to save £${(diff * 1250).toLocaleString()}/wk wages.`;
      color = 'text-amber-600';
    } else if (diff < 0) {
      text = `Understaffed by ${Math.abs(diff)} FAs. Hire to maximize cash interest yield.`;
      color = 'text-rose-600';
    }

    return { current: finances.finAdvisors, optimal, status: text, color };
  };

  const weeklyIncome = finances.sponsorsIncome + finances.gateReceipts + finances.interestReceived;
  const weeklyExpenses = finances.playerWages + finances.staffWages;
  const netWeeklyCashflow = weeklyIncome - weeklyExpenses;
  const wageRatio = weeklyIncome > 0 ? (finances.playerWages / weeklyIncome) * 100 : 0;

  const prStaffAdvice = getPRAdvice();
  const faStaffAdvice = getFAAdvice();

  // Filter and Sort squad players
  const filteredSquad = squad.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'age') return a.age - b.age;
    if (sortBy === 'wage') return b.wage - a.wage;
    if (sortBy === 'btRating') return b.btRating - a.btRating;
    return getPlayerWeightedScore(b) - getPlayerWeightedScore(a);
  });

  // Find the primary designated wicketkeeper (highest keeping, then highest batting as tie-breaker)
  const getPrimaryKeeper = (playersList: BattrickPlayer[]): BattrickPlayer | null => {
    if (!playersList || playersList.length === 0) return null;
    return [...playersList].sort((a, b) => {
      if (b.skills.keeping !== a.skills.keeping) {
        return b.skills.keeping - a.skills.keeping;
      }
      return b.skills.batting - a.skills.batting;
    })[0];
  };

  const primaryKeeper = getPrimaryKeeper(squad);

  return (
    <div className="flex flex-col gap-6 w-full" id="squad-dashboard-container">
      {/* Squad list & Player inspection drawer */}
      <div className="w-full flex flex-col gap-5">
        
        {/* Filters and List */}
        <div className="bg-white border border-slate-300 rounded-xl p-3.5 sm:p-5 shadow-lg shadow-slate-400/50">
          {/* Header Row: Title, View Switcher & Search */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-slate-200 pb-3.5 mb-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-slate-800 flex items-center gap-1.5">
                    My Squad
                    <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                      {squad.length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    Showing {filteredSquad.length} of {squad.length} players
                  </p>
                </div>
              </div>

              {/* View mode toggle (Cards vs Compact Table) */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleSetViewMode('cards')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    viewMode === 'cards'
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-250'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Card View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline text-[11px]">Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSetViewMode('compact')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                    viewMode === 'compact'
                      ? 'bg-white text-slate-800 shadow-sm border border-slate-250'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title="Compact List View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline text-[11px]">List</span>
                </button>
              </div>
            </div>

            {/* Quick search input with clear button */}
            <div className="relative w-full md:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search player name..."
                className="w-full pl-8.5 pr-8 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table Filters bar (Swipeable horizontal chips on mobile) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
            {/* Horizontal scrollable role pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
              {['All', 'Batter', 'Bowler', 'Keeper', 'All-rounder'].map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                    roleFilter === role 
                      ? 'bg-slate-800 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200/60'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center justify-between sm:justify-end gap-1.5 text-xs text-slate-600">
              <span className="font-medium text-[11px] text-slate-500 flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="score">Performance Index</option>
                <option value="btRating">Battrick Rating (BTR)</option>
                <option value="wage">Weekly Wage</option>
                <option value="age">Player Age</option>
                <option value="name">Player Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Players List */}
          {filteredSquad.length === 0 ? (
            <div className="text-center py-12 px-6 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50 flex flex-col items-center justify-center">
              <User className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-800">No matching squad members found.</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                {searchQuery || roleFilter !== 'All' 
                  ? 'Try clearing your search query or role filter.'
                  : 'Paste your Battrick squad details in the Roster Sync tab to populate your roster.'}
              </p>
              {(searchQuery || roleFilter !== 'All') ? (
                <button
                  onClick={() => { setSearchQuery(''); setRoleFilter('All'); }}
                  className="mt-3 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  Reset Filters
                </button>
              ) : (
                setActiveTab && (
                  <button
                    onClick={() => setActiveTab('sync')}
                    className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
                  >
                    Go to Roster Sync
                  </button>
                )
              )}
            </div>
          ) : viewMode === 'compact' ? (
            /* Compact Mobile-First List View */
            <div className="max-h-[65vh] sm:max-h-[640px] overflow-y-auto divide-y divide-slate-150 rounded-xl border border-slate-200 bg-white shadow-sm overscroll-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
              {filteredSquad.map((player) => {
                const pScore = getPlayerWeightedScore(player);
                const isSelected = selectedPlayer?.id === player.id;
                const changes = getWeeklyChanges(player);
                const hasPop = changes && changes.skillPops && changes.skillPops.length > 0;
                const topSkill = getTopSkillInfo(player);

                return (
                  <div
                    key={player.id}
                    onClick={() => {
                      if (onSelectPlayer) {
                        onSelectPlayer(player.id);
                      } else {
                        setSelectedPlayer(player);
                      }
                    }}
                    className={`p-3 transition duration-150 cursor-pointer flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 ${
                      isSelected ? 'bg-indigo-50/70' : hasPop ? 'bg-emerald-50/30' : ''
                    }`}
                  >
                    {/* Left: Avatar + Details */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-xs border ${
                        player.role === 'Batter' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        player.role === 'Bowler' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        player.role === 'Keeper' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {player.name.charAt(0)}
                      </div>
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 truncate">{player.name}</span>
                          <span className="text-[10px] text-slate-400">({player.age}y)</span>
                          {primaryKeeper && primaryKeeper.id === player.id && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[8px] px-1 py-0.2 rounded font-bold uppercase">
                              WK
                            </span>
                          )}
                          {hasPop && (
                            <span className="bg-emerald-100 text-emerald-800 text-[8px] px-1 py-0.2 rounded font-bold">
                              ▲ POP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-medium">{player.role}</span>
                          <span>•</span>
                          <span>BTR <strong className="text-slate-700 font-mono">{player.btRating.toLocaleString()}</strong></span>
                          <span>•</span>
                          <span>£{player.wage.toLocaleString()}/wk</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Top Skill + IQ + Chevron */}
                    <div className="flex items-center gap-2.5 shrink-0 text-right">
                      <div className="hidden xs:flex flex-col items-end">
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-mono">
                          {topSkill.label}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 truncate max-w-[80px]">
                          {topSkill.name}
                        </span>
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-[8px] uppercase font-bold text-slate-400">IQ</span>
                        <span className="font-mono font-black text-xs text-indigo-700">{pScore}</span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Cards View (Mobile-Friendly Responsive Grid) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[65vh] sm:max-h-[640px] overflow-y-auto pr-1 overscroll-contain [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
              {filteredSquad.map((player) => {
                const pScore = getPlayerWeightedScore(player);
                const isSelected = selectedPlayer?.id === player.id;
                const changes = getWeeklyChanges(player);

                const batPop = changes?.skillPops.find(p => p.skill === 'Batting');
                const bowlPop = changes?.skillPops.find(p => p.skill === 'Bowling');
                const keepPop = changes?.skillPops.find(p => p.skill === 'Wicket Keeping');
                const stamPop = changes?.skillPops.find(p => p.skill === 'Stamina');

                const hasPop = changes && changes.skillPops && changes.skillPops.length > 0;
                let borderHighlight = '';
                if (hasPop) {
                  borderHighlight = 'border-l-4 border-l-emerald-500';
                } else if (changes) {
                  if (changes.isPositive) borderHighlight = 'border-l-4 border-l-emerald-500';
                  else if (changes.isNegative) borderHighlight = 'border-l-4 border-l-rose-500';
                }

                let cardBgClass = '';
                if (isSelected) {
                  cardBgClass = hasPop
                    ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500/25'
                    : 'bg-[#fefefe] border-slate-400 ring-2 ring-slate-400/25';
                } else {
                  cardBgClass = hasPop
                    ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-450 hover:bg-emerald-100/60'
                    : 'bg-[#fefefe] border-slate-200 hover:border-slate-350 hover:bg-slate-50/60';
                }

                const shadowClass = isSelected
                  ? 'shadow-inner'
                  : 'shadow-md shadow-slate-300/40 hover:shadow-lg hover:shadow-slate-300/60';
                
                return (
                  <div
                    key={player.id}
                    onClick={() => {
                      if (onSelectPlayer) {
                        onSelectPlayer(player.id);
                      } else {
                        setSelectedPlayer(player);
                      }
                    }}
                    className={`p-3.5 sm:p-4 rounded-xl border text-left transition duration-150 cursor-pointer active:scale-[0.99] flex flex-col justify-between gap-2.5 ${borderHighlight} ${cardBgClass} ${shadowClass}`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="min-w-0 pr-2">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{player.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">Age {player.age}</span>
                          {primaryKeeper && primaryKeeper.id === player.id && (
                            <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm shrink-0">
                              🧤 Keeper
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="font-semibold">{player.role}</span>
                          <span>•</span>
                          <span>BT {player.btRating.toLocaleString()}</span>
                          {changes && changes.btRatingDiff !== 0 && (
                            <span className={`text-[9px] font-mono font-bold ${changes.btRatingDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              ({changes.btRatingDiff > 0 ? '+' : ''}{changes.btRatingDiff.toLocaleString()})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Wage: <span className="font-mono text-slate-600 font-semibold">£{player.wage.toLocaleString()}</span>
                          {changes && changes.wageDiff !== 0 && (
                            <span className={`text-[9px] ml-1 font-semibold ${changes.wageDiff > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                              ({changes.wageDiff > 0 ? '+' : ''}{changes.wageDiff.toLocaleString()})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[9px] text-slate-400 uppercase font-semibold">IQ INDEX</div>
                        <div className="font-mono font-black text-sm sm:text-base text-indigo-700">{pScore}</div>
                        {player.nets.batting + player.nets.bowling + player.nets.keeping > 0 && (
                          <div className="inline-block mt-1 px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200/50 text-[9px] rounded font-mono font-bold">
                            Active Nets
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Weekly Changes Quick Info */}
                    {changes && (changes.btRatingDiff !== 0 || changes.formDiff !== 0 || changes.fitnessDiff !== 0 || changes.skillPops.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-0.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        {changes.skillPops.map((pop, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[9px] font-bold rounded flex items-center gap-0.5">
                            ▲ Pop: {pop.skill}
                          </span>
                        ))}
                        {changes.formDiff !== 0 && (
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded flex items-center gap-0.5 ${
                            changes.formDiff > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {changes.formDiff > 0 ? '▲' : '▼'} Form {changes.formDiff > 0 ? '+' : ''}{changes.formDiff}
                          </span>
                        )}
                        {changes.fitnessDiff !== 0 && (
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded flex items-center gap-0.5 ${
                            changes.fitnessDiff > 0 ? 'bg-sky-50 text-sky-700' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {changes.fitnessDiff > 0 ? '▲' : '▼'} Fit {changes.fitnessDiff > 0 ? '+' : ''}{changes.fitnessDiff}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Compact Player Skills Direct Display */}
                    <div className="border-t border-slate-200 pt-2 grid grid-cols-4 gap-1 sm:gap-1.5 text-[10px]">
                      {/* BAT */}
                      <div className={`px-1 sm:px-1.5 py-1 rounded border flex flex-col transition-colors duration-150 ${
                        batPop 
                          ? batPop.to > batPop.from 
                            ? 'bg-emerald-100 border-emerald-400 ring-1 ring-emerald-400/30 shadow-sm' 
                            : 'bg-rose-100 border-rose-400 ring-1 ring-rose-400/30 shadow-sm'
                          : 'bg-slate-200/50 border-slate-300'
                      }`}>
                        <span className={`text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider font-mono ${
                          batPop 
                            ? batPop.to > batPop.from 
                              ? 'text-emerald-700 font-extrabold' 
                              : 'text-rose-700 font-extrabold'
                            : 'text-slate-400'
                        }`}>
                          BAT {batPop ? (batPop.to > batPop.from ? '▲' : '▼') : ''}
                        </span>
                        <span className={`font-bold text-[9px] sm:text-[10px] truncate capitalize ${
                          batPop 
                            ? batPop.to > batPop.from 
                              ? 'text-emerald-800' 
                              : 'text-rose-800'
                            : 'text-slate-700'
                        }`}>
                          {SKILL_LEVELS[player.skills.batting] || 'useless'}
                        </span>
                      </div>

                      {/* BOWL */}
                      <div className={`px-1 sm:px-1.5 py-1 rounded border flex flex-col transition-colors duration-150 ${
                        bowlPop 
                          ? bowlPop.to > bowlPop.from 
                            ? 'bg-emerald-100 border-emerald-400 ring-1 ring-emerald-400/30 shadow-sm' 
                            : 'bg-rose-100 border-rose-400 ring-1 ring-rose-400/30 shadow-sm'
                          : 'bg-slate-200/50 border-slate-300'
                      }`}>
                        <span className={`text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider font-mono ${
                          bowlPop 
                            ? bowlPop.to > bowlPop.from 
                              ? 'text-emerald-700 font-extrabold' 
                              : 'text-rose-700 font-extrabold'
                            : 'text-slate-400'
                        }`}>
                          BOWL {bowlPop ? (bowlPop.to > bowlPop.from ? '▲' : '▼') : ''}
                        </span>
                        <span className={`font-bold text-[9px] sm:text-[10px] truncate capitalize ${
                          bowlPop 
                            ? bowlPop.to > bowlPop.from 
                              ? 'text-emerald-800' 
                              : 'text-rose-800'
                            : 'text-slate-700'
                        }`}>
                          {SKILL_LEVELS[player.skills.bowling] || 'useless'}
                        </span>
                      </div>

                      {/* KEEP */}
                      <div className={`px-1 sm:px-1.5 py-1 rounded border flex flex-col transition-colors duration-150 ${
                        keepPop 
                          ? keepPop.to > keepPop.from 
                            ? 'bg-emerald-100 border-emerald-400 ring-1 ring-emerald-400/30 shadow-sm' 
                            : 'bg-rose-100 border-rose-400 ring-1 ring-rose-400/30 shadow-sm'
                          : 'bg-slate-200/50 border-slate-300'
                      }`}>
                        <span className={`text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider font-mono ${
                          keepPop 
                            ? keepPop.to > keepPop.from 
                              ? 'text-emerald-700 font-extrabold' 
                              : 'text-rose-700 font-extrabold'
                            : 'text-slate-400'
                        }`}>
                          KEEP {keepPop ? (keepPop.to > keepPop.from ? '▲' : '▼') : ''}
                        </span>
                        <span className={`font-bold text-[9px] sm:text-[10px] truncate capitalize ${
                          keepPop 
                            ? keepPop.to > keepPop.from 
                              ? 'text-emerald-800' 
                              : 'text-rose-800'
                            : 'text-slate-700'
                        }`}>
                          {SKILL_LEVELS[player.skills.keeping] || 'useless'}
                        </span>
                      </div>

                      {/* STAM */}
                      <div className={`px-1 sm:px-1.5 py-1 rounded border flex flex-col transition-colors duration-150 ${
                        stamPop 
                          ? stamPop.to > stamPop.from 
                            ? 'bg-emerald-100 border-emerald-400 ring-1 ring-emerald-400/30 shadow-sm' 
                            : 'bg-rose-100 border-rose-400 ring-1 ring-rose-400/30 shadow-sm'
                          : 'bg-slate-200/50 border-slate-300'
                      }`}>
                        <span className={`text-[7.5px] sm:text-[8px] font-bold uppercase tracking-wider font-mono ${
                          stamPop 
                            ? stamPop.to > stamPop.from 
                              ? 'text-emerald-700 font-extrabold' 
                              : 'text-rose-700 font-extrabold'
                            : 'text-slate-400'
                        }`}>
                          STAM {stamPop ? (stamPop.to > stamPop.from ? '▲' : '▼') : ''}
                        </span>
                        <span className={`font-bold text-[9px] sm:text-[10px] truncate capitalize ${
                          stamPop 
                            ? stamPop.to > stamPop.from 
                              ? 'text-emerald-800' 
                              : 'text-rose-800'
                            : 'text-slate-700'
                        }`}>
                          {getSkillLabel('stamina', player.skills.stamina)}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Tap Prompt */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                      <span className="truncate">Tap to inspect career stats & training</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Player Inspector Panel */}
        {selectedPlayer && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4 relative animate-fadeIn">
            <button
              onClick={() => setSelectedPlayer(null)}
              className="absolute top-4 right-4 text-xs text-slate-400 hover:text-slate-600 font-medium border border-slate-200 px-2 py-0.5 rounded"
            >
              Close
            </button>

            <div className="border-b border-slate-100 pb-3">
              <h4 className="font-display font-bold text-base text-slate-800 flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                Player Audit: {selectedPlayer.name}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Age: <span className="font-semibold text-slate-700">{selectedPlayer.age}</span> | 
                Battrick Rating: <span className="font-semibold text-slate-700">{selectedPlayer.btRating.toLocaleString()}</span> | 
                Wage: <span className="font-semibold text-slate-700">£{selectedPlayer.wage.toLocaleString()}/wk</span>
              </p>
            </div>

            {/* Weekly changes highlight banner */}
            {(() => {
              const changes = getWeeklyChanges(selectedPlayer);
              if (!changes) return null;
              
              const hasChanges = changes.btRatingDiff !== 0 || changes.formDiff !== 0 || changes.fitnessDiff !== 0 || changes.skillPops.length > 0;
              if (!hasChanges) {
                return (
                  <div className="bg-slate-50/50 text-slate-500 border border-slate-200/50 p-3 rounded-lg text-[11px] flex items-center gap-2">
                    <Info className="w-4 h-4 text-slate-400" />
                    <span>No changes detected this week. Player skills, form, and fitness are stable compared to last week.</span>
                  </div>
                );
              }

              return (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                      Weekly Progression Snapshot
                    </span>
                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/30">
                      Season {selectedPlayer.history?.[selectedPlayer.history.length - 1]?.season} Wk {selectedPlayer.history?.[selectedPlayer.history.length - 1]?.week}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* BTR change */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-150 flex flex-col gap-0.5 shadow-sm">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">BT Rating</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-700">{selectedPlayer.btRating.toLocaleString()}</span>
                        {changes.btRatingDiff !== 0 && (
                          <span className={`text-[10px] font-bold ${changes.btRatingDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {changes.btRatingDiff > 0 ? '▲ +' : '▼ '}{changes.btRatingDiff.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Wage change */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-150 flex flex-col gap-0.5 shadow-sm">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Wage /wk</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-700">£{selectedPlayer.wage.toLocaleString()}</span>
                        {changes.wageDiff !== 0 && (
                          <span className={`text-[10px] font-bold ${changes.wageDiff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {changes.wageDiff > 0 ? '▲ +' : '▼ '}{changes.wageDiff.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Form change */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-150 flex flex-col gap-0.5 shadow-sm">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Current Form</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-700">{selectedPlayer.form}/10</span>
                        {changes.formDiff !== 0 && (
                          <span className={`text-[10px] font-bold ${changes.formDiff > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {changes.formDiff > 0 ? '▲ +' : '▼ '}{changes.formDiff}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Fitness change */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-150 flex flex-col gap-0.5 shadow-sm">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Fitness Level</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-700">{selectedPlayer.fitness}/10</span>
                        {changes.fitnessDiff !== 0 && (
                          <span className={`text-[10px] font-bold ${changes.fitnessDiff > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {changes.fitnessDiff > 0 ? '▲ +' : '▼ '}{changes.fitnessDiff}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Skill Pops detail */}
                  {changes.skillPops.length > 0 && (
                    <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-lg flex flex-col gap-1.5">
                      <span className="text-[9px] text-emerald-800 font-bold uppercase tracking-wider">🚀 Training pops triggered this week</span>
                      <div className="flex flex-col gap-1">
                        {changes.skillPops.map((pop, i) => (
                          <div key={i} className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                            <span className="text-emerald-600 font-bold">▲</span>
                            <span className="font-semibold">{pop.skill}:</span>
                            <span className="font-mono text-slate-400 line-through text-[10px]">{SKILL_LEVELS[pop.from]}</span>
                            <span className="text-slate-400 font-bold">→</span>
                            <span className="font-mono text-emerald-700 font-bold">{SKILL_LEVELS[pop.to]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Inspector Tab Selector */}
            <div className="flex border-b border-slate-100 pb-px gap-2">
              <button
                id="tab-inspector-skills"
                onClick={() => setInspectorTab('skills')}
                className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px transition duration-150 cursor-pointer ${
                  inspectorTab === 'skills'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Skills & Market Advisor
              </button>
              <button
                id="tab-inspector-history"
                onClick={() => setInspectorTab('history')}
                className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px transition duration-150 flex items-center gap-1.5 cursor-pointer ${
                  inspectorTab === 'history'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                Weekly Progress Report
              </button>
            </div>

            {inspectorTab === 'skills' && (
              <>
                {/* Career Trade Planning Decisions (HOLD/DEVELOP/TRADE) */}
                {(() => {
                  const trade = getTradeAction(selectedPlayer);
                  const actionColors = {
                    HOLD: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    DEVELOP: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                    TRADE: 'bg-rose-50 text-rose-800 border-rose-200',
                    PEAK: 'bg-amber-50 text-amber-800 border-amber-200'
                  };
                  return (
                    <div className={`p-4 rounded-lg border ${actionColors[trade.action]} shadow-sm flex gap-3 text-xs`}>
                      <Activity className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold uppercase block mb-1">Squad Decision: {trade.action}</span>
                        <span className="leading-relaxed block">{trade.reason}</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Skills grid summary */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">Player Skills</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    {[
                      { name: 'Stamina', key: 'stamina' as const, val: selectedPlayer.skills.stamina, hasNet: (selectedPlayer.nets?.stamina || 0) > 0 },
                      { name: 'Wicket Keeping', key: 'keeping' as const, val: selectedPlayer.skills.keeping, hasNet: (selectedPlayer.nets?.keeping || 0) > 0 },
                      { name: 'Batting', key: 'batting' as const, val: selectedPlayer.skills.batting, hasNet: (selectedPlayer.nets?.batting || 0) > 0 },
                      { name: 'Concentration', key: 'concentration' as const, val: selectedPlayer.skills.concentration, hasNet: false },
                      { name: 'Bowling', key: 'bowling' as const, val: selectedPlayer.skills.bowling, hasNet: (selectedPlayer.nets?.bowling || 0) > 0, sub: selectedPlayer.bowlingType !== 'None' ? selectedPlayer.bowlingType : null },
                      { name: 'Consistency', key: 'consistency' as const, val: selectedPlayer.skills.consistency, hasNet: false },
                      { name: 'Fielding', key: 'fielding' as const, val: selectedPlayer.skills.fielding || 0, hasNet: (selectedPlayer.nets?.fielding || 0) > 0 },
                    ].map(sk => {
                      const levelStr = getSkillLabel(sk.key, sk.val);
                      const displayedLevel = sk.hasNet ? `${levelStr}*` : levelStr;
                      const changes = getWeeklyChanges(selectedPlayer);
                      const pop = changes?.skillPops.find(p => p.skill === sk.name);
                      const isUp = pop && pop.to > pop.from;
                      const isDown = pop && pop.to < pop.from;
                      
                      return (
                        <div key={sk.name} className={`flex flex-col gap-0.5 border-b border-slate-100 pb-1.5 transition-colors duration-150 ${pop ? (isUp ? 'bg-emerald-100 border border-emerald-300 rounded p-1.5 -mx-1.5 my-0.5 shadow-sm' : 'bg-rose-100 border border-rose-300 rounded p-1.5 -mx-1.5 my-0.5 shadow-sm') : ''}`} id={`skill-${sk.name.toLowerCase().replace(/\s+/g, '-')}`}>
                          <span className={`text-[10px] font-bold uppercase ${
                            isUp ? 'text-emerald-600 font-extrabold' : isDown ? 'text-rose-600 font-extrabold' : 'text-slate-400'
                          }`}>
                            {sk.name}{pop ? (isUp ? ' ▲' : ' ▼') : ''}:
                          </span>
                          <span className={`text-xs font-semibold ${
                            isUp ? 'text-emerald-700 font-bold' : isDown ? 'text-rose-700 font-bold' : sk.hasNet ? 'text-indigo-600 font-bold' : 'text-slate-800'
                          }`}>
                            {displayedLevel} {pop && `(${getSkillLabel(sk.key, pop.from)} → ${getSkillLabel(sk.key, pop.to)})`}
                          </span>
                          {sk.sub && (
                            <span className="text-[9px] text-indigo-600 font-mono font-medium">{sk.sub}</span>
                          )}
                        </div>
                      );
                    })}

                    {/* Secondary Skills: Leadership & Experience */}
                    {[
                      { name: 'Leadership', val: selectedPlayer.skills.leadership },
                      { name: 'Experience', val: selectedPlayer.skills.experience },
                    ].map(sk => {
                      const changes = getWeeklyChanges(selectedPlayer);
                      const pop = changes?.skillPops.find(p => p.skill === sk.name);
                      const isUp = pop && pop.to > pop.from;
                      const isDown = pop && pop.to < pop.from;

                      return (
                        <div key={sk.name} className={`flex flex-col gap-0.5 border-b border-slate-100 pb-1.5 transition-colors duration-150 ${pop ? (isUp ? 'bg-emerald-100 border border-emerald-300 rounded p-1.5 -mx-1.5 my-0.5 shadow-sm' : 'bg-rose-100 border border-rose-300 rounded p-1.5 -mx-1.5 my-0.5 shadow-sm') : 'opacity-80'}`} id={`skill-${sk.name.toLowerCase()}`}>
                          <span className={`text-[10px] font-bold uppercase ${
                            isUp ? 'text-emerald-600 font-extrabold' : isDown ? 'text-rose-600 font-extrabold' : 'text-slate-400'
                          }`}>
                            {sk.name}{pop ? (isUp ? ' ▲' : ' ▼') : ''}:
                          </span>
                          <span className={`text-xs font-semibold ${
                            isUp ? 'text-emerald-700 font-bold' : isDown ? 'text-rose-700 font-bold' : 'text-slate-700'
                          }`}>
                            {SKILL_LEVELS[sk.val] || 'useless'} {pop && `(${SKILL_LEVELS[pop.from]} → ${SKILL_LEVELS[pop.to]})`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* DUAL GRID: Training & Valuation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
                  
                  {/* Column 1: Interactive Net & Training Simulator */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-display font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        Interactive Net Simulator
                      </h5>
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        Max 4 Nets Total
                      </span>
                    </div>

                    {/* Coach Selection */}
                    <div className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded border border-slate-200/50">
                      <span className="text-slate-600 font-medium">Club Coach Quality:</span>
                      <select
                        value={coachLevel}
                        onChange={(e) => setCoachLevel(parseInt(e.target.value))}
                        className="bg-slate-50 border border-slate-200 rounded px-2 py-0.5 font-mono text-[11px] text-slate-700 outline-none"
                      >
                        <option value={5}>competent (5)</option>
                        <option value={6}>respectable (6)</option>
                        <option value={7}>proficient (7)</option>
                        <option value={8}>strong (8)</option>
                        <option value={9}>superb (9) *standard</option>
                        <option value={10}>quality (10)</option>
                        <option value={11}>remarkable (11)</option>
                      </select>
                    </div>

                    {/* Squad Training Toggles */}
                    <div className="bg-white p-2.5 rounded border border-slate-200/60 flex flex-col gap-2">
                      <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>Squad-Wide Training Flags</span>
                        <span className="text-[9px] font-normal text-slate-400">Affects entire squad</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSquadStamina(!squadTrainingStamina)}
                          className={`px-2 py-1.5 rounded text-[10px] font-semibold flex flex-col items-start border transition cursor-pointer text-left ${
                            squadTrainingStamina 
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-400/30' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>⚡ Squad Stamina</span>
                            <span className={`text-[8px] font-bold px-1 rounded ${squadTrainingStamina ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'}`}>
                              {squadTrainingStamina ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <span className="text-[8px] opacity-75 mt-0.5 font-normal">Flat 6 wks (Age 17-32)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleSquadFielding(!squadTrainingFielding)}
                          className={`px-2 py-1.5 rounded text-[10px] font-semibold flex flex-col items-start border transition cursor-pointer text-left ${
                            squadTrainingFielding 
                              ? 'bg-blue-50 border-blue-300 text-blue-800 ring-1 ring-blue-400/30' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>🧤 Squad Fielding</span>
                            <span className={`text-[8px] font-bold px-1 rounded ${squadTrainingFielding ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-600'}`}>
                              {squadTrainingFielding ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <span className="text-[8px] opacity-75 mt-0.5 font-normal">5 to 6 wks per pop</span>
                        </button>
                      </div>
                    </div>

                    {/* Nets Editor list */}
                    <div className="flex flex-col gap-1.5">
                      {[
                        { label: 'Batting Nets', key: 'batting' as const, level: selectedPlayer.skills.batting },
                        { label: 'Bowling Nets', key: 'bowling' as const, level: selectedPlayer.skills.bowling },
                        { label: 'Keeping Nets', key: 'keeping' as const, level: selectedPlayer.skills.keeping },
                        { label: 'Stamina Nets', key: 'stamina' as const, level: selectedPlayer.skills.stamina },
                        { label: 'Fielding Nets', key: 'fielding' as const, level: selectedPlayer.skills.fielding || 0 },
                      ].map((n) => {
                        const count = plannerNets[n.key];
                        const totalNets = plannerNets.batting + plannerNets.bowling + plannerNets.keeping + plannerNets.stamina + plannerNets.fielding;
                        
                        return (
                          <div key={n.key} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-slate-200/40 text-xs">
                            <div>
                              <span className="font-semibold text-slate-700">{n.label}</span>
                              {n.level > 0 && (
                                <span className="text-[9px] text-slate-400 font-medium block">
                                  Current level: {getSkillLabel(n.key, n.level)}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                id={`btn-dec-${n.key}`}
                                onClick={() => handleUpdatePlayerNets(n.key, Math.max(0, count - 1))}
                                disabled={count === 0}
                                className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition disabled:opacity-40"
                              >
                                -
                              </button>
                              <span className="w-4 text-center font-mono font-bold text-slate-800">{count}</span>
                              <button
                                id={`btn-inc-${n.key}`}
                                onClick={() => {
                                  if (totalNets < 3) {
                                    handleUpdatePlayerNets(n.key, count + 1);
                                  }
                                }}
                                disabled={totalNets >= 3 || count >= 3}
                                className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition disabled:opacity-40"
                                title={count >= 3 ? "Diminishing returns max out at 3 nets" : "Maximum 3 nets per player"}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Training pop simulator metrics */}
                    <div className="bg-indigo-50/40 p-2.5 rounded border border-indigo-100/50 flex flex-col gap-1 text-[11px] text-indigo-950 mt-1">
                      <div className="flex justify-between font-bold text-indigo-900 mb-1 border-b border-indigo-100/30 pb-1">
                        <span>Simulated Pop Speeds</span>
                        <span>Cost: £{((plannerNets.batting + plannerNets.bowling + plannerNets.keeping + plannerNets.stamina + plannerNets.fielding) * 1250).toLocaleString()}/wk</span>
                      </div>

                      {/* Weeks estimates output */}
                      {(() => {
                        const estimates: { label: string; weeks: number; note?: string }[] = [];
                        if (plannerNets.batting > 0) {
                          estimates.push({ label: 'Batting', weeks: estimateWeeksToNextLevel(selectedPlayer.skills.batting, selectedPlayer.age, plannerNets.batting, coachLevel, 'batting') });
                        }
                        if (plannerNets.bowling > 0) {
                          estimates.push({ label: 'Bowling', weeks: estimateWeeksToNextLevel(selectedPlayer.skills.bowling, selectedPlayer.age, plannerNets.bowling, coachLevel, 'bowling') });
                        }
                        if (plannerNets.keeping > 0) {
                          estimates.push({ label: 'Keeping', weeks: estimateWeeksToNextLevel(selectedPlayer.skills.keeping, selectedPlayer.age, plannerNets.keeping, coachLevel, 'keeping') });
                        }
                        if (plannerNets.stamina > 0 || squadTrainingStamina) {
                          const w = estimateWeeksToNextLevel(selectedPlayer.skills.stamina, selectedPlayer.age, plannerNets.stamina, coachLevel, 'stamina', squadTrainingStamina);
                          const isIndividualFlatRange = !squadTrainingStamina && selectedPlayer.age >= 17 && selectedPlayer.age <= 32;
                          estimates.push({ 
                            label: plannerNets.stamina > 0 ? 'Stamina' : 'Stamina (Squad Training)', 
                            weeks: w,
                            note: squadTrainingStamina ? 'Flat 5-6 wks (All Ages)' : (isIndividualFlatRange ? 'Flat 6.0 wks (Age 17-32)' : undefined)
                          });
                        }
                        if (plannerNets.fielding > 0 || squadTrainingFielding) {
                          const w = estimateWeeksToNextLevel(selectedPlayer.skills.fielding || 0, selectedPlayer.age, plannerNets.fielding, coachLevel, 'fielding', squadTrainingFielding);
                          estimates.push({ 
                            label: plannerNets.fielding > 0 ? 'Fielding' : 'Fielding (Squad Training)', 
                            weeks: w,
                            note: squadTrainingFielding ? 'Flat 5-6 wks (All Ages)' : '5 to 6 wks per pop'
                          });
                        }

                        if (estimates.length === 0) {
                          return <span className="text-slate-500 italic text-[10px]">No nets or squad training active. Assign nets or toggle squad training.</span>;
                        }

                        return (
                          <div className="flex flex-col gap-1 font-semibold text-slate-700">
                            {estimates.map((est) => (
                              <div key={est.label} className="flex justify-between items-center bg-white/70 px-2 py-1 rounded">
                                <span className="text-slate-600 font-medium flex items-center gap-1">
                                  {est.label}:
                                  {est.note && <span className="text-[9px] text-slate-400 font-normal">({est.note})</span>}
                                </span>
                                <span className="font-mono text-indigo-700 font-bold">{est.weeks} weeks</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Column 2: Net Forecast Prediction */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 flex flex-col gap-3">
                    <h5 className="font-display font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                      Net Forecast Prediction
                    </h5>

                    {(() => {
                      const lastHistory = selectedPlayer.history && selectedPlayer.history.length > 0 
                        ? selectedPlayer.history[selectedPlayer.history.length - 1] 
                        : { season: 65, week: 10 };
                      const currentSeason = lastHistory.season || 65;
                      const currentWeek = lastHistory.week || 10;

                      // Helper function to add weeks to season & week
                      function addWeeks(s: number, w: number, add: number): { season: number, week: number } {
                        const roundedAdd = Math.round(add);
                        let totalWeeks = (s - 1) * 16 + (w - 1) + roundedAdd;
                        const newS = Math.floor(totalWeeks / 16) + 1;
                        const newW = (totalWeeks % 16) + 1;
                        return { season: newS, week: newW };
                      }

                      // Efficiency calculation
                      // 17yo has 100% efficiency, decreases as age increases
                      const rawEfficiency = 100 / Math.pow(1.22, selectedPlayer.age - 17);
                      const efficiency = Math.min(100, Math.max(2, Math.round(rawEfficiency)));

                      let efficiencyText = '';
                      let efficiencyColor = '';
                      if (selectedPlayer.age <= 19) {
                        efficiencyText = '⚡ Elite Speed: Young age guarantees rapid progression. Ideal for development!';
                        efficiencyColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                      } else if (selectedPlayer.age <= 22) {
                        efficiencyText = '🏃 Good Speed: Moderate standard progression. Keep focused on primary skills.';
                        efficiencyColor = 'text-blue-700 bg-blue-50 border-blue-100';
                      } else if (selectedPlayer.age <= 26) {
                        efficiencyText = '🐢 Slow Speed: Mature age limits training velocity. High intensity (multiple nets) required.';
                        efficiencyColor = 'text-amber-700 bg-amber-50 border-amber-100';
                      } else {
                        efficiencyText = '⛔ Extremely Inefficient: Training is very slow. Nets are only recommended to keep fitness/stamina high.';
                        efficiencyColor = 'text-rose-700 bg-rose-50 border-rose-100';
                      }

                      const forecasts: {
                        skillName: string;
                        currentLevel: number;
                        targetLevel: number;
                        weeksNeeded: number;
                        targetSeason: number;
                        targetWeek: number;
                        nets: number;
                      }[] = [];

                      const activeNetsList = [
                        { key: 'batting' as const, label: 'Batting', level: selectedPlayer.skills.batting, isSquad: false },
                        { key: 'bowling' as const, label: 'Bowling', level: selectedPlayer.skills.bowling, isSquad: false },
                        { key: 'keeping' as const, label: 'Wicket Keeping', level: selectedPlayer.skills.keeping, isSquad: false },
                        { key: 'stamina' as const, label: 'Stamina', level: selectedPlayer.skills.stamina, isSquad: squadTrainingStamina },
                        { key: 'fielding' as const, label: 'Fielding', level: selectedPlayer.skills.fielding || 0, isSquad: squadTrainingFielding },
                      ];

                      activeNetsList.forEach((n) => {
                        const count = plannerNets[n.key];
                        const maxLevelForSkill = n.key === 'stamina' ? 11 : 20;
                        const isTrainingActive = count > 0 || (n.isSquad && count === 0);
                        if (isTrainingActive && n.level < maxLevelForSkill) {
                          const weeks = estimateWeeksToNextLevel(n.level, selectedPlayer.age, count, coachLevel, n.key, n.isSquad);
                          if (weeks !== Infinity && weeks > 0) {
                            const target = addWeeks(currentSeason, currentWeek, weeks);
                            forecasts.push({
                              skillName: n.label + (count === 0 && n.isSquad ? ' (Squad)' : ''),
                              currentLevel: n.level,
                              targetLevel: n.level + 1,
                              weeksNeeded: weeks,
                              targetSeason: target.season,
                              targetWeek: target.week,
                              nets: count,
                            });
                          }
                        }
                      });

                      // BTR / Wage projection
                      let btrGain = 0;
                      forecasts.forEach(f => {
                        if (f.skillName === 'Batting' || f.skillName === 'Bowling' || f.skillName === 'Wicket Keeping') {
                          btrGain += 1800;
                        } else if (f.skillName === 'Fielding') {
                          btrGain += 600;
                        } else if (f.skillName === 'Stamina') {
                          btrGain += 400;
                        }
                      });
                      const projectedBtr = selectedPlayer.btRating + btrGain;
                      const isYoung = selectedPlayer.age <= 21;
                      const projectedWage = btrGain > 0 
                        ? Math.round((selectedPlayer.wage * (isYoung ? 1.15 : 1.05) + (btrGain * 0.12)) / 50) * 50
                        : selectedPlayer.wage;

                      if (forecasts.length === 0) {
                        return (
                          <div className="flex flex-col gap-3 h-full justify-between py-1">
                            <div className="text-center py-6 px-4 bg-white rounded-xl border border-slate-150 shadow-sm flex flex-col items-center justify-center gap-2">
                              <Calendar className="w-8 h-8 text-slate-300 animate-pulse" />
                              <span className="text-xs font-bold text-slate-700">No Nets Assigned</span>
                              <span className="text-[11px] text-slate-400 leading-normal max-w-[200px]">
                                Assign training nets in the interactive simulator to forecast exact pop dates and ratings!
                              </span>
                            </div>

                            {/* Show age speed anyway */}
                            <div className={`p-3 rounded-lg border text-[10px] leading-relaxed font-medium ${efficiencyColor}`}>
                              <div className="font-bold flex justify-between mb-1">
                                <span>Training Efficiency Score</span>
                                <span className="font-mono font-extrabold">{efficiency}%</span>
                              </div>
                              <p className="text-slate-600 font-normal">{efficiencyText}</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col gap-3 justify-between h-full">
                          {/* Efficiency Badge */}
                          <div className={`p-2.5 rounded-lg border text-[10px] leading-normal font-medium ${efficiencyColor} shadow-sm`}>
                            <div className="font-bold flex justify-between items-center mb-1 border-b border-black/5 pb-1">
                              <span>Training Speed Efficiency</span>
                              <span className="font-mono font-extrabold text-[11px] bg-white/70 px-1.5 py-0.5 rounded border border-black/5">{efficiency}%</span>
                            </div>
                            <p className="text-slate-600 font-normal">{efficiencyText}</p>
                          </div>

                          {/* List of predicted pops */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Projected Pop Milestones</span>
                            <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                              {forecasts.map((f, idx) => (
                                <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-150 shadow-sm flex flex-col gap-1">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
                                      {f.skillName}
                                    </span>
                                    <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100/30">
                                      {f.nets} {f.nets === 1 ? 'Net' : 'Nets'}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-baseline text-[11px]">
                                    <div className="text-slate-500 font-medium flex items-center gap-1">
                                      <span>{getSkillLabel(f.skillName, f.currentLevel)}</span>
                                      <span className="text-slate-400 text-[9px]">→</span>
                                      <span className="text-indigo-700 font-bold">{getSkillLabel(f.skillName, f.targetLevel)}</span>
                                    </div>
                                    <div className="font-mono text-[10px] font-bold text-emerald-700">
                                      In {f.weeksNeeded} wks
                                    </div>
                                  </div>
                                  <div className="flex justify-between items-center mt-1 border-t border-slate-50 pt-1 text-[10px] text-slate-400">
                                    <span>Expected Arrival:</span>
                                    <span className="font-bold text-indigo-800 font-mono">Season {f.targetSeason} Wk {f.targetWeek}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Projected rating & financial outlook */}
                          <div className="bg-white p-2.5 rounded-lg border border-slate-150 shadow-sm flex flex-col gap-1.5">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">End-Of-Training Rating Outlook</span>
                            <div className="grid grid-cols-2 gap-2 text-center">
                              <div className="bg-slate-50 p-1.5 rounded border border-slate-100 flex flex-col">
                                <span className="text-[9px] text-slate-400">Projected BTR</span>
                                <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">{projectedBtr.toLocaleString()}</span>
                                <span className="text-[8px] text-emerald-600 font-bold font-mono">+{btrGain.toLocaleString()}</span>
                              </div>
                              <div className="bg-slate-50 p-1.5 rounded border border-slate-100 flex flex-col">
                                <span className="text-[9px] text-slate-400">Projected Wage</span>
                                <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">£{projectedWage.toLocaleString()}</span>
                                <span className="text-[8px] text-rose-500 font-bold font-mono">+{Math.max(0, projectedWage - selectedPlayer.wage).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          <p className="text-[9px] text-slate-400 italic leading-snug">
                            *Pop predictions assume constant net allocation and superb coach quality. Actual results may slightly vary due to sub-level fractional states.
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                </div>
              </>
            )}

            {inspectorTab === 'history' && (
              <div className="flex flex-col gap-5 animate-fadeIn">
                
                {/* Header info */}
                <div className="bg-slate-50/70 border border-slate-200/50 p-4.5 rounded-xl text-xs flex items-start gap-3">
                  <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-700 block mb-0.5">Week-by-Week Skill pop & Rating Auditor</span>
                    <p className="text-slate-500 leading-relaxed">
                      Visualize historical training progress, log weekly pop events, and simulate skill advancements. Weekly updates are preserved in the local storage database and synced to the cloud.
                    </p>
                  </div>
                </div>

                {/* Rating timeline graph */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider font-mono">BT Rating Growth Timeline</span>
                    <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100/50">
                      Season {selectedPlayer.history?.[selectedPlayer.history.length - 1]?.season || 65} Wk {selectedPlayer.history?.[selectedPlayer.history.length - 1]?.week || 10}
                    </span>
                  </div>
                  
                  {/* Line/Area Chart */}
                  <div className="h-52 w-full mt-2">
                    {selectedPlayer.history && selectedPlayer.history.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={selectedPlayer.history.map(h => ({
                            name: `S${h.season} W${h.week}`,
                            rating: h.btRating,
                            raw: h
                          }))}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorBtr" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            stroke="#94a3b8" 
                            fontSize={9} 
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={9} 
                            tickLine={false}
                            axisLine={false}
                            domain={['auto', 'auto']}
                            tickFormatter={(v) => v.toLocaleString()}
                          />
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const entry = payload[0].payload.raw;
                                return (
                                  <div className="bg-slate-900 border border-slate-800 text-white rounded-lg p-3 shadow-md text-[10px] font-sans flex flex-col gap-1.5 z-50">
                                    <span className="font-bold border-b border-slate-800 pb-1 text-slate-300">
                                      Season {entry.season}, Week {entry.week}
                                    </span>
                                    <div className="flex gap-2">
                                      <span className="text-slate-400">BT Rating:</span>
                                      <span className="font-mono font-bold text-indigo-300">{entry.btRating.toLocaleString()}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <span className="text-slate-400">Wage:</span>
                                      <span className="font-mono text-emerald-300 font-semibold">£{entry.wage.toLocaleString()}/wk</span>
                                    </div>
                                    {entry.note && (
                                      <div className="text-[9px] bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-1.5 py-0.5 rounded mt-1 font-semibold leading-snug">
                                        {entry.note}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="rating" 
                            stroke="#4f46e5" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorBtr)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                        No progress timeline available.
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Simulation Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-indigo-50/40 border border-indigo-100/40 p-4 rounded-xl flex flex-col justify-between gap-3">
                    <div>
                      <h5 className="font-display font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        Weekly Training Pop Simulator
                      </h5>
                      <p className="text-[11px] text-indigo-900/70 mt-1 leading-relaxed">
                        Advance the training timeline. This simulates a training pop based on the player's active coaching nets.
                      </p>
                    </div>
                    <button
                      id="btn-simulate-weekly-pop"
                      onClick={() => handleSimulateWeeklyPop(selectedPlayer)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Trigger Simulated Pop
                    </button>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl flex flex-col justify-between gap-3">
                    <div>
                      <h5 className="font-display font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-slate-600" />
                        Log Weekly Snapshot
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Add a general weekly snapshot log to increment the week and record steady training rating growth.
                      </p>
                    </div>
                    <button
                      id="btn-log-weekly-snapshot"
                      onClick={() => handleLogWeeklySnapshot(selectedPlayer)}
                      className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Record Weekly Snapshot
                    </button>
                  </div>
                </div>

                {/* Week-by-Week grid / timeline table */}
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider font-mono">Week-by-Week Progress logs</span>
                  
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm border-t border-slate-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-2.5 px-4">Season/Week</th>
                            <th className="py-2.5 px-3">BTR Rating</th>
                            <th className="py-2.5 px-3">Wage</th>
                            <th className="py-2.5 px-3">Form/Fit</th>
                            <th className="py-2.5 px-4 text-right">Training Pops & Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedPlayer.history && [...selectedPlayer.history].reverse().map((entry, idx, arr) => {
                            const prevChronological = arr[idx + 1];
                            const ratingDiff = prevChronological ? entry.btRating - prevChronological.btRating : 0;
                            
                            return (
                              <tr key={`${entry.season}-${entry.week}`} className="hover:bg-slate-50/50 transition">
                                <td className="py-3 px-4 font-mono font-bold text-slate-700">
                                  S{entry.season} W{entry.week}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="font-mono font-semibold text-slate-800">
                                    {entry.btRating.toLocaleString()}
                                  </div>
                                  {ratingDiff !== 0 && (
                                    <div className={`text-[10px] font-mono font-semibold ${ratingDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {ratingDiff > 0 ? '+' : ''}{ratingDiff.toLocaleString()}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 font-mono text-slate-600">
                                  £{entry.wage.toLocaleString()}
                                </td>
                                <td className="py-3 px-3">
                                  <div className="text-[11px] text-slate-500">
                                    F: <span className="font-bold text-slate-700">{entry.form || selectedPlayer.form}/10</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Ft: <span className="font-bold text-slate-700">{entry.fitness || selectedPlayer.fitness}/10</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {entry.note ? (
                                      <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                        entry.note.includes('Pop') || entry.note.includes('popped')
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
                                      }`}>
                                        {entry.note}
                                      </span>
                                    ) : (
                                      <span className="text-slate-300 italic text-[11px]">-</span>
                                    )}
                                    
                                    {/* Hoverable details to show exact skills of that week */}
                                    <div className="group relative inline-block">
                                      <button className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold border border-slate-200 hover:border-indigo-300 px-1.5 py-0.5 rounded cursor-help">
                                        Skills
                                      </button>
                                      <div className="invisible group-hover:visible absolute right-0 bottom-6 bg-slate-900 text-white rounded-lg p-3 shadow-lg z-50 w-52 text-left text-[10px] flex flex-col gap-1 border border-slate-800">
                                        <div className="font-bold text-slate-300 border-b border-slate-800 pb-1 mb-1">
                                          Skills at S{entry.season} W{entry.week}
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-1 gap-x-3">
                                          <div>Stamina: <span className="font-bold text-slate-300 capitalize">{getSkillLabel('stamina', entry.skills.stamina)}</span></div>
                                          <div>Batting: <span className="font-bold text-slate-300 capitalize">{getSkillLabel('batting', entry.skills.batting)}</span></div>
                                          <div>Bowling: <span className="font-bold text-slate-300 capitalize">{getSkillLabel('bowling', entry.skills.bowling)}</span></div>
                                          <div>Fielding: <span className="font-bold text-slate-300 capitalize">{getSkillLabel('fielding', entry.skills.fielding)}</span></div>
                                          <div>Conc: <span className="font-bold text-slate-300 capitalize">{getSkillLabel('concentration', entry.skills.concentration)}</span></div>
                                          <div>Cons: <span className="font-bold text-slate-300 capitalize">{getSkillLabel('consistency', entry.skills.consistency)}</span></div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
