import React from 'react';
import type { WageHorizon } from '../../utils/transferCosting';

export type EstimatorAgeWageBarProps = {
  minAge: number;
  maxAge: number;
  onMinAge: (n: number) => void;
  onMaxAge: (n: number) => void;
  wageWeeks: WageHorizon;
  onWageWeeks: (w: WageHorizon) => void;
  factorFinance: boolean;
};

function parseAge(raw: string, fallback: number): number {
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(50, n));
}

/** Age range + wage horizon controls for Estimator → Skills to look for. */
export default function EstimatorAgeWageBar({
  minAge,
  maxAge,
  onMinAge,
  onMaxAge,
  wageWeeks,
  onWageWeeks,
  factorFinance,
}: EstimatorAgeWageBarProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Age filter</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5">
          Min age
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(minAge)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, '');
              if (digits === '') return;
              onMinAge(parseAge(digits, minAge));
            }}
            onBlur={(e) => onMinAge(parseAge(e.target.value, 15))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-20"
            placeholder="e.g. 17"
          />
        </label>
        <label className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5">
          Max age
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={String(maxAge)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, '');
              if (digits === '') return;
              onMaxAge(parseAge(digits, maxAge));
            }}
            onBlur={(e) => onMaxAge(parseAge(e.target.value, 45))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-20"
            placeholder="e.g. 25"
          />
        </label>
        <button
          type="button"
          className="text-[10px] font-bold text-teal-700 underline pb-1"
          onClick={() => {
            onMinAge(17);
            onMaxAge(28);
          }}
        >
          17–28 prospect
        </button>
        <button
          type="button"
          className="text-[10px] font-bold text-slate-500 underline pb-1"
          onClick={() => {
            onMinAge(15);
            onMaxAge(45);
          }}
        >
          Any age
        </button>
      </div>
      <p className="text-[10px] text-slate-500">
        Type any age (1–50). Shortlist only keeps players in this band (unknown age is kept).
      </p>

      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 pt-1 border-t border-slate-100">
        Wage horizon (with fee)
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!factorFinance}
          onClick={() => onWageWeeks(6)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
            wageWeeks === 6
              ? 'bg-teal-50 border-teal-300 text-teal-900'
              : 'bg-white border-slate-200 text-slate-600'
          } disabled:opacity-40`}
        >
          6 weeks (min contract)
        </button>
        <button
          type="button"
          disabled={!factorFinance}
          onClick={() => onWageWeeks(16)}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
            wageWeeks === 16
              ? 'bg-teal-50 border-teal-300 text-teal-900'
              : 'bg-white border-slate-200 text-slate-600'
          } disabled:opacity-40`}
        >
          16 weeks (season)
        </button>
      </div>
      <p className="text-[10px] text-slate-500">
        When “Factor cash / wages” is on: total cost = transfer fee + weekly wage × weeks. Marks Inactive if that
        breaks your cash reserve. Wage is taken from the listing when Battrick shows it.
      </p>
    </div>
  );
}
