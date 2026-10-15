import React, { useEffect, useState } from 'react';
import { Swords, X } from 'lucide-react';
import {
  loadLineupContext,
  clearLineupContext,
  type SuggestedLineup,
} from '../utils/suggestLineup';

/**
 * Banner above Lineup Optimizer when arriving from Manager desk with a next-match plan.
 */
export default function LineupMatchBanner() {
  const [ctx, setCtx] = useState<SuggestedLineup | null>(null);

  useEffect(() => {
    setCtx(loadLineupContext());
  }, []);

  if (!ctx?.match) return null;

  return (
    <div className="mb-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 flex items-start gap-2">
      <Swords className="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-orange-950">
          Preparing: vs {ctx.match.opponent} · {ctx.match.type} · {ctx.match.date}
        </p>
        <p className="text-[11px] text-orange-900/80 mt-0.5">
          Suggested <strong>{ctx.strategy}</strong> · effort <strong>{ctx.effort}</strong>
          {' '}({ctx.format}). Apply the matching strategy below to lock the XI.
        </p>
        <p className="text-[10px] text-orange-800/70 mt-1">{ctx.reason}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          clearLineupContext();
          setCtx(null);
        }}
        className="p-1 rounded-lg hover:bg-orange-100 text-orange-800"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
