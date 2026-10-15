import React, { useState, useEffect, useMemo } from 'react';
import { BattrickPlayer, getSkillLabel } from '../types';
import { getPlayerWeightedScore } from '../parser';
import { generateRealisticHistory } from '../utils/history';
import { parseHash, navigateTo, type SquadSubTab } from '../lib/navigation';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import {
  parseTransferList,
  rankBuyRecommendations,
  deriveNeedsFromRatingGaps,
  estimateTeamRatings,
  buildRatingGaps,
  levelToLabel,
  type TransferListing,
  type BuyRecommendation,
  type TeamRatingKey,
} from '../utils/transferList';
import {
  Dumbbell, ArrowLeftRight, Target, Clock, Users, RefreshCw, AlertTriangle
} from 'lucide-react';
import {
  type SubTab, type EffortMode, totalNets, getTradeAction, estimateWeeksToNextLevel,
  RATING_KEYS, defaultRatings,
} from './squad/squadHelpers';
import SquadRosterTab from './squad/SquadRosterTab';

interface SquadDashboardProps {
  setActiveTab?: (tab: any) => void;
  onSelectPlayer?: (id: string) => void;
}

export default function SquadDashboard({ setActiveTab, onSelectPlayer }: SquadDashboardProps) {
  const { requireAuth, username, password } = useBattrickAuth();
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [finances, setFinances] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'age' | 'wage' | 'btRating' | 'score'>('score');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>(() =>
    (localStorage.getItem('bt_squad_view_mode') as 'cards' | 'compact') || 'compact'
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
  const [ratingTargets, setRatingTargets] = useState<Record<TeamRatingKey, number>>(() => {
    try {
      const raw = localStorage.getItem('bt_rating_targets');
      if (raw) return { ...defaultRatings(), ...JSON.parse(raw) };
    } catch {}
    return defaultRatings();
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

  useEffect(() => {
    const syncSub = () => {
      const route = parseHash();
      if (route.tab === 'squad' && route.squadSub) {
        setSubTab(route.squadSub as SubTab);
        try { localStorage.setItem('bt_squad_subtab', route.squadSub); } catch {}
      } else {
        try {
          const saved = localStorage.getItem('bt_squad_subtab');
          if (saved === 'roster' || saved === 'training' || saved === 'trading' || saved === 'estimator') {
            setSubTab(saved);
          }
        } catch {}
      }
    };
    window.addEventListener('hashchange', syncSub);
    window.addEventListener('storage', syncSub);
    syncSub();
    return () => {
      window.removeEventListener('hashchange', syncSub);
      window.removeEventListener('storage', syncSub);
    };
  }, []);

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

  const setRatingTarget = (key: TeamRatingKey, level: number) => {
    setRatingTargets((prev) => {
      const next = { ...prev, [key]: level };
      try { localStorage.setItem('bt_rating_targets', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = [...squad];
    if (roleFilter !== 'All') list = list.filter((p) => (p.role || '').toLowerCase().includes(roleFilter.toLowerCase()));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.name?.toLowerCase().includes(q) || p.id?.includes(q));
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'age') return (a.age || 0) - (b.age || 0);
      if (sortBy === 'wage') return (b.wage || 0) - (a.wage || 0);
      if (sortBy === 'btRating') return (b.btRating || 0) - (a.btRating || 0);
      return getPlayerWeightedScore(b) - getPlayerWeightedScore(a);
    });
    return list;
  }, [squad, roleFilter, searchQuery, sortBy]);

  const trainingPlayers = useMemo(() => {
    return squad
      .map((p) => {
        const total = totalNets(p);
        if (total <= 0) return null;
        const nets = p.nets || { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 };
        const entries = [
          { key: 'batting', nets: nets.batting || 0, level: p.skills?.batting || 0 },
          { key: 'bowling', nets: nets.bowling || 0, level: p.skills?.bowling || 0 },
          { key: 'keeping', nets: nets.keeping || 0, level: p.skills?.keeping || 0 },
          { key: 'fielding', nets: nets.fielding || 0, level: p.skills?.fielding || 0 },
          { key: 'stamina', nets: nets.stamina || 0, level: p.skills?.stamina || 0 },
        ].filter((e) => e.nets > 0);
        const focus = entries.sort((a, b) => b.nets - a.nets)[0];
        if (!focus) return null;
        const weeks = estimateWeeksToNextLevel(focus.level, p.age || 25, focus.nets);
        return { player: p, total, focus: { ...focus, label: focus.key }, weeks };
      })
      .filter(Boolean) as { player: BattrickPlayer; total: number; focus: any; weeks: number }[];
  }, [squad]);

  const tradeCandidates = useMemo(() => {
    return squad
      .map((p) => ({ player: p, trade: getTradeAction(p), score: getPlayerWeightedScore(p) }))
      .sort((a, b) => {
        const order = { SELL: 0, WATCH: 1, KEEP: 2 };
        return order[a.trade.action] - order[b.trade.action] || a.score - b.score;
      });
  }, [squad]);

  const currentRatings = useMemo(() => estimateTeamRatings(squad), [squad]);
  const ratingGaps = useMemo(() => buildRatingGaps(currentRatings, ratingTargets), [currentRatings, ratingTargets]);
  const currentLevel = (key: TeamRatingKey) => currentRatings?.[key]?.level ?? 0;

  const runTransferScan = async () => {
    setTransferBusy(true);
    setTransferError(null);
    try {
      let html = pasteHtml;
      if (!html) {
        await requireAuth();
        const res = await fetch('/api/sync-battrick-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageName: 'transferlist.asp',
            pageUrl: 'https://www.battrick.org/nl/transferlist.asp',
            username,
            password,
            sessionToken: localStorage.getItem('bt_sync_session') || '',
          }),
        });
        const data = await res.json();
        if (data.sessionToken) localStorage.setItem('bt_sync_session', data.sessionToken);
        if (!data.success || !data.html) throw new Error(data.error || 'Could not load transfer list');
        html = data.html;
      }
      const listings = parseTransferList(html);
      try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}
      const needs = deriveNeedsFromRatingGaps(ratingGaps);
      const recs = rankBuyRecommendations(listings, needs, {
        cash: finances?.cash,
        factorFinance,
      });
      setBuyRecs(recs);
    } catch (e: any) {
      setTransferError(e?.message || 'Scan failed');
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
        <SquadRosterTab
          squad={squad}
          filtered={filtered}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          sortBy={sortBy}
          setSortBy={setSortBy}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onSelectPlayer={onSelectPlayer}
          setActiveTab={setActiveTab}
        />
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
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Squad trade recommendations</h3>
              <p className="text-[11px] text-slate-500">Who to keep, watch, or list. Transfer market is under Estimator.</p>
            </div>
          </div>
          <div className="space-y-2 max-h-[60dvh] overflow-y-auto">
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
          <p className="text-[11px] text-slate-400">
            Looking to buy? Open the{' '}
            <button type="button" className="text-indigo-600 font-bold underline" onClick={() => selectSubTab('estimator')}>Estimator</button>
            {' '}tab.
          </p>
        </div>
      )}

      {subTab === 'estimator' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-teal-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Team Ratings & transfer gaps</h3>
                <p className="text-[11px] text-slate-500">Set targets like the game. Gaps drive transfer recommendations.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              <label className="text-xs font-semibold text-slate-600">
                List target
                <input type="number" value={targetList} onChange={(e) => setTargetList(Number(e.target.value) || 270)}
                  className="mt-1 block w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Effort
                <select value={effort} onChange={(e) => setEffort(e.target.value as EffortMode)}
                  className="mt-1 block border border-slate-200 rounded-lg px-2 py-1.5 text-sm">
                  <option value="TIE">TIE</option>
                  <option value="PAN">PAN</option>
                  <option value="GFI">GFI</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {RATING_KEYS.map(({ key, label }) => {
                const current = currentLevel(key);
                const target = ratingTargets[key];
                const gap = target - current;
                return (
                  <div key={key} className="flex items-center justify-between gap-2 border border-slate-100 rounded-xl px-3 py-2 bg-slate-50/50">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-700">{label}</div>
                      <div className="text-[10px] text-slate-500">
                        Now <strong>{levelToLabel(current)}</strong>
                        {gap > 0 ? <span className="text-rose-600"> · gap {gap}</span> : <span className="text-emerald-600"> · on target</span>}
                      </div>
                    </div>
                    <select
                      value={target}
                      onChange={(e) => setRatingTarget(key, Number(e.target.value))}
                      className="text-[11px] border border-slate-200 rounded-lg px-1.5 py-1 max-w-[8rem]"
                    >
                      {Array.from({ length: 21 }, (_, i) => i).map((lv) => (
                        <option key={lv} value={lv}>{levelToLabel(lv)}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" checked={factorFinance} onChange={(e) => setFactorFinance(e.target.checked)} />
                Factor cash position
              </label>
              <button type="button" disabled={transferBusy} onClick={runTransferScan}
                className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${transferBusy ? 'animate-spin' : ''}`} />
                Scan transfer list
              </button>
            </div>
            {transferError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {transferError}
              </div>
            )}
            <label className="block text-xs text-slate-500">
              Paste transfer list HTML (fallback)
              <textarea value={pasteHtml} onChange={(e) => setPasteHtml(e.target.value)}
                className="mt-1 w-full h-20 border border-slate-200 rounded-lg p-2 font-mono text-[10px]"
                placeholder="Optional if live scan fails" />
            </label>
          </div>

          {buyRecs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
              <h4 className="text-sm font-bold text-slate-900">Transfer recommendations</h4>
              <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-500">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {buyRecs.filter((r) => r.active ?? r.affordable).length} active
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {buyRecs.filter((r) => !(r.active ?? r.affordable)).length} inactive
                </span>
              </div>
              {buyRecs.slice(0, 25).map((r) => {
                const inactive = !(r.active ?? r.affordable);
                return (
                  <div key={r.listing.playerId}
                    className={`p-3 rounded-xl border flex justify-between gap-2 ${
                      inactive ? 'border-slate-200 bg-slate-50/80 opacity-70' : 'border-emerald-200 bg-emerald-50/30'
                    }`}>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{r.listing.name}</div>
                      <div className="text-[11px] text-slate-500">{(r.reasons || []).join(' · ')}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        inactive ? 'bg-slate-200 text-slate-600' : 'bg-emerald-600 text-white'
                      }`}>{inactive ? 'Inactive' : 'Active'}</span>
                      {r.cost > 0 && (
                        <div className="text-[10px] font-mono text-slate-500 mt-1">£{Number(r.cost).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
