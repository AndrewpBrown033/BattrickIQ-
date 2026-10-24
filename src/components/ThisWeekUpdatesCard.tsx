import React, { useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  GraduationCap,
  Eye,
  Swords,
  ChevronRight,
  TrendingUp,
  Bell,
} from 'lucide-react';
import type { BattrickPlayer, BattrickGame } from '../types';
import { getWeeklyChanges, isGameInNext7Days } from '../utils/history';
import { weeksToSecondaryPop } from '../utils/secondarySkills';
import {
  getWatchlistMonitorSummary,
  loadAlerts,
  loadWatchlist,
  getDeadlineCountdown,
  type TransferAlert,
  type WatchEntry,
} from '../utils/transferWatchlist';
import { navigateTo } from '../lib/navigation';

type WeekItem = {
  id: string;
  kind: 'pop' | 'training' | 'watch' | 'game' | 'alert';
  title: string;
  detail: string;
  tone: 'good' | 'warn' | 'info' | 'critical';
  tab?: string;
  squadSub?: string;
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

function toneClass(t: WeekItem['tone']) {
  if (t === 'good') return 'border-emerald-200 bg-emerald-50/80 text-emerald-950';
  if (t === 'warn') return 'border-amber-200 bg-amber-50/80 text-amber-950';
  if (t === 'critical') return 'border-rose-200 bg-rose-50/80 text-rose-950';
  return 'border-slate-200 bg-white text-slate-800';
}

function kindIcon(kind: WeekItem['kind']) {
  if (kind === 'pop') return <TrendingUp className="w-3.5 h-3.5 shrink-0 opacity-70" />;
  if (kind === 'training') return <GraduationCap className="w-3.5 h-3.5 shrink-0 opacity-70" />;
  if (kind === 'watch' || kind === 'alert') return <Eye className="w-3.5 h-3.5 shrink-0 opacity-70" />;
  if (kind === 'game') return <Swords className="w-3.5 h-3.5 shrink-0 opacity-70" />;
  return <Bell className="w-3.5 h-3.5 shrink-0 opacity-70" />;
}

/**
 * Home / Manager desk: this week's training pops, watchlist, fixtures.
 */
export default function ThisWeekUpdatesCard({
  setActiveTab,
}: {
  setActiveTab: (tab: string) => void;
}) {
  const [squad, setSquad] = useState<BattrickPlayer[]>(() => loadJson('bt_squad', []));
  const [fixtures, setFixtures] = useState<BattrickGame[]>(() => {
    const fx = loadJson<BattrickGame[]>('bt_fixtures', []);
    return Array.isArray(fx) && fx.length
      ? fx
      : loadJson<BattrickGame[]>('bt_league_office_fixtures', []);
  });
  const [watchSummary, setWatchSummary] = useState(() => getWatchlistMonitorSummary());
  const [alerts, setAlerts] = useState<TransferAlert[]>(() => loadAlerts());
  const [watchlist, setWatchlist] = useState<WatchEntry[]>(() => loadWatchlist());
  const [nowMs, setNowMs] = useState(() => Date.now());

  const reload = () => {
    setSquad(loadJson('bt_squad', []));
    const fx = loadJson<BattrickGame[]>('bt_fixtures', []);
    setFixtures(
      Array.isArray(fx) && fx.length ? fx : loadJson<BattrickGame[]>('bt_league_office_fixtures', [])
    );
    let cash: number | undefined;
    try {
      cash = JSON.parse(localStorage.getItem('bt_finances') || 'null')?.cash;
    } catch {}
    setWatchSummary(getWatchlistMonitorSummary(cash));
    setAlerts(loadAlerts());
    setWatchlist(loadWatchlist());
  };

  useEffect(() => {
    reload();
    const on = () => reload();
    window.addEventListener('storage', on);
    window.addEventListener('bt_transfer_watchlist_changed', on);
    window.addEventListener('bt_transfer_alerts_changed', on);
    const tick = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => {
      window.removeEventListener('storage', on);
      window.removeEventListener('bt_transfer_watchlist_changed', on);
      window.removeEventListener('bt_transfer_alerts_changed', on);
      window.clearInterval(tick);
    };
  }, []);

  const items = useMemo(() => {
    const out: WeekItem[] = [];

    for (const p of squad) {
      const ch = getWeeklyChanges(p);
      if (!ch?.skillPops?.length) continue;
      for (const pop of ch.skillPops) {
        const up = pop.to > pop.from;
        out.push({
          id: `pop-${p.id || p.playerId}-${pop.skill}`,
          kind: 'pop',
          title: `${p.name}: ${pop.skill} ${up ? '↑' : '↓'} ${pop.from}→${pop.to}`,
          detail: up ? 'Training pop this week' : 'Skill dropped vs last week',
          tone: up ? 'good' : 'warn',
          tab: 'squad',
          squadSub: 'training',
        });
      }
    }

    for (const p of squad) {
      const nets = p.nets || { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 };
      for (const skill of ['concentration', 'consistency'] as const) {
        const level = p.skills?.[skill] ?? 0;
        const weeks = weeksToSecondaryPop(skill, level, p.age || 20, nets, true);
        if (!Number.isFinite(weeks) || weeks <= 0 || weeks > 1.2) continue;
        out.push({
          id: `sec-${p.id || p.playerId}-${skill}`,
          kind: 'training',
          title: `${p.name}: ${skill} due ~${weeks}w`,
          detail: 'Secondary skill close to popping — keep nets on',
          tone: weeks <= 0.5 ? 'good' : 'info',
          tab: 'squad',
          squadSub: 'training',
        });
      }
    }

    const onNets = squad.filter((p) => {
      const n = p.nets;
      if (!n) return false;
      return (n.batting || 0) + (n.bowling || 0) + (n.keeping || 0) + (n.fielding || 0) + (n.stamina || 0) > 0;
    });
    if (onNets.length > 0 && !out.some((i) => i.kind === 'training')) {
      out.push({
        id: 'nets-summary',
        kind: 'training',
        title: `${onNets.length} player${onNets.length === 1 ? '' : 's'} on nets`,
        detail: onNets.slice(0, 4).map((p) => p.name).join(', ') + (onNets.length > 4 ? '…' : ''),
        tone: 'info',
        tab: 'squad',
        squadSub: 'training',
      });
    }

    for (const w of watchlist) {
      if (w.status === 'sold') continue;
      const cd = getDeadlineCountdown(w.lastDeadline, nowMs);
      if (cd && !cd.ended && cd.msLeft <= 7 * 24 * 60 * 60 * 1000) {
        out.push({
          id: `watch-${w.playerId}`,
          kind: 'watch',
          title: `${w.name}: ${cd.label} left`,
          detail:
            w.botStatus === 'maxed'
              ? `Bot maxed · ${w.lastBotAction || 'review max bid'}`
              : w.botEnabled
                ? `Bot ${w.botStatus || 'armed'} · max £${(w.maxBid || 0).toLocaleString()}`
                : 'On Transfer Watch — auction this week',
          tone: cd.msLeft <= 10 * 60 * 1000 ? 'critical' : cd.msLeft <= 24 * 60 * 60 * 1000 ? 'warn' : 'info',
          tab: 'watch',
        });
      }
    }

    for (const a of alerts.filter((x) => !x.read).slice(0, 5)) {
      out.push({
        id: `alert-${a.id}`,
        kind: 'alert',
        title: a.name,
        detail: a.message,
        tone: a.kind === 'ending_soon' || a.kind === 'sold' ? 'warn' : 'info',
        tab: 'watch',
      });
    }

    if (watchSummary.watched > 0 && !out.some((i) => i.kind === 'watch' || i.kind === 'alert')) {
      out.push({
        id: 'watch-summary',
        kind: 'watch',
        title: `${watchSummary.watched} on Transfer Watch`,
        detail:
          watchSummary.actionable > 0
            ? `${watchSummary.actionable} need a decision`
            : `${watchSummary.listed} still listed`,
        tone: watchSummary.actionable > 0 ? 'warn' : 'info',
        tab: 'watch',
      });
    }

    const weekGames = fixtures.filter((f) => isGameInNext7Days(f.date, f.time));
    for (const g of weekGames.slice(0, 4)) {
      out.push({
        id: `game-${g.date}-${g.opponent}`,
        kind: 'game',
        title: `vs ${g.opponent || 'Opponent'}`,
        detail: `${g.type || 'Match'} · ${g.date || ''}${g.time ? ` ${g.time}` : ''}${g.homeAway ? ` · ${g.homeAway}` : ''}`,
        tone: 'info',
        tab: 'fixtures',
      });
    }

    return out.slice(0, 12);
  }, [squad, fixtures, watchlist, alerts, watchSummary, nowMs]);

  const go = (item: WeekItem) => {
    if (item.tab === 'watch') {
      setActiveTab('watch');
      return;
    }
    if (item.tab === 'squad' && item.squadSub) {
      try {
        localStorage.setItem('bt_squad_subtab', item.squadSub);
      } catch {}
      navigateTo({ tab: 'squad', squadSub: item.squadSub as any });
      setActiveTab('squad');
      return;
    }
    if (item.tab) setActiveTab(item.tab);
  };

  const counts = useMemo(() => {
    return {
      pops: items.filter((i) => i.kind === 'pop').length,
      training: items.filter((i) => i.kind === 'training').length,
      watch: items.filter((i) => i.kind === 'watch' || i.kind === 'alert').length,
      games: items.filter((i) => i.kind === 'game').length,
    };
  }, [items]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between gap-2 bg-gradient-to-r from-indigo-50/80 to-white">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900">This week's updates</h3>
            <p className="text-[11px] text-slate-500 truncate">
              Training pops · nets · Transfer Watch · fixtures
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 justify-end shrink-0">
          {counts.pops > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {counts.pops} pop{counts.pops === 1 ? '' : 's'}
            </span>
          )}
          {counts.training > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800">
              {counts.training} train
            </span>
          )}
          {counts.watch > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
              {counts.watch} watch
            </span>
          )}
          {counts.games > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {counts.games} game{counts.games === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {!items.length ? (
        <div className="px-4 py-5 text-center text-sm text-slate-500">
          No weekly updates yet. Sync squad & fixtures, put players on nets, or add Transfer Watch
          targets.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => go(item)}
                className={`w-full text-left px-4 py-2.5 flex items-start gap-2 hover:bg-slate-50/80 transition ${toneClass(item.tone)} border-0 rounded-none`}
              >
                <span className="mt-0.5">{kindIcon(item.kind)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-bold leading-snug">{item.title}</span>
                  <span className="block text-[11px] opacity-80 mt-0.5 leading-snug">{item.detail}</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 opacity-40 mt-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="px-3 py-2 border-t border-slate-100 flex flex-wrap gap-2 bg-slate-50/50">
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem('bt_squad_subtab', 'training');
            } catch {}
            setActiveTab('squad');
          }}
          className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-lg"
        >
          Training
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('watch')}
          className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg"
        >
          Transfer Watch
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fixtures')}
          className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg"
        >
          Fixtures
        </button>
      </div>
    </section>
  );
}
