import React, { useState, useEffect, useMemo } from 'react';
import { BattrickPlayer, getSkillLabel } from '../types';
import { getPlayerWeightedScore } from '../parser';
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
  type SquadGapNeed,
} from '../utils/transferList';
import { annotateInvestments, type InvestFlag } from '../utils/transferInvestment';
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
import EstimatorAgeWageBar from './squad/EstimatorAgeWageBar';
import { filterListingsByAge, type WageHorizon } from '../utils/transferCosting';
import {
  type SubTab, type EffortMode, totalNets, getTradeAction, estimateWeeksToNextLevel,
  RATING_KEYS, defaultRatings,
  SEARCH_SKILLS, recommendSkillsFromGaps, type SearchSkill,
} from './squad/squadHelpers';
import SquadRosterTab from './squad/SquadRosterTab';
import PlayerStatsDownloadButton from './PlayerStatsDownloadButton';

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
  const [lastNeeds, setLastNeeds] = useState<SquadGapNeed[]>([]);
  const [shortlistSort, setShortlistSort] = useState<'fit' | 'invest'>('invest');
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
  const [minAge, setMinAge] = useState(17);
  const [maxAge, setMaxAge] = useState(32);
  const [wageWeeks, setWageWeeks] = useState<WageHorizon>(6);

  const investments = useMemo(() => {
    try {
      return annotateInvestments(buyRecs, lastNeeds, { wageWeeks, cash: finances?.cash });
    } catch (e) {
      console.warn('[estimator] annotateInvestments failed', e);
      return new Map();
    }
  }, [buyRecs, lastNeeds, wageWeeks, finances?.cash]);

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
      }
    };
    window.addEventListener('hashchange', syncSub);
    syncSub();
    return () => window.removeEventListener('hashchange', syncSub);
  }, []);

  const load = () => {
    try {
      const s = localStorage.getItem('bt_squad');
      if (s) setSquad(JSON.parse(s));
      else setSquad([]);
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

  const currentRatings = useMemo(() => estimateTeamRatings(squad), [squad]);
  const ratingGaps = useMemo(() => buildRatingGaps(currentRatings, ratingTargets), [currentRatings, ratingTargets]);
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
        if (r.recommended && (next[r.skill] == null || next[r.skill]! < r.minSkill)) next[r.skill] = r.minSkill;
      }
      return next;
    });
  }, [skillRecs]);

  const toggleSkill = (skill: SearchSkill) => {
    setSelectedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const transferScanBody = () => ({
    pageName: 'transfers.asp',
    pageUrl: 'https://www.battrick.org/nl/transfers.asp',
    username,
    password,
    sessionToken: localStorage.getItem('bt_sync_session') || '',
    minAge,
    maxAge,
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
      if (lower.includes('id="login"') || lower.includes('log in to battrick')) {
        throw new Error('Battrick returned the login page. Re-authenticate, then scan again.');
      }
      const ownIds = new Set(squad.map((p) => String(p.id)).filter(Boolean));
      if (!isTransferMarketHtml(html) && !pasteHtml) {
        throw new Error('HTML does not look like the transfer market.');
      }
      let listings = parseTransferList(html, { excludePlayerIds: ownIds });
      listings = filterListingsByAge(listings, { minAge, maxAge });
      try { localStorage.setItem('bt_transfer_listings', JSON.stringify(listings)); } catch {}
      try {
        const wl = refreshWatchlistFromListings(listings as any);
        setWatchlist(Array.isArray(wl) ? wl : loadWatchlist());
      } catch {}
      if (!listings.length) {
        throw new Error(
          isTransferSearchFormOnly(html)
            ? 'Transfer page is only the search form — run a skill search on Battrick first.'
            : 'No transfer players parsed.'
        );
      }
      let needs = deriveNeedsFromRatingGaps(ratingGaps);
      if (selectedSkills.length) {
        const skillSet = new Set(selectedSkills);
        needs = needs.filter((n) => {
          if (n.need === 'batting') return skillSet.has('batting');
          if (n.need === 'seam') return skillSet.has('seam');
          if (n.need === 'spin') return skillSet.has('spin');
          if (n.need === 'fielding') return skillSet.has('fielding');
          if (n.need === 'keeping') return skillSet.has('keeping');
          return true;
        });
      }
      setLastNeeds(needs);
      let recs = rankBuyRecommendations(listings, needs, { cash: finances?.cash, factorFinance });
      if (recs.length < listings.length) {
        const have = new Set(recs.map((r) => r.listing.playerId));
        for (const listing of listings) {
          if (have.has(listing.playerId)) continue;
          const cost = listing.currentBid || listing.askingPrice || 0;
          const affordable = !factorFinance || cost <= 0 || (finances?.cash || 0) - cost >= 25000;
          recs.push({ listing, score: 0, reasons: ['On transfer list'], affordable, cost, active: affordable });
        }
      }
      recs = recs.sort((a, b) => b.score - a.score);
      setBuyRecs(recs);
      try {
        recordTransferScan({ at: new Date().toISOString(), listingCount: listings.length, shortlistCount: recs.length });
      } catch {}
    } catch (e: any) {
      setTransferError(e?.message || 'Scan failed');
    } finally {
      setTransferBusy(false);
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

      {subTab === 'estimator' && (
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900">Transfer scan</h3>
              <button
                type="button"
                disabled={transferBusy}
                onClick={() => void runTransferScan()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${transferBusy ? 'animate-spin' : ''}`} />
                {transferBusy ? 'Scanning…' : 'Scan transfer list'}
              </button>
            </div>
            {transferError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}
            <EstimatorAgeWageBar
              minAge={minAge}
              maxAge={maxAge}
              onMinAge={setMinAge}
              onMaxAge={setMaxAge}
              wageWeeks={wageWeeks}
              onWageWeeks={setWageWeeks}
              factorFinance={factorFinance}
            />
            <div className="flex flex-wrap gap-2">
              {skillRecs.map((r) => {
                const on = selectedSkills.includes(r.skill);
                return (
                  <button
                    key={r.skill}
                    type="button"
                    onClick={() => toggleSkill(r.skill)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${\n                      on ? 'bg-teal-50 border-teal-300 text-teal-900' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {r.skill}{r.recommended ? ' ★' : ''}
                  </button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={factorFinance} onChange={(e) => setFactorFinance(e.target.checked)} />
              Factor cash / wages
            </label>
          </div>

          {buyRecs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2">
              <h4 className="text-sm font-black text-slate-900">Shortlist ({buyRecs.length})</h4>
              {buyRecs.slice(0, 40).map((r) => {
                const l = r.listing;
                const inv = investments.get(l.playerId);
                return (
                  <div key={l.playerId} className="p-3 rounded-xl border border-slate-200 flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">{l.name}</div>
                      <div className="text-[10px] text-slate-500">
                        Age {l.age ?? '—'} · £{(l.currentBid || l.askingPrice || 0).toLocaleString()}
                        {inv?.isInvestment ? ' · investment' : ''}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{r.reasons?.[0]}</div>
                    </div>
                    <button
                      type="button"
                      className="text-[11px] font-bold text-indigo-700 shrink-0"
                      onClick={() => {
                        addRecommendationToWatchlist(r, 'From estimator');
                        setWatchlist(loadWatchlist());
                      }}
                    >
                      Watch
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'training' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
          Training view — open roster players for nets detail.
        </div>
      )}
      {subTab === 'trading' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
          Trading view — KEEP / SELL / WATCH from roster.
        </div>
      )}
    </div>
  );
}
