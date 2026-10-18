import { getPlayerGrade } from '../../utils/playerGrade';
import React from 'react';
import type { BattrickPlayer } from '../../types';
import { getSkillLabel } from '../../types';
import { getPlayerWeightedScore } from '../../parser';
import { getWeeklyChanges } from '../../utils/history';
import { totalNets, getTradeAction } from './squadHelpers';
import { Search, User, LayoutGrid, List, Users } from 'lucide-react';

type ViewMode = 'cards' | 'compact';
type SortBy = 'name' | 'age' | 'wage' | 'btRating' | 'score';

interface Props {
  squad: BattrickPlayer[];
  filtered: BattrickPlayer[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  roleFilter: string;
  setRoleFilter: (v: string) => void;
  sortBy: SortBy;
  setSortBy: (v: SortBy) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  onSelectPlayer?: (id: string) => void;
  setActiveTab?: (tab: any) => void;
}

export default function SquadRosterTab({
  squad, filtered, searchQuery, setSearchQuery, roleFilter, setRoleFilter,
  sortBy, setSortBy, viewMode, setViewMode, onSelectPlayer, setActiveTab,
}: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-5 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              My Squad{' '}
              <span className="text-xs font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">{squad.length}</span>
            </h3>
            <p className="text-[11px] text-slate-400">Showing {filtered.length} of {squad.length} — skills, wages, keep/sell</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button type="button" onClick={() => { setViewMode('cards'); localStorage.setItem('bt_squad_view_mode', 'cards'); }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${viewMode === 'cards' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
              <LayoutGrid className="w-3.5 h-3.5 inline" /> Cards
            </button>
            <button type="button" onClick={() => { setViewMode('compact'); localStorage.setItem('bt_squad_view_mode', 'compact'); }}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${viewMode === 'compact' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
              <List className="w-3.5 h-3.5 inline" /> List
            </button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..." className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg w-32 sm:w-40" />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
            {['All', 'Batter', 'Bowler', 'All-rounder', 'Keeper'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
            <option value="score">Selection score</option>
            <option value="btRating">BTR</option>
            <option value="wage">Wage</option>
            <option value="age">Age</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400 border border-dashed rounded-xl">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs font-medium">No players yet — sync your squad from Battrick</p>
          {setActiveTab && (
            <button type="button" onClick={() => setActiveTab('sync')}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold">Go to Sync</button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'cards' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'divide-y border border-slate-200 rounded-xl'}>
          {filtered.map((p) => {
            const gradeInfo = getPlayerGrade(p);
            const score = gradeInfo.selection;
            const changes = getWeeklyChanges(p);
            const hasPop = !!(changes?.skillPops && changes.skillPops.length > 0);
            const trade = getTradeAction(p);
            const netsTotal = totalNets(p);
            return (
              <button key={p.id} type="button" onClick={() => onSelectPlayer?.(p.id)}
                className={`text-left p-3.5 transition hover:bg-slate-50 ${
                  viewMode === 'cards' ? 'border border-slate-200 rounded-xl bg-white shadow-sm' : 'w-full'
                } ${hasPop ? 'border-l-4 border-l-emerald-500' : ''} ${
                  trade.action === 'SELL' ? 'bg-rose-50/40' : ''
                }`}>
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5 flex-wrap">
                      <span>{p.name} <span className="text-[10px] text-slate-400 font-mono font-semibold">({p.age}y)</span></span>
                      {hasPop && <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded font-bold">POP</span>}
                      {netsTotal > 0 && (
                        <span className="text-[9px] bg-violet-100 text-violet-800 px-1.5 rounded font-bold">{netsTotal} nets</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {p.role} · BTR {p.btRating?.toLocaleString()} · £{p.wage?.toLocaleString()}/wk
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                      trade.action === 'SELL' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                      trade.action === 'KEEP' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                      'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>{trade.action}</span>
                    <div className="font-mono font-black text-indigo-700 text-sm" title={`Quality ${gradeInfo.quality} (skills only) · Selection ${score} (adjusted for ${gradeInfo.formUsed.kind} form ${gradeInfo.formUsed.value}/10 and fitness ${gradeInfo.fitness}/10)`}>
                      Sel {score} <span className="text-slate-400 font-semibold text-[10px]">Q {gradeInfo.quality}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1 mt-2 pt-2 border-t border-slate-100 text-center font-mono">
                  {(['batting', 'bowling', 'keeping', 'fielding', 'stamina'] as const).map((k) => (
                    <div key={k} className="bg-slate-50 border border-slate-100 p-1 rounded-lg">
                      <span className="text-[8px] text-slate-400 block font-bold">{k.slice(0, 3).toUpperCase()}</span>
                      <span className="text-[10px] font-bold text-slate-800">{getSkillLabel(k, (p.skills as any)[k] || 0)}</span>
                    </div>
                  ))}
                </div>
                {trade.action !== 'KEEP' && (
                  <p className="text-[10px] text-slate-500 mt-1.5 truncate">{trade.reason}</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
