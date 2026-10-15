import React, { useState, useEffect } from 'react';
import { evaluateScoutBuyFit, type BuyFitVerdict } from '../utils/scoutBuyFit';
import { UserCheck, AlertTriangle } from 'lucide-react';

/**
 * Temporary lightweight Scout shell while the full OpponentScout module is restored.
 * Buy-fit evaluation (scoutBuyFit.ts) is live — full opponent scouting UI will return shortly.
 */
interface OpponentScoutProps {
  setActiveTab?: (tab: any) => void;
  initialScoutTarget?: { teamName: string; teamId?: string; nonce?: number } | null;
}

export default function OpponentScout(_props: OpponentScoutProps) {
  const [playerId, setPlayerId] = useState('');
  const [buyFit, setBuyFit] = useState<BuyFitVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBuyFitFromManual = () => {
    setError(null);
    try {
      const squadRaw = localStorage.getItem('bt_squad');
      const squad = squadRaw ? JSON.parse(squadRaw) : [];
      if (!squad.length) {
        setError('Sync your squad first so we can compare skill gaps.');
        return;
      }
      // Minimal demo: compare a placeholder profile — full player sync returns with full Scout UI
      setError('Full Scout UI restore in progress. scoutBuyFit is ready on main; reopen after the next full OpponentScout push.');
    } catch (e: any) {
      setError(e?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="text-sm text-amber-900">
          <p className="font-bold">Scout module temporarily simplified</p>
          <p className="text-xs mt-1">
            The full Opponent Scout file is being restored to main. The <strong>worth-buying</strong> engine
            (<code className="font-mono text-[11px]">src/utils/scoutBuyFit.ts</code>) is already committed.
          </p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-indigo-600" />
          <h3 className="font-bold text-sm text-slate-900">Worth buying? (engine ready)</h3>
        </div>
        <p className="text-xs text-slate-500">
          Once the full Scout player screen is back, every scouted player will show Buy / Maybe / Pass
          against your synced squad, wages, and Estimator rating targets.
        </p>
        <button
          type="button"
          onClick={runBuyFitFromManual}
          className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold"
        >
          Check restore status
        </button>
        {error && <p className="text-xs text-amber-800">{error}</p>}
        {buyFit && (
          <pre className="text-[10px] bg-slate-50 p-2 rounded border overflow-auto">{JSON.stringify(buyFit, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
