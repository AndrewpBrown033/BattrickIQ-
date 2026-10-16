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
  isTransferSearchFormOnly,
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
} from '../utils/transferWatchlist';
import {
  Dumbbell, ArrowLeftRight, Target, Clock, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  type SubTab, type EffortMode, totalNets, getTradeAction, estimateWeeksToNextLevel,
  RATING_KEYS, defaultRatings,
  SEARCH_SKILLS, recommendSkillsFromGaps, type SearchSkill,
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
  const [selectedSkills, setSelectedSkills] = useState<SearchSkill[]>([]);
  const [skillMins, setSkillMins] = useState<Partial<Record<SearchSkill, number>>>({});

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

  const skillRecs = useMemo(() => recommendSkillsFromGaps(ratingGaps), [ratingGaps]);

  useEffect(() => {
    const recommended = skillRecs.filter((r) => r.recommended).map((r) => r.skill);
    setSelectedSkills((prev) => {
      if (prev.length === 0 && recommended.length) return recommended;
      return prev.filter((s) => SEARCH_SKILLS.some((x) => x.id === s));
    });
    setSkillMins((prev) => {
      const next = { ...prev };
      for (const r of skillRecs) {
        if (r.recommended && (next[r.skill] == null || next[r.skill]! < r.minSkill)) {
          next[r.skill] = r.minSkill;
        }
      }
      return next;
    });
  }, [skillRecs]);

  const toggleSkill = (skill: SearchSkill) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const transferScanBody = () => ({
    pageName: 'transferlist.asp',
    pageUrl: 'https://www.battrick.org/nl/transferlist.asp',
    username,
    password,
    sessionToken: localStorage.getItem('bt_sync_session') || '',
    skillMins: selectedSkills.reduce((acc, sk) => {
      const m = skillMins[sk];
      if (m != null && m > 0) acc[sk] = m;
      return acc;
    }, {} as Record<string, number>),
  });

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
          body: JSON.stringify(transferScanBody()),
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
        throw new Error(
          'HTML does not look like the transfer market. Paste view-source of transferlist results after a skill search, or re-sync auth.'
        );
      }
      const listings = parseTransferList(html, { excludePlayerIds: ownIds });
      try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}
      try {
        const { watchlist: wl } = refreshWatchlistFromListings(listings, { cash: finances?.cash });
        setWatchlist(wl);
      } catch {}
      if (!listings.length) {
        if (isTransferSearchFormOnly(html)) {
          throw new Error(
            'Transfer page is only the search form — no auction rows yet. On Battrick run a skill search (use recommended skills below), then Scan again or paste results HTML.'
          );
        }
        throw new Error(
          'No transfer-market players parsed (' + html.length + ' chars). Run a skill search on Battrick, paste results HTML, or re-auth and Scan again.'
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
      if (selectedSkills.length) {
        const skillSet = new Set(selectedSkills);
        const mapped = needs.filter((n) => {
          if (n.need === 'batting') return skillSet.has('batting');
          if (n.need === 'seam') return skillSet.has('seam');
          if (n.need === 'spin') return skillSet.has('spin');
          if (n.need === 'fielding') return skillSet.has('fielding');
          if (n.need === 'keeping') return skillSet.has('keeping');
          return true;
        });
        for (const sk of selectedSkills) {
          const min = skillMins[sk] ?? 0;
          if (min <= 0) continue;
          const already = mapped.some(
            (n) =>
              (sk === 'batting' && n.need === 'batting') ||
              (sk === 'seam' && n.need === 'seam') ||
              (sk === 'spin' && n.need === 'spin') ||
              (sk === 'fielding' && n.need === 'fielding') ||
              (sk === 'keeping' && n.need === 'keeping')
          );
          if (!already) {
            mapped.push({ need: sk, minSkill: min, reason: `Selected skill: ${sk} ≥ ${min}` });
          } else {
            for (const n of mapped) {
              if (
                (sk === 'batting' && n.need === 'batting') ||
                (sk === 'seam' && n.need === 'seam') ||
                (sk === 'spin' && n.need === 'spin') ||
                (sk === 'fielding' && n.need === 'fielding') ||
                (sk === 'keeping' && n.need === 'keeping')
              ) {
                n.minSkill = Math.max(n.minSkill, min);
              }
            }
          }
        }
        if (mapped.length) needs = mapped;
      }
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
          body: JSON.stringify(transferScanBody()),
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
              <p className="text-[11px] text-slate-500">KEEP / SELL / WATCH based on age, wage and primary skill</p>
            </div>
          </div>
          <div className="space-y-2">
            {tradeCandidates.slice(0, 30).map(({ player: p, trade }) => (
              <button key={p.id} type="button" onClick={() => onSelectPlayer?.(p.id)}
                className="w-full text-left p-3 rounded-xl border border-slate-200 hover:bg-amber-50/40 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500">{trade.reason}</div>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  trade.action === 'SELL' ? 'bg-rose-100 text-rose-800' :
                  trade.action === 'KEEP' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>{trade.action}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {subTab === 'estimator' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-teal-600" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">Team Ratings & transfer gaps</h3>
                <p className="text-[11px] text-slate-500">Set targets like the game. Gaps drive skill recommendations and transfer ranking.</p>
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
                  <div key={key} className={`flex items-center justify-between gap-2 border rounded-xl px-3 py-2 ${
                    focusGap===key?'border-teal-400 bg-teal-50':gap>0?'border-rose-100 bg-rose-50/40':'border-slate-100 bg-slate-50/50'
                  }`}>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-700">{label}</div>
                      <div className="text-[10px] text-slate-500">
                        Now {levelToLabel(current)} → target{' '}
                        <select value={target} onChange={(e) => setRatingTarget(key, Number(e.target.value))}
                          className="border border-slate-200 rounded px-1 py-0.5 text-[10px]">
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
                        Find transfers →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] font-bold text-slate-800">Skills to look for</div>
                  <p className="text-[10px] text-slate-500">Recommended from your rating gaps. Toggle skills and set minimum levels for the transfer scan.</p>
                </div>
                <button type="button" className="text-[10px] font-bold text-teal-700 underline shrink-0"
                  onClick={() => {
                    const rec = skillRecs.filter((r) => r.recommended).map((r) => r.skill);
                    setSelectedSkills(rec.length ? rec : SEARCH_SKILLS.map((s) => s.id));
                    setSkillMins((prev) => {
                      const next = { ...prev };
                      for (const r of skillRecs) { if (r.recommended) next[r.skill] = r.minSkill; }
                      return next;
                    });
                  }}>
                  Reset to recommended
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {skillRecs.map((r) => {
                  const on = selectedSkills.includes(r.skill);
                  return (
                    <button key={r.skill} type="button" onClick={() => toggleSkill(r.skill)} title={r.reason}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition ${
                        on ? (r.recommended ? 'border-teal-400 bg-teal-50 text-teal-900' : 'border-indigo-300 bg-indigo-50 text-indigo-900') : 'border-slate-200 bg-white text-slate-500'
                      }`}>
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] ${on ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300'}`}>{on ? '✓' : ''}</span>
                      {r.label}
                      {r.recommended && <span className="text-[9px] font-bold uppercase tracking-wide text-rose-600">gap</span>}
                    </button>
                  );
                })}
              </div>
              {selectedSkills.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {selectedSkills.map((sk) => {
                    const rec = skillRecs.find((r) => r.skill === sk);
                    return (
                      <label key={sk} className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5">
                        Min {rec?.label || sk}
                        <input type="number" min={0} max={20} value={skillMins[sk] ?? rec?.minSkill ?? 0}
                          onChange={(e) => setSkillMins((prev) => ({ ...prev, [sk]: Math.max(0, Math.min(20, Number(e.target.value) || 0)) }))}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-xs w-full" />
                      </label>
                    );
                  })}
                </div>
              )}
              {skillRecs.some((r) => r.recommended) && (
                <p className="text-[10px] text-slate-600 bg-white border border-slate-100 rounded-lg px-2 py-1.5">
                  <span className="font-bold text-slate-800">Suggested Battrick search: </span>
                  {skillRecs.filter((r) => r.recommended && selectedSkills.includes(r.skill))
                    .map((r) => `${r.label} ≥ ${levelToLabel(skillMins[r.skill] ?? r.minSkill)} (${skillMins[r.skill] ?? r.minSkill})`)
                    .join(' · ') || 'Select a recommended skill above'}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <input type="checkbox" checked={factorFinance} onChange={(e) => setFactorFinance(e.target.checked)} />
                Factor cash / wages
              </label>
              {shouldAutoScanTransfers(6) && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-1.5 w-full">
                  Market data is stale — run <span className="font-bold">Scan transfer list</span> to refresh.
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
                placeholder="After a skill search on Battrick, paste view-source of the results page here" />
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
                      {r.listing.playerUrl && (
                        <a href={r.listing.playerUrl} target="_blank" rel="noreferrer" className="text-[10px] text-teal-700 underline">Open on Battrick</a>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        inactive ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                      }`}>{inactive ? 'Inactive' : 'Active'}</span>
                      <div className="text-[11px] font-bold text-slate-700">£{(r.cost || 0).toLocaleString()}</div>
                      <button type="button" className="text-[10px] font-bold text-indigo-700 underline"
                        onClick={() => { try { addRecommendationToWatchlist(r); setWatchlist(loadWatchlist()); } catch {} }}>
                        Watch
                      </button>
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
