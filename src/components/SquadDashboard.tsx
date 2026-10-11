import React, { useState, useEffect, useMemo } from 'react';
import { BattrickPlayer, getSkillLabel } from '../types';
import { getPlayerWeightedScore } from '../parser';
import {
  Search, User, LayoutGrid, List, TrendingUp, Dumbbell, ArrowLeftRight, Target,
  AlertTriangle, CheckCircle2, Clock, Users, RefreshCw, ExternalLink
} from 'lucide-react';
import { generateRealisticHistory, getWeeklyChanges } from '../utils/history';
import { parseHash, navigateTo, type SquadSubTab } from '../lib/navigation';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import {
  parseTransferList,
  rankBuyRecommendations,
  deriveGapNeeds,
  type TransferListing,
  type BuyRecommendation,
} from '../utils/transferList';

interface SquadDashboardProps {
  setActiveTab?: (tab: any) => void;
  onSelectPlayer?: (playerId: string) => void;
}

type SubTab = 'roster' | 'training' | 'trading' | 'estimator';
type EffortMode = 'TIE' | 'PAN' | 'GFI';

const EFFORT_MULT: Record<EffortMode, number> = { TIE: 0.85, PAN: 1.0, GFI: 1.15 };

const NET_KEYS = [
  { key: 'batting' as const, label: 'Batting' },
  { key: 'bowling' as const, label: 'Bowling' },
  { key: 'keeping' as const, label: 'Keeping' },
  { key: 'fielding' as const, label: 'Fielding' },
  { key: 'stamina' as const, label: 'Stamina' },
];

function totalNets(p: BattrickPlayer): number {
  const n = p.nets || { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 };
  return (n.batting || 0) + (n.bowling || 0) + (n.keeping || 0) + (n.fielding || 0) + (n.stamina || 0);
}

function getTradeAction(p: BattrickPlayer): { action: 'KEEP' | 'SELL' | 'WATCH'; reason: string } {
  const age = p.age ?? 25;
  const primary = Math.max(p.skills?.batting ?? 0, p.skills?.bowling ?? 0, p.skills?.keeping ?? 0);
  const wage = p.wage ?? 0;
  const btr = p.btRating ?? 0;
  if (age >= 32 && primary <= 8) return { action: 'SELL', reason: 'Aging with limited primary skill' };
  if (age >= 30 && wage > 15000 && primary < 10) return { action: 'SELL', reason: 'High wage vs skill' };
  if (age <= 22 && primary >= 7) return { action: 'KEEP', reason: 'Young with development upside' };
  if (primary >= 11 || btr >= 12000) return { action: 'KEEP', reason: 'Core squad quality' };
  if (age >= 28 && primary <= 7) return { action: 'WATCH', reason: 'Fringe — monitor form & wage' };
  return { action: 'WATCH', reason: 'Review vs XI needs' };
}

function estimateWeeksToNextLevel(level: number, age: number, netsOnSkill: number): number {
  const base = Math.max(4, (level + 1) * 3);
  const agePenalty = age >= 30 ? 1.4 : age >= 27 ? 1.2 : age <= 21 ? 0.85 : 1.0;
  const netsBoost = Math.max(0.35, 1 - netsOnSkill * 0.04);
  return Math.max(1, Math.round(base * agePenalty * netsBoost));
}

function estimateBestXi(squad: BattrickPlayer[], effort: EffortMode) {
  if (!squad.length) return { batStats: 0, topOrder: 0, middleOrder: 0, lowerOrder: 0, xi: [] as BattrickPlayer[] };
  const multi = EFFORT_MULT[effort];
  const keepers = [...squad].sort((a, b) => b.skills.keeping - a.skills.keeping || b.skills.batting - a.skills.batting);
  const keeper = keepers[0];
  const rest = squad.filter((p) => p.id !== keeper.id);
  const batters = [...rest].sort((a, b) => b.skills.batting - a.skills.batting);
  const top5 = batters.slice(0, 5);
  const used = new Set([keeper.id, ...top5.map((p) => p.id)]);
  const bowlers = [...rest].filter((p) => !used.has(p.id)).sort((a, b) => b.skills.bowling - a.skills.bowling).slice(0, 5);
  const xi = [keeper, ...top5, ...bowlers].slice(0, 11);
  while (xi.length < 11) {
    const next = rest.find((p) => !xi.some((x) => x.id === p.id));
    if (!next) break;
    xi.push(next);
  }
  const form = (p: BattrickPlayer) => 0.8 + (Math.min(10, Math.max(0, p.form ?? 8)) / 10) * 0.2;
  const fit = (p: BattrickPlayer) => 0.45 + (Math.min(10, Math.max(0, p.fitness ?? 10)) / 10) * 0.55;
  const batScore = (p: BattrickPlayer) => (p.skills.batting + 0.25 * (p.skills.concentration ?? 8)) * multi * form(p) * fit(p);
  const ordered = [...xi].sort((a, b) => batScore(b) - batScore(a));
  const top = ordered.slice(0, 3).reduce((s, p) => s + batScore(p), 0);
  const mid = ordered.slice(3, 6).reduce((s, p) => s + batScore(p), 0);
  const low = ordered.slice(6, 9).reduce((s, p) => s + batScore(p), 0);
  return { batStats: top + mid + low, topOrder: top, middleOrder: mid, lowerOrder: low, xi };
}

export default function SquadDashboard({ setActiveTab, onSelectPlayer }: SquadDashboardProps) {
  const { requireAuth, username, password } = useBattrickAuth();
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [finances, setFinances] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'age' | 'wage' | 'btRating' | 'score'>('score');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>(() =>
    (localStorage.getItem('bt_squad_view_mode') as 'cards' | 'compact') || 'cards'
  );
  const [subTab, setSubTab] = useState<SubTab>(() => {
    const route = parseHash();
    if (route.squadSub) return route.squadSub as SubTab;
    try {
      const saved = localStorage.getItem('bt_squad_subtab');
      if (saved === 'roster' || saved === 'training' || saved === 'trading' || saved === 'estimator') return saved;
    } catch {}
    return 'roster';
  });
  const [effort, setEffort] = useState<EffortMode>('TIE');
  const [targetList, setTargetList] = useState(270);
  const [transferListings, setTransferListings] = useState<TransferListing[]>(() => {
    try {
      const raw = localStorage.getItem('bt_transfer_listings');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [buyRecs, setBuyRecs] = useState<BuyRecommendation[]>([]);
  const [factorFinance, setFactorFinance] = useState(true);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [pasteHtml, setPasteHtml] = useState('');

  const selectSubTab = (tab: SubTab) => {
    setSubTab(tab);
    try { localStorage.setItem('bt_squad_subtab', tab); } catch {}
    navigateTo({ tab: 'squad', squadSub: tab === 'roster' ? undefined : (tab as SquadSubTab) });
  };

  const load = () => {
    try {
      const s = localStorage.getItem('bt_squad');
      if (s) {
        const parsed: BattrickPlayer[] = JSON.parse(s);
        let changed = false;
        const withH = parsed.map((p) => {
          if (!p.history || p.history.length === 0) {
            changed = true;
            return { ...p, history: generateRealisticHistory(p) };
          }
          return p;
        });
        if (changed) localStorage.setItem('bt_squad', JSON.stringify(withH));
        setSquad(changed ? withH : parsed);
      } else setSquad([]);
      const f = localStorage.getItem('bt_finances');
      if (f) setFinances(JSON.parse(f));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const filtered = useMemo(() => {
    return squad
      .filter((p) => {
        const ms = p.name.toLowerCase().includes(searchQuery.toLowerCase());
        const mr = roleFilter === 'All' || p.role === roleFilter;
        return ms && mr;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'age') return a.age - b.age;
        if (sortBy === 'wage') return b.wage - a.wage;
        if (sortBy === 'btRating') return b.btRating - a.btRating;
        return getPlayerWeightedScore(b) - getPlayerWeightedScore(a);
      });
  }, [squad, searchQuery, roleFilter, sortBy]);

  const trainingPlayers = useMemo(() => {
    return [...squad]
      .map((p) => {
        const nets = p.nets || { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 };
        const total = totalNets(p);
        const focus = NET_KEYS.map((k) => ({
          ...k,
          nets: (nets as any)[k.key] || 0,
          level: (p.skills as any)[k.key] || 0,
        })).sort((a, b) => b.nets - a.nets)[0];
        const weeks = estimateWeeksToNextLevel(focus.level, p.age, focus.nets);
        return { player: p, total, focus, weeks };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total || a.weeks - b.weeks);
  }, [squad]);

  const tradeCandidates = useMemo(() => {
    return squad
      .map((p) => ({ player: p, trade: getTradeAction(p), score: getPlayerWeightedScore(p) }))
      .sort((a, b) => {
        const order = { SELL: 0, WATCH: 1, KEEP: 2 };
        return order[a.trade.action] - order[b.trade.action] || a.score - b.score;
      });
  }, [squad]);

  const xiEstimate = useMemo(() => estimateBestXi(squad, effort), [squad, effort]);

  const recomputeBuyRecs = (listings: TransferListing[]) => {
    const needs = deriveGapNeeds({
      topOrder: xiEstimate.topOrder,
      middleOrder: xiEstimate.middleOrder,
      lowerOrder: xiEstimate.lowerOrder,
      targetList,
      xiBattingSkills: xiEstimate.xi.map((p) => p.skills.batting),
      xiBowlingSkills: xiEstimate.xi.map((p) => p.skills.bowling),
      xiKeepingSkills: xiEstimate.xi.map((p) => p.skills.keeping),
    });
    const cash = finances?.cash ?? 0;
    const weekly = (finances?.playerWages || 0) + (finances?.staffWages || 0);
    const recs = rankBuyRecommendations(listings, needs, { cash, weeklyOutgoings: weekly, factorFinance });
    setBuyRecs(recs.slice(0, 20));
  };

  useEffect(() => {
    if (transferListings.length) recomputeBuyRecs(transferListings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factorFinance, targetList, effort, squad, finances]);

  const applyTransferHtml = (html: string) => {
    const listings = parseTransferList(html);
    setTransferListings(listings);
    try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}
    recomputeBuyRecs(listings);
    return listings.length;
  };

  const scanTransferList = async () => {
    setTransferError(null);
    if (!requireAuth('scan the transfer list')) return;
    setTransferBusy(true);
    try {
      const res = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'page', page: 'transferlist', username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
      const html = data.html || data.content || '';
      const n = applyTransferHtml(html);
      if (!n) setTransferError('Parsed 0 players — try paste fallback from battrick.org/nl/transferlist.asp');
    } catch (e: any) {
      setTransferError(e?.message || 'Sync failed — use paste fallback');
    } finally {
      setTransferBusy(false);
    }
  };

  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'roster', label: 'Roster', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'training', label: 'Training', icon: <Dumbbell className="w-3.5 h-3.5" /> },
    { id: 'trading', label: 'Trading', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
    { id: 'estimator', label: 'Estimator', icon: <Target className="w-3.5 h-3.5" /> },
  ];

  const gap = targetList - xiEstimate.batStats;

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${
              subTab === t.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'roster' && (
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
                <p className="text-[11px] text-slate-400">Showing {filtered.length} of {squad.length}</p>
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
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {['All', 'Batter', 'Bowler', 'Keeper', 'All-rounder'].map((r) => (
              <button key={r} type="button" onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${roleFilter === r ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {r}
              </button>
            ))}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
              className="ml-auto text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50">
              <option value="score">IQ Index</option>
              <option value="btRating">BTR</option>
              <option value="wage">Wage</option>
              <option value="age">Age</option>
              <option value="name">Name</option>
            </select>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl">
              <p className="text-xs font-semibold text-slate-700">No players found</p>
              {setActiveTab && (
                <button type="button" onClick={() => setActiveTab('sync')}
                  className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold">Go to Roster Sync</button>
              )}
            </div>
          ) : (
            <div className={viewMode === 'cards' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'divide-y border border-slate-200 rounded-xl'}>
              {filtered.map((p) => {
                const score = getPlayerWeightedScore(p);
                const changes = getWeeklyChanges(p);
                const hasPop = !!(changes?.skillPops && changes.skillPops.length > 0);
                return (
                  <button key={p.id} type="button" onClick={() => onSelectPlayer?.(p.id)}
                    className={`text-left p-3.5 transition hover:bg-slate-50 ${
                      viewMode === 'cards' ? 'border border-slate-200 rounded-xl bg-white shadow-sm' : 'w-full'
                    } ${hasPop ? 'border-l-4 border-l-emerald-500' : ''}`}>
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">
                          {p.name} <span className="text-[10px] text-slate-400 font-mono">({p.age}y)</span>
                          {hasPop && <span className="ml-1 text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded font-bold">POP</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {p.role} · BTR {p.btRating?.toLocaleString()} · £{p.wage?.toLocaleString()}/wk
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[9px] font-bold text-indigo-500 uppercase">IQ</div>
                        <div className="font-mono font-black text-indigo-700">{score}</div>
                      </div>
                    </div>
                    {viewMode === 'cards' && (
                      <div className="grid grid-cols-5 gap-1 mt-2 pt-2 border-t border-slate-100 text-center font-mono">
                        {(['batting', 'bowling', 'keeping', 'fielding', 'stamina'] as const).map((k) => (
                          <div key={k} className="bg-slate-50 border border-slate-100 p-1 rounded-lg">
                            <span className="text-[8px] text-slate-400 block font-bold">{k.slice(0, 3).toUpperCase()}</span>
                            <span className="text-[10px] font-bold text-slate-800">{getSkillLabel(k, (p.skills as any)[k] || 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'training' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-violet-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Training progression</h3>
              <p className="text-[11px] text-slate-500">Players with nets — estimated weeks to next skill level</p>
            </div>
          </div>
          {trainingPlayers.length === 0 ? (
            <div className="text-center py-10 text-slate-400 border border-dashed rounded-xl text-xs">
              No net data yet. Sync squad pages that include training nets after a training week.
            </div>
          ) : (
            <div className="space-y-2">
              {trainingPlayers.map(({ player: p, total, focus, weeks }) => (
                <button key={p.id} type="button" onClick={() => onSelectPlayer?.(p.id)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-violet-50/40 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Focus <strong>{focus.label}</strong> · {focus.nets} nets · level {focus.level} ({getSkillLabel(focus.key as any, focus.level)})
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold text-violet-600 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" /> ~{weeks}w
                    </div>
                    <div className="text-[10px] text-slate-400">{total} total nets</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'trading' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Trade recommendations</h3>
                <p className="text-[11px] text-slate-500">Who to keep, watch, or list from your squad</p>
              </div>
            </div>
            <div className="space-y-2 max-h-[40dvh] overflow-y-auto">
              {tradeCandidates.map(({ player: p, trade, score }) => (
                <button key={p.id} type="button" onClick={() => onSelectPlayer?.(p.id)}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-500">{trade.reason}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400">IQ {score}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      trade.action === 'SELL' ? 'bg-rose-100 text-rose-800' :
                      trade.action === 'KEEP' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>{trade.action}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Transfer market</h3>
                  <p className="text-[11px] text-slate-500">Scan Battrick transfer list for buys that fill your gaps</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                <input type="checkbox" checked={factorFinance} onChange={(e) => setFactorFinance(e.target.checked)} className="rounded border-slate-300" />
                Factor my cash position
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={scanTransferList} disabled={transferBusy}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${transferBusy ? 'animate-spin' : ''}`} />
                {transferBusy ? 'Scanning…' : 'Scan transfer list'}
              </button>
              <a href="https://www.battrick.org/nl/transferlist.asp" target="_blank" rel="noreferrer"
                className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1">
                Open on Battrick <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {transferError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{transferError}</p>
            )}
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-slate-600">Paste transfer list HTML (fallback)</summary>
              <textarea value={pasteHtml} onChange={(e) => setPasteHtml(e.target.value)} rows={4}
                className="mt-2 w-full border border-slate-200 rounded-lg p-2 font-mono text-[10px]"
                placeholder="Paste page source from transferlist.asp" />
              <button type="button" onClick={() => { const n = applyTransferHtml(pasteHtml); if (!n) setTransferError('No players parsed from paste'); else setTransferError(null); }}
                className="mt-2 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold">Parse paste</button>
            </details>
            {buyRecs.length === 0 ? (
              <p className="text-xs text-slate-400 border border-dashed rounded-xl py-8 text-center">
                {transferListings.length
                  ? `${transferListings.length} listings synced — none clearly beat your gap thresholds${factorFinance ? ' (with cash filter)' : ''}.`
                  : 'Scan or paste the transfer list to see buy signals.'}
              </p>
            ) : (
              <div className="space-y-2">
                {buyRecs.map((r) => (
                  <div key={r.listing.playerId} className="p-3 rounded-xl border border-slate-200 flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800">
                        {r.listing.name}
                        {r.listing.age != null && <span className="text-[10px] text-slate-400 font-mono ml-1">({r.listing.age}y)</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">{r.reasons.join(' · ')}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-[10px] font-bold ${r.affordable ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {r.cost ? `£${r.cost.toLocaleString()}` : 'Price?'}
                      </div>
                      <div className="text-[10px] text-slate-400">score {r.score}</div>
                      {r.listing.playerUrl && (
                        <a href={r.listing.playerUrl} target="_blank" rel="noreferrer" className="text-[10px] text-indigo-600 underline">View</a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'estimator' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-teal-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Squad estimator</h3>
              <p className="text-[11px] text-slate-500">Target team list under effort mode — gaps & who to grow or trade</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs font-semibold text-slate-600">
              Effort mode
              <select value={effort} onChange={(e) => setEffort(e.target.value as EffortMode)}
                className="block mt-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50">
                <option value="TIE">TIE</option>
                <option value="PAN">PAN</option>
                <option value="GFI">GFI</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Target list
              <input type="number" value={targetList} onChange={(e) => setTargetList(Number(e.target.value) || 0)}
                className="block mt-1 w-28 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-slate-50" />
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Est. list', val: xiEstimate.batStats.toFixed(1) },
              { label: 'Target', val: String(targetList) },
              { label: 'Gap', val: gap.toFixed(1) },
              { label: 'XI size', val: String(xiEstimate.xi.length) },
            ].map((c) => (
              <div key={c.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">{c.label}</div>
                <div className={`text-lg font-black font-mono ${c.label === 'Gap' ? (gap > 0 ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-800'}`}>
                  {c.val}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
              <div className="text-[10px] text-blue-500 font-bold">TOP</div>
              <div className="font-mono font-bold text-blue-900">{xiEstimate.topOrder.toFixed(1)}</div>
            </div>
            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
              <div className="text-[10px] text-indigo-500 font-bold">MIDDLE</div>
              <div className="font-mono font-bold text-indigo-900">{xiEstimate.middleOrder.toFixed(1)}</div>
            </div>
            <div className="p-2 rounded-lg bg-violet-50 border border-violet-100">
              <div className="text-[10px] text-violet-500 font-bold">LOWER</div>
              <div className="font-mono font-bold text-violet-900">{xiEstimate.lowerOrder.toFixed(1)}</div>
            </div>
          </div>
          {gap > 2 ? (
            <div className="flex gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>You are <strong>{gap.toFixed(1)}</strong> below target under <strong>{effort}</strong>. Grow high-net players on Training, or buy gap-fillers on Trading.</div>
            </div>
          ) : (
            <div className="flex gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              On track for target list under {effort}.
            </div>
          )}
          <div>
            <h4 className="text-xs font-bold text-slate-600 mb-2">Best XI (estimate)</h4>
            <div className="space-y-1">
              {xiEstimate.xi.map((p, i) => (
                <button key={p.id} type="button" onClick={() => onSelectPlayer?.(p.id)}
                  className="w-full flex justify-between text-left text-xs p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
                  <span><span className="font-mono text-slate-400 mr-2">{i + 1}.</span>{p.name}</span>
                  <span className="text-slate-500">BAT {p.skills.batting} · BOWL {p.skills.bowling}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
