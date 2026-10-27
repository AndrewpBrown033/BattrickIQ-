import React, { useEffect, useMemo, useState } from 'react';
import { Swords, ChevronRight, Sparkles } from 'lucide-react';
import type { BattrickPlayer, BattrickGame } from '../types';
import {
  suggestStartingXI,
  saveLineupContext,
  type SuggestedLineup,
} from '../utils/suggestLineup';
import { isGameInNext7Days, parseGameDateToTimestamp } from '../utils/history';

interface Props {
  setActiveTab: (tab: string) => void;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function NextMatchLineupCard({ setActiveTab }: Props) {
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);

  useEffect(() => {
    const reload = () => {
      setSquad(loadJson<BattrickPlayer[]>('bt_squad', []));
      const fx =
        loadJson<BattrickGame[]>('bt_fixtures', []) ||
        loadJson<BattrickGame[]>('bt_league_office_fixtures', []);
      setFixtures(Array.isArray(fx) ? fx : []);
    };
    reload();
    window.addEventListener('storage', reload);
    return () => window.removeEventListener('storage', reload);
  }, []);

  const nextMatch = useMemo(() => {
    const upcoming = fixtures.filter((f) => !f.result || f.result === 'Upcoming');
    const next7 = fixtures.filter((f) => isGameInNext7Days(f.date, f.time));
    const sorted = [...(next7.length ? next7 : upcoming)].sort(
      (a, b) =>
        (parseGameDateToTimestamp(a.date, a.time) || 0) -
        (parseGameDateToTimestamp(b.date, b.time) || 0)
    );
    return sorted[0] || null;
  }, [fixtures]);

  const suggestion = useMemo(
    () => suggestStartingXI(squad, nextMatch),
    [squad, nextMatch]
  );

  if (!nextMatch || !suggestion) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Swords className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-bold text-slate-900">Next match XI</h3>
        </div>
        <p className="text-[11px] text-slate-500">
          {squad.length < 11
            ? 'Need at least 11 players and fixtures to suggest a lineup.'
            : 'Sync fixtures to get a format-aware Starting XI.'}
        </p>
      </div>
    );
  }

  const openLineup = () => {
    saveLineupContext(suggestion);
    setActiveTab('lineup');
  };

  return (
    <div className="bg-white border border-orange-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Swords className="w-4 h-4 text-orange-600 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 truncate">
              Next: vs {suggestion.match?.opponent}
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {suggestion.match?.type} · {suggestion.match?.date}
            {suggestion.match?.venue ? ` · ${suggestion.match.venue}` : ''} ·{' '}
            <span className="font-semibold text-orange-800">{suggestion.format}</span>
          </p>
        </div>
        <span className="text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-200 shrink-0">
          {suggestion.effort}
        </span>
      </div>

      <p className="text-[11px] text-slate-600 mb-2 flex gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-orange-500 shrink-0 mt-0.5" />
        <span>
          <strong>{suggestion.strategy}</strong> — {suggestion.reason}
        </span>
      </p>

      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Batting order</div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-3 max-h-40 overflow-y-auto">
        {suggestion.xi.map((s) => (
          <li
            key={`bat-${s.order}-${s.playerId}`}
            className="text-[11px] flex items-baseline gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100"
          >
            <span className="font-mono font-bold text-slate-400 w-4 shrink-0">{s.order}</span>
            <span className="font-semibold text-slate-800 truncate">{s.name}</span>
            <span className="text-slate-400 ml-auto shrink-0 text-[10px]">{s.role}</span>
          </li>
        ))}
      </ol>

      {(suggestion.bowlingOrder?.length ?? 0) > 0 && (
        <>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">Bowling order</div>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-3 max-h-36 overflow-y-auto">
            {suggestion.bowlingOrder.map((s) => (
              <li
                key={`bowl-${s.order}-${s.playerId}`}
                className="text-[11px] flex items-baseline gap-1.5 px-2 py-1 rounded-lg bg-rose-50/60 border border-rose-100"
              >
                <span className="font-mono font-bold text-rose-700 w-4 shrink-0">{s.order}</span>
                <span className="font-semibold text-slate-800 truncate">{s.name}</span>
                <span className="text-rose-600/80 ml-auto shrink-0 text-[10px]">
                  {s.bowlingType || 'Bowl'} · {s.bowling}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}

      <button
        type="button"
        onClick={openLineup}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 px-3 py-2.5 rounded-xl transition"
      >
        Open Lineup Optimizer
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
