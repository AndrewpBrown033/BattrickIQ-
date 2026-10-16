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
  isTransferMarketHtml,
  type BuyRecommendation,
  type TeamRatingKey,
} from '../utils/transferList';
import {
  addRecommendationToWatchlist,
  loadWatchlist,
  removeFromWatchlist,
  refreshWatchlistFromListings,
  hydrateWatchlistFromCloud,
  recordTransferScan,
  type WatchEntry,
  shouldAutoScanTransfers,
  getWatchlistMonitorSummary,
} from '../utils/transferWatchlist';
import {
  Dumbbell, ArrowLeftRight, Target, Clock, Users, RefreshCw, AlertTriangle, Bookmark, Bell } from 'lucide-react';
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
  const [focusGap, setFocusGap] = useState<TeamRatingKey | null>(null);
  const [autoScanOnce, setAutoScanOnce] = useState(false);
  const [pasteHtml, setPasteHtml] = useState('');
  const [watchlist, setWatchlist] = useState<WatchEntry[]>(() => loadWatchlist());
  const [watchBusy, setWatchBusy] = useState(false);

  const selectSubTab = (tab: SubTab) => {
    setSubTab(tab);
    try { localStorage.setItem('bt_squad_subtab', tab); } catch {}
    navigateTo({ tab: 'squad', squadSub: tab === 'roster' ? undefined : (tab as SquadSubTab) });
  };

  useEffect(() => {
    hydrateWatchlistFromCloud().then(setWatchlist).catch(() => setWatchlist(loadWatchlist()));
    const onWl = () => setWatchlist(loadWatchlist());
    window.addEventListener('bt_transfer_watchlist_changed', onWl);
    return () => window.removeEventListener('bt_transfer_watchlist_changed', onWl);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem('bt_estimator_autoscan') === '1') {
        setAutoScanOnce(true);
        localStorage.removeItem('bt_estimator_autoscan');
        setSubTab('estimator');
        try { localStorage.setItem('bt_squad_subtab', 'estimator'); } catch {}
      }
      const stored = localStorage.getItem('bt_focus_rating_gap');
      if (stored && RATING_KEYS.some((r) => r.key === stored)) setFocusGap(stored as TeamRatingKey);
    } catch {}
  }, []);

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
    setBuyRecs([]);
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
      const lower = html.toLowerCase();
      if (
        lower.includes('id="login"') ||
        lower.includes('log in to battrick') ||
        (lower.includes('name="password"') && lower.includes('name="username"') && !lower.includes('playerdetails'))
      ) {
        throw new Error('Battrick returned the login page. Re-authenticate in Sync / Auth bar, then scan again.');
      }
      const ownIds = new Set(squad.map((p) => String(p.id)).filter(Boolean));
      if (!isTransferMarketHtml(html) && !pasteHtml) {
        const looksSquad =
          /squad\.asp|#pagetitle|training type|\bnets\b/i.test(html) &&
          !/(asking\s*price|current\s*bid|transfer\s*list)/i.test(html);
        throw new Error(
          looksSquad
            ? 'Battrick returned your squad page instead of the transfer market. Re-auth in Sync, then Scan again. Or paste transferlist.asp source below.'
            : 'HTML does not look like the transfer market (missing Asking Price / Deadline). Paste view-source of https://www.battrick.org/nl/transferlist.asp below, or re-sync auth.'
        );
      }
      const listings = parseTransferList(html, { excludePlayerIds: ownIds });
      try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}
      try {
        const { watchlist: wl } = refreshWatchlistFromListings(listings, { cash: finances?.cash });
        setWatchlist(wl);
      } catch {}
      if (!listings.length) {
        throw new Error(
          'No transfer-market players parsed (' +
            html.length +
            ' chars). Own squad is excluded. Open transferlist.asp, run a skill search, paste results HTML below — or re-auth and Scan again.'
        );
      }
      let needs = deriveNeedsFromRatingGaps(ratingGaps);
      try {
        const fg = focusGap || (localStorage.getItem('bt_focus_rating_gap') as TeamRatingKey | null);
        if (fg) {
          const preferred = needs.filter((n) => n.ratingKey === fg);
          const rest = needs.filter((n) => n.ratingKey !== fg);
          if (preferred.length) needs = [...preferred, ...rest];
        }
      } catch {}
      let recs = rankBuyRecommendations(listings, needs, {
        cash: finances?.cash,
        factorFinance,
      });
      if (recs.length < listings.length) {
        const have = new Set(recs.map((r) => r.listing.playerId));
        for (const listing of listings) {
          if (have.has(listing.playerId)) continue;
          const cost = listing.currentBid || listing.askingPrice || 0;
          const affordable = !factorFinance || cost <= 0 || (finances?.cash || 0) - cost >= 25000;
          recs.push({
            listing,
            score: 0,
            reasons: ['On transfer list'],
            affordable,
            cost,
            active: affordable,
          });
        }
      }
      recs = recs.sort((a, b) => b.score - a.score);
      setBuyRecs(recs);
      try {
        recordTransferScan({
          at: new Date().toISOString(),
          listingCount: listings.length,
          shortlistCount: recs.length,
        });
      } catch {}
    } catch (e: any) {
      setTransferError(e?.message || 'Scan failed');
    } finally {
      setTransferBusy(false);
    }
  };

  const refreshWatchlistOnly = async () => {
    setWatchBusy(true);
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
      const ownIds = new Set(squad.map((p) => String(p.id)).filter(Boolean));
      const listings = parseTransferList(html, { excludePlayerIds: ownIds });
      try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}
      const { watchlist: wl } = refreshWatchlistFromListings(listings, { cash: finances?.cash });
      setWatchlist(wl);
      recordTransferScan({
        at: new Date().toISOString(),
        listingCount: listings.length,
        shortlistCount: buyRecs.length,
      });
    } catch (e: any) {
      setTransferError(e?.message || 'Watchlist refresh failed');
    } finally {
      setWatchBusy(false);
    }
  };

  useEffect(() => {
    if (!autoScanOnce || subTab !== 'estimator') return;
    setAutoScanOnce(false);
    const timer = window.setTimeout(() => { void runTransferScan(); }, 400);
    return () => clearTimeout(timer);
  }, [autoScanOnce, subTab]);

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
                  <div key={key} className={`flex items-center justify-between gap-2 border rounded-xl px-3 py-2 ${focusGap===key?'border-teal-400 bg-teal-50':gap>0?'border-rose-100 bg-rose-50/40':'border-slate-100 bg-slate-50/50'}`}>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-700">{label}</div>
                      <div className="text-[10px] text-slate-500">
                        Now {levelToLabel(current)} → target{' '}
                        <select
                          value={target}
                          onChange={(e) => setRatingTarget(key, Number(e.target.value))}
                          className="border border-slate-200 rounded px-1 py-0.5 text-[10px]"
                        >
                          {Array.from({ length: 21 }, (_, i) => (
                            <option key={i} value={i}>{levelToLabel(i)}</option>
                          ))}
                        </select>
                        {gap > 0 && <span className="text-rose-600 font-bold ml-1">gap {gap}</span>}
                      </div>
                    </div>
                    {gap > 0 && (
                      <button type="button" className="text-[10px] font-bold text-teal-700 underline shrink-0"
                        onClick={() => { setFocusGap(key); try { localStorage.setItem('bt_focus_rating_gap', key); } catch {} void runTransferScan(); }}>
                        Find transfers for this gap →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <input type="checkbox" checked={factorFinance} onChange={(e) => setFactorFinance(e.target.checked)} />
                Factor cash / wages
              </label>
              {shouldAutoScanTransfers(6) && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 w-full">
                  Market data is stale or missing — run <span className="font-bold">Scan transfer list</span> to refresh recommendations and your watchlist.
                </p>
              )}
              <button type="button" disabled={transferBusy} onClick={() => void runTransferScan()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-700 text-white text-xs font-bold disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${transferBusy ? 'animate-spin' : ''}`} />
                Scan transfer list
              </button>
            </div>
            {transferError && (
              <div className="text-xs text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {transferError}
              </div>
            )}
            <label className="block text-[11px] font-semibold text-slate-600">
              Paste transfer list HTML (fallback)
              <textarea value={pasteHtml} onChange={(e) => setPasteHtml(e.target.value)}
                className="mt-1 w-full h-20 border border-slate-200 rounded-lg p-2 font-mono text-[10px]"
                placeholder="Optional if live scan fails — paste view-source of transferlist.asp" />
            </label>
          </div>

          {buyRecs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
              <h4 id="transfer-shortlist" className="text-sm font-bold text-slate-900">Transfer shortlist ({buyRecs.length})</h4>
              <div className="flex flex-wrap gap-2 text-[10px] font-mono text-slate-500">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {buyRecs.filter((r) => r.active ?? r.affordable).length} active
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {buyRecs.filter((r) => !(r.active ?? r.affordable)).length} inactive
                </span>
              </div>
              {buyRecs.slice(0, 40).map((r) => {
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
                      <button
                        type="button"
                        onClick={() => {
                          const next = addRecommendationToWatchlist(r, finances?.cash);
                          setWatchlist(next);
                        }}
                        className="mt-1 text-[10px] font-bold text-indigo-700 underline"
                      >
                        {watchlist.some((w) => w.playerId === r.listing.playerId) ? 'Watching' : 'Watch'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {watchlist.length > 0 && (
            <div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-indigo-600" />
                  Watchlist ({watchlist.length})
                </h4>
                <button
                  type="button"
                  disabled={watchBusy || transferBusy}
                  onClick={() => void refreshWatchlistOnly()}
                  className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-900 disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${watchBusy ? 'animate-spin' : ''}`} />
                  Refresh prices
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Future bids: track price, deadline, and cash fit. Refresh after scanning the market.
              </p>
              {watchlist.map((w) => (
                <div
                  key={w.playerId}
                  className={`p-3 rounded-xl border flex justify-between gap-2 ${
                    w.status === 'sold'
                      ? 'border-slate-200 bg-slate-50 opacity-70'
                      : w.nowAffordable || w.bidHint === 'bid_now' || w.bidHint === 'ending_soon'
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{w.name}</div>
                    <div className="text-[11px] text-slate-500">{w.reason}</div>
                    {w.bidHintText && (
                      <div className="text-[11px] font-semibold text-indigo-800 mt-0.5">{w.bidHintText}</div>
                    )}
                    {w.lastDeadline && (
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">Deadline: {w.lastDeadline}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {w.status}
                    </div>
                    {w.lastCost > 0 && (
                      <div className="text-[10px] font-mono text-slate-500">£{Number(w.lastCost).toLocaleString()}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => setWatchlist(removeFromWatchlist(w.playerId))}
                      className="block text-[10px] text-rose-600 underline ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
