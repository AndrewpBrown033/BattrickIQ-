import React, { useState, useEffect } from 'react';
import { BattrickPlayer, ClubFinances, getSkillLabel } from '../types';
import { getPlayerWeightedScore } from '../parser';
import { 
  Search, User, 
  LayoutGrid, List, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, Sparkles, TrendingUp
} from 'lucide-react';
import { generateRealisticHistory, getWeeklyChanges } from '../utils/history';

interface SquadDashboardProps {
  setActiveTab?: (tab: any) => void;
  onSelectPlayer?: (playerId: string) => void;
}

export default function SquadDashboard({ setActiveTab, onSelectPlayer }: SquadDashboardProps) {
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name' | 'age' | 'wage' | 'btRating' | 'score'>('score');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>(() => {
    return (localStorage.getItem('bt_squad_view_mode') as 'cards' | 'compact') || 'cards';
  });

  const handleSetViewMode = (mode: 'cards' | 'compact') => {
    setViewMode(mode);
    localStorage.setItem('bt_squad_view_mode', mode);
  };

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

  const loadFromLocalStorage = () => {
    const savedSquad = localStorage.getItem('bt_squad');
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
          localStorage.setItem('bt_squad', JSON.stringify(withHistory));
          setSquad(withHistory);
        } else {
          setSquad(parsed);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      setSquad([]);
    }
  };

  useEffect(() => {
    loadFromLocalStorage();
    window.addEventListener('storage', loadFromLocalStorage);
    return () => {
      window.removeEventListener('storage', loadFromLocalStorage);
    };
  }, []);

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
      <div className="w-full flex flex-col gap-5">
        <div className="bg-white border border-slate-300 rounded-xl p-3.5 sm:p-5 shadow-lg shadow-slate-400/50">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
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
            <div className="divide-y divide-slate-150 rounded-xl border border-slate-200 bg-white shadow-sm">
              {filteredSquad.map((player) => {
                const pScore = getPlayerWeightedScore(player);
                const changes = getWeeklyChanges(player);
                const hasPop = changes && changes.skillPops && changes.skillPops.length > 0;
                const topSkill = getTopSkillInfo(player);

                return (
                  <div
                    key={player.id}
                    onClick={() => {
                      if (onSelectPlayer) {
                        onSelectPlayer(player.id);
                      }
                    }}
                    className={`p-3 transition duration-150 cursor-pointer flex items-center justify-between gap-3 hover:bg-slate-50 ${
                      hasPop ? 'bg-emerald-50/30' : ''
                    }`}
                  >
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-1">
              {filteredSquad.map((player) => {
                const pScore = getPlayerWeightedScore(player);
                const changes = getWeeklyChanges(player);
                const hasPop = changes && changes.skillPops && changes.skillPops.length > 0;
                
                return (
                  <div
                    key={player.id}
                    onClick={() => {
                      if (onSelectPlayer) {
                        onSelectPlayer(player.id);
                      }
                    }}
                    className={`p-3.5 sm:p-4 rounded-xl border text-left transition duration-150 cursor-pointer active:scale-[0.99] flex flex-col justify-between gap-2.5 bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50 shadow-sm ${
                      hasPop ? 'border-l-4 border-l-emerald-500 bg-emerald-50/20' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className="min-w-0 pr-2">
                        <div className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{player.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({player.age}y)</span>
                          {primaryKeeper && primaryKeeper.id === player.id && (
                            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                              WK
                            </span>
                          )}
                          {hasPop && (
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> POP
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <span className="font-semibold text-slate-700">{player.role}</span>
                          <span>•</span>
                          <span className="font-mono">BTR: <strong className="text-slate-800">{player.btRating.toLocaleString()}</strong></span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 bg-indigo-50/80 border border-indigo-100/80 px-2.5 py-1 rounded-lg">
                        <span className="text-[9px] uppercase font-bold text-indigo-500 block font-mono">IQ Index</span>
                        <strong className="text-sm font-black font-mono text-indigo-700">{pScore}</strong>
                      </div>
                    </div>

                    {/* Skill Breakdown */}
                    <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-slate-100 text-center font-mono">
                      <div className="bg-slate-50 border border-slate-150 p-1.5 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-bold">BAT</span>
                        <span className="text-xs font-bold text-slate-800">{getSkillLabel('batting', player.skills.batting)}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-150 p-1.5 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-bold">BOWL</span>
                        <span className="text-xs font-bold text-slate-800">{getSkillLabel('bowling', player.skills.bowling)}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-150 p-1.5 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-bold">KEEP</span>
                        <span className="text-xs font-bold text-slate-800">{getSkillLabel('keeping', player.skills.keeping)}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-150 p-1.5 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-bold">STAM</span>
                        <span className="text-xs font-bold text-slate-800">{getSkillLabel('stamina', player.skills.stamina)}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-150 p-1.5 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-bold">CONC</span>
                        <span className="text-xs font-bold text-slate-800">{player.skills.concentration || '-'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 font-medium">
                      <span>Wage: <strong className="text-slate-700 font-mono">£{player.wage.toLocaleString()}/wk</strong></span>
                      <span className="text-indigo-600 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Inspect Dossier <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
