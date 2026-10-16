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
  const [focusGap, setFocusGap] = useState<TeamRatingKey | null>(null);
  const [autoScanOnce, setAutoScanOnce] = useState(false);
  const [pasteHtml, setPasteHtml] = useState('');

  const selectSubTab = (tab: SubTab) => {
    setSubTab(tab);
    try { localStorage.setItem('bt_squad_subtab', tab); } catch {}
    navigateTo({ tab: 'squad', squadSub: tab === 'roster' ? undefined : (tab as SquadSubTab) });
  };

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

  // Restored skeleton — full Estimator body will be re-applied next
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <p className="text-sm text-slate-600">Squad Dashboard restoring… refresh after next deploy.</p>
        <button type="button" onClick={() => selectSubTab('estimator')} className="mt-2 text-indigo-600 font-bold text-xs">Go Estimator</button>
      </div>
    </div>
  );
}
