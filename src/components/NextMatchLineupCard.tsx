import React, { useMemo } from 'react';
import { Swords, Sparkles } from 'lucide-react';
import type { BattrickPlayer, BattrickGame } from '../types';
import { suggestLineup } from '../utils/suggestLineup';
import { navigateTo } from '../lib/navigation';

interface Props {
  squad?: BattrickPlayer[];
  fixtures?: BattrickGame[];
}

export default function NextMatchLineupCard({ squad, fixtures }: Props) {
  const suggestion = useMemo(() => {
    const list = squad || [];
    if (!list.length) return null;
    const upcoming = (fixtures || []).filter((f) => !f.result || f.result === 'Upcoming');
    const next = upcoming[0] || null;
    return suggestLineup(list, next);
  }, [squad, fixtures]);

  if (!suggestion) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <Swords className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-bold text-slate-900">Next match XI</h3>
        </div>
        <p className="text-xs text-slate-500">Sync your squad to get a suggested batting and bowling order.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
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

      <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Bowling order (top 5)</div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-3 max-h-36 overflow-y-auto">
        {suggestion.bowlingOrder.map((s) => (
          <li
            key={`bowl-${s.order}-${s.playerId}`}
            className="text-[11px] flex items-baseline gap-1.5 px-2 py-1 rounded-lg bg-rose-50/60 border border-rose-100"
          >
            <span className="font-mono font-bold text-rose-700 w-4 shrink-0">{s.order}</span>
            <span className="font-semibold text-slate-800 truncate">{s.name}</span>
            <span className="text-rose-700/80 ml-auto shrink-0 text-[10px]">
              {s.bowlingType || 'Bowl'} {s.bowling}
            </span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={() => navigateTo('/squad/lineup')}
        className="text-[11px] font-bold text-orange-800 hover:underline"
      >
        Open full lineup →
      </button>
    </div>
  );
}
