import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign,
  Swords,
  Users,
  Target,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Calendar,
  GraduationCap,
} from 'lucide-react';
import type { BattrickPlayer, ClubFinances, BattrickGame } from '../types';
import { isGameInNext7Days, parseGameDateToTimestamp } from '../utils/history';

interface ManagerDeskProps {
  setActiveTab: (tab: string) => void;
}

type Priority = {
  id: string;
  title: string;
  detail: string;
  tab: string;
  tone: 'critical' | 'warn' | 'good' | 'info';
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Manager command centre: money, games, squad — and the next decisions to win.
 */
export default function ManagerDesk({ setActiveTab }: ManagerDeskProps) {
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [finances, setFinances] = useState<ClubFinances | null>(null);
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [teamName, setTeamName] = useState('Your Club');

  const reload = () => {
    setSquad(loadJson<BattrickPlayer[]>('bt_squad', []));
    setFinances(loadJson<ClubFinances | null>('bt_finances', null));
    const fx =
      loadJson<BattrickGame[]>('bt_fixtures', []) ||
      loadJson<BattrickGame[]>('bt_league_office_fixtures', []);
    setFixtures(Array.isArray(fx) ? fx : []);
    setTeamName(localStorage.getItem('bt_team_name') || 'Your Club');
  };

  useEffect(() => {
    reload();
    const onStorage = () => reload();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const money = useMemo(() => {
    if (!finances) {
      return {
        cash: 0,
        surplus: 0,
        wages: 0,
        label: 'No finance data',
        tone: 'warn' as const,
      };
    }
    const income =
      (finances.sponsorsIncome || 0) +
      (finances.gateReceipts || 0) +
      (finances.interestReceived || 0);
    const wages = (finances.playerWages || 0) + (finances.staffWages || 0);
    const surplus = income - wages;
    const cash = finances.cash || 0;
    let label = 'Stable';
    let tone: 'critical' | 'warn' | 'good' | 'info' = 'info';
    if (cash < 0) {
      label = 'In debt';
      tone = 'critical';
    } else if (surplus < -10000) {
      label = 'Weekly deficit';
      tone = 'critical';
    } else if (surplus < 0) {
      label = 'Tight';
      tone = 'warn';
    } else if (surplus >= 25000) {
      label = 'Strong surplus';
      tone = 'good';
    } else {
      label = 'Healthy';
      tone = 'good';
    }
    return { cash, surplus, wages, label, tone };
  }, [finances]);

  const games = useMemo(() => {
    const upcoming = fixtures.filter((f) => !f.result || f.result === 'Upcoming');
    const next7 = fixtures.filter((f) => isGameInNext7Days(f.date, f.time));
    const sorted = [...(next7.length ? next7 : upcoming)].sort(
      (a, b) =>
        (parseGameDateToTimestamp(a.date, a.time) || 0) -
        (parseGameDateToTimestamp(b.date, b.time) || 0)
    );
    const next = sorted[0] || null;
    return { count7: next7.length, upcoming: upcoming.length, next };
  }, [fixtures]);

  const squadStats = useMemo(() => {
    if (!squad.length) {
      return {
        count: 0,
        avgAge: 0,
        onNets: 0,
        totalWage: 0,
        health: 'Empty roster',
        tone: 'critical' as const,
      };
    }
    const avgAge =
      squad.reduce((s, p) => s + (p.age || 0), 0) / Math.max(1, squad.length);
    const onNets = squad.filter(
      (p) =>
        p.nets &&
        ((p.nets.batting || 0) +
          (p.nets.bowling || 0) +
          (p.nets.keeping || 0) +
          (p.nets.fielding || 0) +
          (p.nets.stamina || 0) >
          0)
    ).length;
    const totalWage = squad.reduce((s, p) => s + (p.wage || 0), 0);
    let health = 'Competitive';
    let tone: 'critical' | 'warn' | 'good' | 'info' = 'good';
    if (squad.length < 11) {
      health = 'Short of an XI';
      tone = 'critical';
    } else if (onNets === 0) {
      health = 'No one in training';
      tone = 'warn';
    } else if (avgAge > 28) {
      health = 'Aging squad';
      tone = 'warn';
    } else if (avgAge < 23) {
      health = 'Young squad';
      tone = 'info';
    }
    return {
      count: squad.length,
      avgAge: Number(avgAge.toFixed(1)),
      onNets,
      totalWage,
      health,
      tone,
    };
  }, [squad]);

  const priorities = useMemo((): Priority[] => {
    const list: Priority[] = [];
    if (!finances) {
      list.push({
        id: 'sync-fin',
        title: 'Sync club finances',
        detail: 'Cash and wages drive every buy and training decision.',
        tab: 'sync',
        tone: 'warn',
      });
    } else if (money.tone === 'critical') {
      list.push({
        id: 'money',
        title: 'Stabilise the books',
        detail: money.label + ' — review wages, sell high-cost fringe players, or raise gate income.',
        tab: 'wage',
        tone: 'critical',
      });
    }
    if (squad.length === 0) {
      list.push({
        id: 'sync-squad',
        title: 'Sync your squad',
        detail: 'Without a roster you cannot plan XI, training, or transfers.',
        tab: 'sync',
        tone: 'critical',
      });
    } else if (squad.length < 11) {
      list.push({
        id: 'short',
        title: 'Fill the XI',
        detail: `Only ${squad.length} players — buy or promote so you can field a side.`,
        tab: 'squad',
        tone: 'critical',
      });
    } else if (squadStats.onNets === 0) {
      list.push({
        id: 'train',
        title: 'Put players on nets',
        detail: 'Skills only rise with training — open Training and allocate nets.',
        tab: 'squad',
        tone: 'warn',
      });
    }
    if (games.count7 === 0 && games.upcoming === 0) {
      list.push({
        id: 'fx',
        title: 'Sync fixtures',
        detail: 'Know the next games so you pick XI and skills for the right format.',
        tab: 'fixtures',
        tone: 'info',
      });
    } else if (games.next) {
      list.push({
        id: 'next-game',
        title: `Prepare: vs ${games.next.opponent || 'opponent'}`,
        detail: `${games.next.type || 'Match'} · ${games.next.date || ''} — set lineup and effort for the format.`,
        tab: 'lineup',
        tone: 'info',
      });
    }
    if (list.length === 0) {
      list.push({
        id: 'gaps',
        title: 'Check skill gaps',
        detail: 'Use Estimator Team Ratings to see what still blocks winning more games.',
        tab: 'squad',
        tone: 'good',
      });
    }
    return list.slice(0, 4);
  }, [finances, money, squad.length, squadStats.onNets, games]);

  const toneClass = (t: string) => {
    if (t === 'critical') return 'border-rose-200 bg-rose-50 text-rose-900';
    if (t === 'warn') return 'border-amber-200 bg-amber-50 text-amber-900';
    if (t === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    return 'border-slate-200 bg-slate-50 text-slate-800';
  };

  return (
    <div className="flex flex-col gap-4" id="manager-desk">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600">
            Manager desk
          </p>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-slate-900 tracking-tight">
            {teamName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Money, games, and winning — driven by squad and skill decisions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('wage')}
          className={`text-left rounded-2xl border p-4 transition hover:shadow-md ${toneClass(money.tone)}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wide opacity-70">
              Money
            </span>
            <DollarSign className="w-4 h-4 opacity-60" />
          </div>
          <div className="text-2xl font-serif font-bold tracking-tight">
            £{money.cash.toLocaleString()}
          </div>
          <div className="text-[11px] mt-1 font-medium">
            {money.label}
            {finances && (
              <span className="opacity-80">
                {' '}
                · £{money.surplus.toLocaleString()}/wk · wages £
                {money.wages.toLocaleString()}
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('fixtures')}
          className="text-left rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md hover:border-indigo-300"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wide text-slate-500">
              Games
            </span>
            <Swords className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
            {games.count7 > 0 ? games.count7 : games.upcoming}
            <span className="text-sm font-sans font-semibold text-slate-500 ml-1">
              {games.count7 > 0 ? 'next 7 days' : 'upcoming'}
            </span>
          </div>
          <div className="text-[11px] mt-1 text-slate-600 font-medium truncate">
            {games.next
              ? `Next: ${games.next.opponent || 'TBD'} · ${games.next.type || 'Match'} · ${games.next.date || ''}`
              : 'Sync fixtures to plan the week'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('squad')}
          className={`text-left rounded-2xl border p-4 transition hover:shadow-md ${toneClass(squadStats.tone)}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wide opacity-70">
              Squad
            </span>
            <Users className="w-4 h-4 opacity-60" />
          </div>
          <div className="text-2xl font-serif font-bold tracking-tight">
            {squadStats.count}
            <span className="text-sm font-sans font-semibold opacity-70 ml-1">players</span>
          </div>
          <div className="text-[11px] mt-1 font-medium">
            {squadStats.health}
            {squadStats.count > 0 && (
              <span className="opacity-80">
                {' '}
                · avg {squadStats.avgAge}y · {squadStats.onNets} on nets
              </span>
            )}
          </div>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">This week's decisions</h3>
        </div>
        <div className="space-y-2">
          {priorities.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveTab(p.tab)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 flex items-center justify-between gap-2 transition hover:shadow-sm ${toneClass(p.tone)}`}
            >
              <div className="min-w-0">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  {p.tone === 'critical' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                  {p.title}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">{p.detail}</div>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('squad')}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 rounded-lg hover:bg-indigo-100"
          >
            <Users className="w-3.5 h-3.5" /> Player list
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lineup')}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <Calendar className="w-3.5 h-3.5" /> Lineup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('squad')}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1.5 rounded-lg hover:bg-violet-100"
          >
            <GraduationCap className="w-3.5 h-3.5" /> Training
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wage')}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100"
          >
            <TrendingUp className="w-3.5 h-3.5" /> Finances
          </button>
        </div>
      </div>
    </div>
  );
}
