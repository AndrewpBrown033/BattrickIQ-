import React, { useEffect, useState } from 'react';
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

const AGE_MIN = 1;
const AGE_MAX = 50;

/**
 * Age box that keeps what you type as text while you type (so you can clear it and retype), and only
 * passes a number up when it is a valid age. Leaving the box with nothing valid restores the last good value.
 */
function AgeInput({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5">
      {label}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={draft}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
          setDraft(digits);
          const n = parseInt(digits, 10);
          if (Number.isFinite(n) && n >= AGE_MIN && n <= AGE_MAX) onCommit(n);
        }}
        onBlur={() => setDraft(String(value))}
        onFocus={(e) => e.target.select()}
        className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-20"
        placeholder={placeholder}
      />
    </label>
  );
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
        <AgeInput label="Min age" value={minAge} onCommit={onMinAge} placeholder="e.g. 17" />
        <AgeInput label="Max age" value={maxAge} onCommit={onMaxAge} placeholder="e.g. 25" />
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
      {minAge > maxAge && (
        <p className="text-[10px] font-bold text-rose-600">Min age is above max age — nobody will match.</p>
      )}
      <p className="text-[10px] text-slate-500">
        Type any age (1–50). A narrower band updates the shortlist instantly; a wider band needs a new scan. Players whose age Battrick doesn't show are kept.
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
