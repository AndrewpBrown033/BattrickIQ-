import React, { useMemo, useState } from 'react';
import { BattrickPlayer, getSkillLabel } from '../types';
import { estimateWeeksToNextLevel } from '../parser';
import { weeksToSecondaryPop } from '../utils/secondarySkills';
import { getCurrentBattrickDate } from '../utils/history';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';

interface Props {
  player: BattrickPlayer;
  plannerNets: {
    batting: number;
    bowling: number;
    keeping: number;
    stamina: number;
    fielding: number;
  };
  coachLevel?: number;
  squadTrainingStamina?: boolean;
  squadTrainingFielding?: boolean;
}

type SkillKey =
  | 'batting'
  | 'bowling'
  | 'keeping'
  | 'fielding'
  | 'stamina'
  | 'concentration'
  | 'consistency';

const SKILL_META: {
  key: SkillKey;
  name: string;
  shortName: string;
  color: string;
  maxLevel: number;
}[] = [
  { key: 'batting', name: 'Batting', shortName: 'Bat', color: '#2563eb', maxLevel: 20 },
  { key: 'bowling', name: 'Bowling', shortName: 'Bowl', color: '#7c3aed', maxLevel: 20 },
  { key: 'keeping', name: 'Wicket Keeping', shortName: 'W.Keep', color: '#0284c7', maxLevel: 20 },
  { key: 'fielding', name: 'Fielding', shortName: 'Field', color: '#059669', maxLevel: 20 },
  { key: 'stamina', name: 'Stamina', shortName: 'Stam', color: '#d97706', maxLevel: 11 },
  { key: 'concentration', name: 'Concentration', shortName: 'Conc', color: '#e11d48', maxLevel: 20 },
  { key: 'consistency', name: 'Consistency', shortName: 'Cons', color: '#0d9488', maxLevel: 20 },
];

function baseLevel(player: BattrickPlayer, key: SkillKey): number {
  const s = player.skills as any;
  return Number(s?.[key] ?? 0) || 0;
}

export default function PlayerSkillProjectionChart({
  player,
  plannerNets,
  coachLevel = 9,
  squadTrainingStamina = false,
  squadTrainingFielding = false,
}: Props) {
  const [projectionWeeks, setProjectionWeeks] = useState(16);

  const skillRates = useMemo(() => {
    const rates: Record<string, number> = {};
    for (const sk of SKILL_META) {
      const level = baseLevel(player, sk.key);
      if (sk.key === 'stamina') {
        const weeks = estimateWeeksToNextLevel(
          level,
          player.age,
          plannerNets.stamina,
          coachLevel,
          'stamina',
          squadTrainingStamina
        );
        rates[sk.key] = weeks > 0 && weeks !== Infinity ? 1 / weeks : 0;
      } else if (sk.key === 'fielding') {
        const weeks = estimateWeeksToNextLevel(
          level,
          player.age,
          plannerNets.fielding,
          coachLevel,
          'fielding',
          squadTrainingFielding
        );
        rates[sk.key] = weeks > 0 && weeks !== Infinity ? 1 / weeks : 0;
      } else if (sk.key === 'concentration') {
        const weeks = weeksToSecondaryPop('concentration', level, player.age, {
          batting: plannerNets.batting,
          keeping: plannerNets.keeping,
          fielding: plannerNets.fielding,
        });
        rates[sk.key] = weeks > 0 && weeks !== Infinity ? 1 / weeks : 0;
      } else if (sk.key === 'consistency') {
        const weeks = weeksToSecondaryPop('consistency', level, player.age, {
          bowling: plannerNets.bowling,
          keeping: plannerNets.keeping,
          fielding: plannerNets.fielding,
        });
        rates[sk.key] = weeks > 0 && weeks !== Infinity ? 1 / weeks : 0;
      } else {
        const nets =
          sk.key === 'batting'
            ? plannerNets.batting
            : sk.key === 'bowling'
              ? plannerNets.bowling
              : plannerNets.keeping;
        const weeks = estimateWeeksToNextLevel(level, player.age, nets, coachLevel, sk.key as any);
        rates[sk.key] = weeks > 0 && weeks !== Infinity ? 1 / weeks : 0;
      }
    }
    return rates;
  }, [player, plannerNets, coachLevel, squadTrainingStamina, squadTrainingFielding]);

  const barData = useMemo(() => {
    return SKILL_META.map((sk) => {
      const current = baseLevel(player, sk.key);
      const rate = skillRates[sk.key] || 0;
      const projected = Math.min(sk.maxLevel, current + projectionWeeks * rate);
      const weeksToPop = rate > 0 ? parseFloat((1 / rate).toFixed(1)) : null;
      const secondaryActive =
        (sk.key === 'concentration' &&
          (plannerNets.batting > 0 || plannerNets.keeping > 0 || plannerNets.fielding > 0)) ||
        (sk.key === 'consistency' &&
          (plannerNets.bowling > 0 || plannerNets.keeping > 0 || plannerNets.fielding > 0));
      return {
        key: sk.key,
        name: sk.name,
        shortName: sk.shortName,
        color: sk.color,
        current,
        projected: parseFloat(projected.toFixed(2)),
        gain: parseFloat((projected - current).toFixed(2)),
        weeksToPop,
        currentLabel: getSkillLabel(sk.key, Math.floor(current)),
        projectedLabel: getSkillLabel(sk.key, Math.floor(projected)),
        training:
          sk.key === 'concentration' || sk.key === 'consistency'
            ? secondaryActive
              ? 'Secondary (SPs)'
              : '0 nets'
            : sk.key === 'stamina' && squadTrainingStamina
              ? 'Squad/nets'
              : sk.key === 'fielding' && squadTrainingFielding
                ? 'Squad/nets'
                : `${(plannerNets as any)[sk.key] || 0} net(s)`,
      };
    });
  }, [player, skillRates, projectionWeeks, plannerNets, squadTrainingStamina, squadTrainingFielding]);

  const today = getCurrentBattrickDate();

  return (
    <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl p-5 sm:p-7 shadow-xs flex flex-col gap-6 font-sans overflow-hidden">
      <div className="bg-gradient-to-r from-slate-950 via-[#0b192e] to-[#0f172a] text-white rounded-2xl p-5 border border-blue-900/40">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-200 bg-blue-900/80 border border-blue-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-300" />
            Skills & Market Advisor
          </span>
          <span className="text-[11px] font-mono text-emerald-200 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-400" />
            S{today.season} W{today.week}
          </span>
        </div>
        <h3 className="font-serif font-bold text-2xl text-white tracking-tight">{player.name}</h3>
        <p className="text-xs text-blue-100/80 mt-1 max-w-2xl leading-relaxed">
          Concentration / Consistency use Battrick helpfile tables (older = faster secondaries).
          Conc from batting, keeping or fielding nets; Cons from bowling, keeping or fielding nets.
          Combining different types speeds pops (e.g. bat+field ≈ half of single).
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-mono font-bold text-slate-600">Projection horizon</label>
        {[8, 12, 16].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setProjectionWeeks(w)}
            className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ${
              projectionWeeks === w
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {w} weeks
          </button>
        ))}
      </div>

      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs shadow-md">
                    <div className="font-bold text-slate-900 mb-1">{d.name}</div>
                    <div>Now: {d.current} ({d.currentLabel})</div>
                    <div>
                      +{projectionWeeks}w: {d.projected} ({d.projectedLabel})
                    </div>
                    <div className="text-slate-500 mt-1">
                      Weeks/pop: {d.weeksToPop ?? '—'} · {d.training}
                    </div>
                  </div>
                );
              }}
            />
            <Legend />
            <Bar dataKey="current" name="Current" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="projected" name={`+${projectionWeeks}w`} radius={[4, 4, 0, 0]}>
              {barData.map((d) => (
                <Cell key={d.key} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-mono">
              <th className="py-2 pr-2">Skill</th>
              <th className="py-2 pr-2">Now</th>
              <th className="py-2 pr-2">+{projectionWeeks}w</th>
              <th className="py-2 pr-2">Gain</th>
              <th className="py-2 pr-2">Wks/pop</th>
              <th className="py-2">Training</th>
            </tr>
          </thead>
          <tbody>
            {barData.map((d) => (
              <tr key={d.key} className="border-b border-slate-100">
                <td className="py-2 pr-2 font-bold" style={{ color: d.color }}>
                  {d.name}
                </td>
                <td className="py-2 pr-2">
                  {d.current} <span className="text-slate-400">({d.currentLabel})</span>
                </td>
                <td className="py-2 pr-2">
                  {d.projected} <span className="text-slate-400">({d.projectedLabel})</span>
                </td>
                <td className="py-2 pr-2 font-mono text-emerald-700">+{d.gain}</td>
                <td className="py-2 pr-2 font-mono">{d.weeksToPop ?? '—'}</td>
                <td className="py-2 text-slate-500">{d.training}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
        Secondary skill math follows the Battrick helpfile: single qualifying net type is 14.2 weeks at age 17
        down to 4.0 from age 34; two types (e.g. bat+field) ≈ half; three types (bat+WK+field) fastest.
        Same-type multi-nets do not stack for secondaries (psychologists once per type). Requires Sports Psychologists.
      </p>
    </div>
  );
}
