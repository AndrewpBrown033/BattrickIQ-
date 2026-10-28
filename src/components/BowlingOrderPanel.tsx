import React from 'react';
import type { LineupPlayer } from '../types';

/** Rank XI players who can bowl by bowling value (skill + 0.25 × consistency). */
export function rankBowlingOrder(lineup: LineupPlayer[]): LineupPlayer[] {
  const bowlingValue = (p: LineupPlayer) => p.bowling + 0.25 * (p.consistency ?? 10);
  return [...lineup]
    .filter((p) => {
      const type = (p.bowlingType || '').trim();
      return type && type.toLowerCase() !== 'none' && (p.bowling || 0) > 0;
    })
    .sort((a, b) => {
      const vb = bowlingValue(b) - bowlingValue(a);
      if (vb) return vb;
      const roleScore = (p: LineupPlayer) =>
        p.role === 'Bowler' ? 2 : p.role === 'All-rounder' ? 1 : 0;
      return roleScore(b) - roleScore(a) || a.order - b.order;
    });
}

interface Props {
  lineup: LineupPlayer[];
}

export default function BowlingOrderPanel({ lineup }: Props) {
  const bowlingOrder = rankBowlingOrder(lineup).slice(0, 5);

  return (
    <div className="mt-4 flex flex-col gap-2">
      <h4 className="font-display font-semibold text-xs text-slate-500 uppercase tracking-wider mb-0.5 flex items-center justify-between">
        <span>Bowling order</span>
        <span className="text-[10px] lowercase text-slate-400 font-normal">
          Top 5 from this XI · strongest bowling first
        </span>
      </h4>
      {bowlingOrder.length === 0 ? (
        <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          No bowlers in the XI yet — assign bowling types and skills above.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {bowlingOrder.map((player, idx) => (
            <div
              key={`bowl-${player.id}`}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-rose-100 bg-rose-50/40"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-xs font-black text-rose-700 w-5 text-right tabular-nums">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{player.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {player.bowlingType}
                    {player.role ? ` · ${player.role}` : ''}
                    {` · bats #${player.order}`}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-black text-rose-800 tabular-nums">{player.bowling}</div>
                <div className="text-[9px] text-slate-400">bowl</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
