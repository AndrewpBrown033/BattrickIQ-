import React, { useState, useMemo } from 'react';
import { BattrickPlayer, getSkillLabel } from '../types';
import { estimateWeeksToNextLevel } from '../parser';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
  ReferenceLine
} from 'recharts';
import { 
  Sparkles, RotateCcw, History, TrendingUp, Calendar, ChevronRight, 
  BarChart3, Table as TableIcon, Activity, Zap, CheckCircle2 
} from 'lucide-react';

interface PlayerSkillProjectionChartProps {
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

interface SkillMeta {
  key: string;
  name: string;
  shortName: string;
  color: string;
  baseLevel: number;
  nets: number;
  isSquad: boolean;
  maxLevel: number;
}

export default function PlayerSkillProjectionChart({
  player,
  plannerNets,
  coachLevel = 9,
  squadTrainingStamina = false,
  squadTrainingFielding = false,
}: PlayerSkillProjectionChartProps) {
  // Mode: 'full' (History + Projection) or 'projectionOnly'
  const [viewMode, setViewMode] = useState<'full' | 'projectionOnly'>('full');

  // Matrix section display mode: 'bar' (Bar Graph) vs 'table' (Data Matrix Table)
  const [matrixDisplayMode, setMatrixDisplayMode] = useState<'bar' | 'table'>('bar');

  // Projection target weeks for the Bar Graph (e.g. 16 weeks / full season, 8 weeks, etc.)
  const [projectionWeeks, setProjectionWeeks] = useState<number>(16);

  // Toggle visibility of individual skill lines
  const [visibleSkills, setVisibleSkills] = useState<Record<string, boolean>>({
    batting: true,
    bowling: true,
    keeping: true,
    fielding: true,
    stamina: true,
    concentration: true,
    consistency: true,
  });

  const toggleSkill = (key: string) => {
    setVisibleSkills(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const resetSkills = () => {
    setVisibleSkills({
      batting: true,
      bowling: true,
      keeping: true,
      fielding: true,
      stamina: true,
      concentration: true,
      consistency: true,
    });
  };

  // Skill metadata with distinctive, clear palette
  const skillsConfig: SkillMeta[] = useMemo(() => [
    {
      key: 'batting',
      name: 'Batting',
      shortName: 'Bat',
      color: '#2563eb', // Royal Blue
      baseLevel: player.skills.batting,
      nets: plannerNets.batting,
      isSquad: false,
      maxLevel: 20,
    },
    {
      key: 'bowling',
      name: 'Bowling',
      shortName: 'Bowl',
      color: '#7c3aed', // Purple/Violet
      baseLevel: player.skills.bowling,
      nets: plannerNets.bowling,
      isSquad: false,
      maxLevel: 20,
    },
    {
      key: 'keeping',
      name: 'Wicket Keeping',
      shortName: 'W.Keep',
      color: '#0284c7', // Sky Blue
      baseLevel: player.skills.keeping,
      nets: plannerNets.keeping,
      isSquad: false,
      maxLevel: 20,
    },
    {
      key: 'fielding',
      name: 'Fielding',
      shortName: 'Field',
      color: '#059669', // Emerald
      baseLevel: player.skills.fielding || 0,
      nets: plannerNets.fielding,
      isSquad: squadTrainingFielding,
      maxLevel: 20,
    },
    {
      key: 'stamina',
      name: 'Stamina',
      shortName: 'Stam',
      color: '#d97706', // Amber Gold
      baseLevel: player.skills.stamina,
      nets: plannerNets.stamina,
      isSquad: squadTrainingStamina,
      maxLevel: 11,
    },
    {
      key: 'concentration',
      name: 'Concentration',
      shortName: 'Conc',
      color: '#e11d48', // Rose Red
      baseLevel: player.skills.concentration,
      nets: 0,
      isSquad: false,
      maxLevel: 20,
    },
    {
      key: 'consistency',
      name: 'Consistency',
      shortName: 'Cons',
      color: '#0d9488', // Teal
      baseLevel: player.skills.consistency,
      nets: 0,
      isSquad: false,
      maxLevel: 20,
    },
  ], [player.skills, plannerNets, squadTrainingStamina, squadTrainingFielding]);

  // Compute weekly growth rates for each skill
  const skillRates = useMemo(() => {
    const rates: Record<string, number> = {};

    skillsConfig.forEach(sk => {
      if (sk.key === 'stamina') {
        if (sk.nets > 0 || sk.isSquad) {
          const weeks = estimateWeeksToNextLevel(sk.baseLevel, player.age, sk.nets, coachLevel, 'stamina', sk.isSquad);
          rates[sk.key] = weeks > 0 && weeks !== Infinity ? 1.0 / weeks : 0;
        } else {
          rates[sk.key] = 0;
        }
      } else if (sk.key === 'fielding') {
        if (sk.nets > 0 || sk.isSquad) {
          const weeks = estimateWeeksToNextLevel(sk.baseLevel, player.age, sk.nets, coachLevel, 'fielding', sk.isSquad);
          rates[sk.key] = weeks > 0 && weeks !== Infinity ? 1.0 / weeks : 0;
        } else {
          rates[sk.key] = 0;
        }
      } else if (sk.key === 'concentration') {
        // Secondary training synergy from Batting nets
        if (plannerNets.batting > 0) {
          const batWeeks = estimateWeeksToNextLevel(player.skills.batting, player.age, plannerNets.batting, coachLevel, 'batting');
          rates[sk.key] = batWeeks > 0 && batWeeks !== Infinity ? (1.0 / batWeeks) * 0.25 : 0;
        } else {
          rates[sk.key] = 0;
        }
      } else if (sk.key === 'consistency') {
        // Secondary training synergy from Bowling nets
        if (plannerNets.bowling > 0) {
          const bowlWeeks = estimateWeeksToNextLevel(player.skills.bowling, player.age, plannerNets.bowling, coachLevel, 'bowling');
          rates[sk.key] = bowlWeeks > 0 && bowlWeeks !== Infinity ? (1.0 / bowlWeeks) * 0.25 : 0;
        } else {
          rates[sk.key] = 0;
        }
      } else {
        // Primary skills: batting, bowling, keeping
        if (sk.nets > 0) {
          const weeks = estimateWeeksToNextLevel(sk.baseLevel, player.age, sk.nets, coachLevel, sk.key as any);
          rates[sk.key] = weeks > 0 && weeks !== Infinity ? 1.0 / weeks : 0;
        } else {
          rates[sk.key] = 0;
        }
      }
    });

    return rates;
  }, [skillsConfig, player.age, coachLevel, plannerNets]);

  // Extract and sort player historical data chronologically
  const chronologicalHistory = useMemo(() => {
    if (!player.history || player.history.length === 0) return [];
    return [...player.history].sort((a, b) => {
      const aVal = (a.season || 0) * 16 + (a.week || 0);
      const bVal = (b.season || 0) * 16 + (b.week || 0);
      return aVal - bVal;
    });
  }, [player.history]);

  // Determine current baseline season and week
  const currentSeasonWeek = useMemo(() => {
    if (chronologicalHistory.length > 0) {
      const last = chronologicalHistory[chronologicalHistory.length - 1];
      return { season: last.season || 65, week: last.week || 10 };
    }
    return { season: 65, week: 10 };
  }, [chronologicalHistory]);

  // Construct chart timeline merging actual historical snapshots + future projections
  const chartData = useMemo(() => {
    const points: any[] = [];

    if (viewMode === 'full' && chronologicalHistory.length > 1) {
      // 1. Plot actual historical checkpoints
      chronologicalHistory.forEach((h, idx) => {
        const isCurrent = idx === chronologicalHistory.length - 1;
        const entry: Record<string, any> = {
          timelineIndex: idx,
          weekLabel: `S${h.season} W${h.week}${isCurrent ? ' (Now)' : ''}`,
          displayWeek: h.week,
          season: h.season,
          isHistorical: true,
          isCurrent,
        };

        skillsConfig.forEach(sk => {
          const histVal = h.skills ? (h.skills as any)[sk.key] : undefined;
          entry[sk.key] = histVal !== undefined ? histVal : sk.baseLevel;
        });

        points.push(entry);
      });

      // 2. Append forward projections
      const futureIntervals = [2, 4, 6, 8, 10, 12];
      const lastHistIndex = chronologicalHistory.length - 1;
      const baseSeason = currentSeasonWeek.season;
      const baseWeek = currentSeasonWeek.week;

      futureIntervals.forEach((offsetWeeks, fIdx) => {
        const projectedWeek = baseWeek + offsetWeeks;
        const displayS = projectedWeek > 16 ? baseSeason + 1 : baseSeason;
        const displayW = projectedWeek > 16 ? projectedWeek - 16 : projectedWeek;

        const entry: Record<string, any> = {
          timelineIndex: lastHistIndex + fIdx + 1,
          weekLabel: `+${offsetWeeks}w (S${displayS} W${displayW})`,
          displayWeek: displayW,
          season: displayS,
          isHistorical: false,
          isCurrent: false,
        };

        skillsConfig.forEach(sk => {
          const rate = skillRates[sk.key] || 0;
          const projected = Math.min(sk.maxLevel, sk.baseLevel + (offsetWeeks * rate));
          entry[sk.key] = parseFloat(projected.toFixed(2));
        });

        points.push(entry);
      });

    } else {
      // Season 0..16 projection focus
      for (let w = 0; w <= 16; w++) {
        const entry: Record<string, any> = {
          timelineIndex: w,
          weekLabel: w === 0 ? 'Wk 0 (Current)' : `Wk ${w}`,
          displayWeek: w,
          isHistorical: w === 0,
          isCurrent: w === 0,
        };
        skillsConfig.forEach(sk => {
          const rate = skillRates[sk.key] || 0;
          const projected = Math.min(sk.maxLevel, sk.baseLevel + (w * rate));
          entry[sk.key] = parseFloat(projected.toFixed(2));
        });
        points.push(entry);
      }
    }

    return points;
  }, [viewMode, chronologicalHistory, skillsConfig, skillRates, currentSeasonWeek]);

  // Bar Graph Data comparing Current Rating vs Projected Rating per skill
  const barChartData = useMemo(() => {
    return skillsConfig.map(sk => {
      const rate = skillRates[sk.key] || 0;
      const projected = Math.min(sk.maxLevel, sk.baseLevel + (projectionWeeks * rate));
      const hasNets = sk.nets > 0 || sk.isSquad || (sk.key === 'concentration' && plannerNets.batting > 0) || (sk.key === 'consistency' && plannerNets.bowling > 0);
      
      const trainingBadge = sk.nets > 0 
        ? `${sk.nets} net${sk.nets > 1 ? 's' : ''}` 
        : sk.isSquad 
          ? 'Squad' 
          : sk.key === 'concentration' && plannerNets.batting > 0 
            ? 'Synergy' 
            : sk.key === 'consistency' && plannerNets.bowling > 0 
              ? 'Synergy' 
              : '0 nets';

      return {
        key: sk.key,
        name: sk.name,
        shortName: sk.shortName,
        current: sk.baseLevel,
        projected: parseFloat(projected.toFixed(2)),
        gain: parseFloat((projected - sk.baseLevel).toFixed(2)),
        nets: sk.nets,
        hasNets,
        trainingBadge,
        color: sk.color,
        currentLabel: getSkillLabel(sk.key, Math.floor(sk.baseLevel)),
        projectedLabel: getSkillLabel(sk.key, Math.floor(projected)),
      };
    });
  }, [skillsConfig, skillRates, projectionWeeks, plannerNets]);

  // Calculate Average line for skills that have training nets
  const trainedSkillsStats = useMemo(() => {
    const trained = barChartData.filter(d => d.hasNets && d.nets > 0);
    // Fallback to all trained including squad/synergy if no direct nets
    const effectiveTrained = trained.length > 0 ? trained : barChartData.filter(d => d.hasNets);

    if (effectiveTrained.length === 0) {
      const overallAvg = barChartData.reduce((acc, d) => acc + d.current, 0) / (barChartData.length || 1);
      return {
        hasTraining: false,
        count: 0,
        avgCurrent: parseFloat(overallAvg.toFixed(2)),
        avgProjected: parseFloat(overallAvg.toFixed(2)),
      };
    }

    const sumCurrent = effectiveTrained.reduce((acc, d) => acc + d.current, 0);
    const sumProjected = effectiveTrained.reduce((acc, d) => acc + d.projected, 0);
    const count = effectiveTrained.length;

    return {
      hasTraining: true,
      count,
      avgCurrent: parseFloat((sumCurrent / count).toFixed(2)),
      avgProjected: parseFloat((sumProjected / count).toFixed(2)),
    };
  }, [barChartData]);

  // Overall player average across all 7 skills
  const overallSkillAvg = useMemo(() => {
    const sum = barChartData.reduce((acc, d) => acc + d.current, 0);
    return parseFloat((sum / (barChartData.length || 1)).toFixed(2));
  }, [barChartData]);

  // Detect pop milestones
  const popMilestones = useMemo(() => {
    const milestones: { label: string; timelineIndex: number; level: number; color: string; skillName: string }[] = [];

    // 1. Historical pops from history notes
    if (viewMode === 'full' && chronologicalHistory.length > 0) {
      chronologicalHistory.forEach((h, idx) => {
        if (h.note && /training pop/i.test(h.note)) {
          skillsConfig.forEach(sk => {
            if (h.note?.toLowerCase().includes(sk.name.toLowerCase()) || h.note?.toLowerCase().includes(sk.key.toLowerCase())) {
              const val = (h.skills as any)?.[sk.key] || sk.baseLevel;
              milestones.push({
                label: `Pop: ${sk.name}`,
                timelineIndex: idx,
                level: val,
                color: sk.color,
                skillName: sk.name,
              });
            }
          });
        }
      });
    }

    // 2. Future predicted first pops
    const startIndex = viewMode === 'full' && chronologicalHistory.length > 0 ? chronologicalHistory.length - 1 : 0;
    skillsConfig.forEach(sk => {
      const rate = skillRates[sk.key] || 0;
      if (rate > 0) {
        for (let w = 1; w <= 16; w++) {
          const prev = Math.floor(sk.baseLevel + ((w - 1) * rate));
          const curr = Math.floor(sk.baseLevel + (w * rate));
          if (curr > prev && curr <= sk.maxLevel) {
            const targetPointIndex = chartData.findIndex(p => !p.isHistorical && p.weekLabel.startsWith(`+${w}w`)) || (startIndex + w);
            if (targetPointIndex >= 0) {
              milestones.push({
                label: `Proj: ${sk.name} Lv ${curr}`,
                timelineIndex: targetPointIndex,
                level: curr,
                color: sk.color,
                skillName: sk.name,
              });
            }
            break;
          }
        }
      }
    });

    return milestones;
  }, [viewMode, chronologicalHistory, skillsConfig, skillRates, chartData]);

  // Tabular matrix representation
  const matrixColumns = useMemo(() => {
    if (viewMode === 'full' && chronologicalHistory.length > 0) {
      return chartData.filter((_, idx) => {
        if (chartData.length <= 9) return true;
        return idx === 0 || idx === chronologicalHistory.length - 1 || idx % 2 === 0 || idx === chartData.length - 1;
      });
    }
    return chartData.filter(p => [0, 2, 4, 6, 8, 10, 12, 14, 16].includes(p.displayWeek));
  }, [viewMode, chronologicalHistory, chartData]);

  return (
    <div className="bg-white text-slate-900 border border-slate-200/90 rounded-2xl p-5 sm:p-7 shadow-xs flex flex-col gap-6 font-sans overflow-hidden" id="player-skill-projection-chart-container">
      
      {/* 1. Header with Dark Blue Concept Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-[#0b192e] to-[#0f172a] text-white rounded-2xl p-5 sm:p-6 shadow-md border border-blue-900/40 relative overflow-hidden" id="skill-progression-dark-header">
        {/* Decorative background accents */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-200 bg-blue-900/80 border border-blue-400/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-300" />
                <span>Skill Trajectory & Historical Results</span>
              </span>
              {trainedSkillsStats.hasTraining && (
                <span className="text-[11px] font-mono font-bold text-emerald-200 bg-emerald-950/70 border border-emerald-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  <span>{trainedSkillsStats.count} Skills Active in Nets</span>
                </span>
              )}
            </div>
            <h3 className="font-serif font-bold text-2xl sm:text-3xl text-white tracking-tight">
              Skill Progression & Training Analysis
            </h3>
            <p className="text-xs sm:text-sm text-blue-100/80 mt-1 max-w-2xl leading-relaxed font-normal">
              Visualizing verified historical match snapshots alongside dedicated net training projections (1–20 rating scale).
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
            {chronologicalHistory.length > 1 && (
              <div className="bg-white/10 p-0.5 rounded-xl border border-white/15 flex items-center backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('full')}
                  className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    viewMode === 'full' 
                      ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                      : 'text-blue-200 hover:text-white'
                  }`}
                >
                  <History className="w-3 h-3 text-blue-600" />
                  <span>History + Proj</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('projectionOnly')}
                  className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                    viewMode === 'projectionOnly' 
                      ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                      : 'text-blue-200 hover:text-white'
                  }`}
                >
                  <Calendar className="w-3 h-3 text-amber-600" />
                  <span>16-Wk Season</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={resetSkills}
              className="text-xs font-mono font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs backdrop-blur-xs"
              title="Reset visible skills"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top Line Graph: Progression Timeline */}
      <div className="relative w-full border-b border-slate-100 pb-6">
        <div className="flex items-center justify-between text-xs font-mono text-slate-600 mb-2">
          <span className="font-serif font-bold text-sm text-slate-900 tracking-wide flex items-center gap-1.5">
            Skill Rating Timeline (1–20 Scale)
          </span>
          <span className="text-[11px] text-slate-500 font-sans hidden sm:inline">
            Click lines or table below to isolate skills
          </span>
        </div>

        <div className="h-64 sm:h-80 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: -10, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

              <XAxis
                dataKey="weekLabel"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                tickLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
              />

              <YAxis
                domain={[1, 20]}
                ticks={[1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]}
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                tickLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
              />

              {viewMode === 'full' && chronologicalHistory.length > 1 && (
                <ReferenceLine
                  x={chartData.find(p => p.isCurrent)?.weekLabel}
                  stroke="#2563eb"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Current Snapshot',
                    position: 'insideTopRight',
                    fill: '#2563eb',
                    fontSize: 10,
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                  }}
                />
              )}

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const point = payload[0]?.payload;
                    const isHist = point?.isHistorical;
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xl text-xs font-mono min-w-[230px] z-50">
                        <div className="text-slate-900 font-bold border-b border-slate-100 pb-1.5 mb-2 flex justify-between items-center font-serif text-sm">
                          <span>{label}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            isHist 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {isHist ? 'Historical Actual' : 'Projected'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {payload.map((entry: any) => {
                            const val = Number(entry.value);
                            const skConfig = skillsConfig.find(s => s.key === entry.dataKey);
                            const labelStr = skConfig ? getSkillLabel(skConfig.key, Math.floor(val)) : '';
                            return (
                              <div key={entry.dataKey} className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }}></span>
                                  <span className="font-semibold text-slate-700">{entry.name}:</span>
                                </span>
                                <span className="text-slate-900 font-bold font-mono">
                                  {val.toFixed(1)} <span className="text-[10px] font-normal text-slate-500">({labelStr})</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {skillsConfig.map(sk => {
                if (!visibleSkills[sk.key]) return null;
                return (
                  <Line
                    key={sk.key}
                    type="monotone"
                    dataKey={sk.key}
                    name={sk.name}
                    stroke={sk.color}
                    strokeWidth={2.8}
                    dot={{ r: 2.5, fill: sk.color, stroke: '#ffffff', strokeWidth: 1 }}
                    activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2, fill: sk.color }}
                    isAnimationActive={true}
                  />
                );
              })}

              {popMilestones.map((p, idx) => {
                if (!visibleSkills[p.skillName.toLowerCase()]) return null;
                const point = chartData[p.timelineIndex];
                if (!point) return null;
                return (
                  <ReferenceDot
                    key={`pop-${idx}`}
                    x={point.weekLabel}
                    y={p.level}
                    r={5}
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth={2}
                    label={{
                      value: `★ ${p.skillName}`,
                      position: 'top',
                      fill: p.color,
                      fontSize: 10,
                      fontFamily: 'monospace',
                      fontWeight: 'bold',
                    }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Skill Breakdown & Matrix: Bar Graph with Average Line or Tabular Matrix */}
      <div className="flex flex-col gap-4">
        
        {/* Matrix / Bar Graph Section Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 sm:p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-base text-slate-900">
                {matrixDisplayMode === 'bar' ? 'Skill Rating Bar Chart & Net Training Average' : 'Skill Progression Matrix Table'}
              </span>
              {trainedSkillsStats.hasTraining && (
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-md">
                  Avg Line: Lv {trainedSkillsStats.avgCurrent.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {matrixDisplayMode === 'bar' 
                ? 'Compares current skill levels with projected growth, featuring a benchmark average line for skills receiving training nets.'
                : 'Week-by-week numeric rating table across historical snapshots and future training cycles.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {matrixDisplayMode === 'bar' && (
              <div className="flex items-center gap-1 text-xs font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                <span className="text-slate-500">Proj Horizon:</span>
                <select
                  value={projectionWeeks}
                  onChange={(e) => setProjectionWeeks(Number(e.target.value))}
                  className="bg-transparent font-bold text-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value={8}>8 Weeks</option>
                  <option value={12}>12 Weeks</option>
                  <option value={16}>16 Weeks (Full Season)</option>
                </select>
              </div>
            )}

            {/* Toggle between Bar Graph and Data Matrix Table */}
            <div className="bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/80 flex items-center">
              <button
                type="button"
                onClick={() => setMatrixDisplayMode('bar')}
                className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                  matrixDisplayMode === 'bar' 
                    ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View Bar Graph with Training Net Average Line"
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Bar Graph</span>
              </button>
              <button
                type="button"
                onClick={() => setMatrixDisplayMode('table')}
                className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                  matrixDisplayMode === 'table' 
                    ? 'bg-white text-slate-900 shadow-2xs font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="View Tabular Data Matrix"
              >
                <TableIcon className="w-3.5 h-3.5 text-slate-600" />
                <span>Matrix Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* View Mode 1: Bar Graph with Average Line for Skills with Training Nets */}
        {matrixDisplayMode === 'bar' ? (
          <div className="flex flex-col gap-4">
            
            {/* Quick Stat Highlights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                  Trained Skills Avg
                </span>
                <div className="font-serif font-bold text-xl sm:text-2xl text-slate-900 my-0.5">
                  {trainedSkillsStats.hasTraining ? trainedSkillsStats.avgCurrent.toFixed(1) : overallSkillAvg.toFixed(1)}
                </div>
                <span className="text-[11px] font-mono text-emerald-600 font-semibold">
                  {trainedSkillsStats.hasTraining ? `Proj: Lv ${trainedSkillsStats.avgProjected.toFixed(1)}` : 'No nets'}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                  Overall Skill Mean
                </span>
                <div className="font-serif font-bold text-xl sm:text-2xl text-slate-900 my-0.5">
                  {overallSkillAvg.toFixed(1)}
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  across all 7 skills
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                  Active Net Slots
                </span>
                <div className="font-serif font-bold text-xl sm:text-2xl text-blue-600 my-0.5">
                  {(plannerNets.batting + plannerNets.bowling + plannerNets.keeping + plannerNets.stamina + plannerNets.fielding)} nets
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  assigned to player
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
                  Max Projected Pop
                </span>
                <div className="font-serif font-bold text-xl sm:text-2xl text-emerald-600 my-0.5">
                  +{Math.max(...barChartData.map(d => d.gain)).toFixed(1)}
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  in {projectionWeeks} weeks
                </span>
              </div>
            </div>

            {/* Bar Chart Viewport */}
            <div className="h-72 sm:h-88 w-full relative pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 25, right: 30, left: -10, bottom: 25 }}
                  barCategoryGap="20%"
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

                  <XAxis
                    dataKey="name"
                    stroke="#64748b"
                    tick={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }}
                    axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                    tickLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  />

                  <YAxis
                    domain={[0, 20]}
                    ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]}
                    stroke="#64748b"
                    tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
                    axisLine={{ stroke: '#cbd5e1', strokeWidth: 1.5 }}
                    tickLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  />

                  {/* Benchmark ReferenceLine for Average of Trained Skills */}
                  {trainedSkillsStats.hasTraining && (
                    <ReferenceLine
                      y={trainedSkillsStats.avgCurrent}
                      stroke="#2563eb"
                      strokeDasharray="6 4"
                      strokeWidth={2}
                      label={{
                        value: `★ Trained Skills Avg: Lv ${trainedSkillsStats.avgCurrent.toFixed(1)}`,
                        position: 'insideTopLeft',
                        fill: '#1d4ed8',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                      }}
                    />
                  )}

                  {/* Overall Skill Baseline ReferenceLine */}
                  <ReferenceLine
                    y={overallSkillAvg}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    strokeWidth={1.2}
                    label={{
                      value: `Overall Mean: Lv ${overallSkillAvg.toFixed(1)}`,
                      position: 'insideBottomRight',
                      fill: '#64748b',
                      fontSize: 10,
                      fontFamily: 'monospace',
                    }}
                  />

                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0]?.payload;
                        return (
                          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xl text-xs font-mono min-w-[220px]">
                            <div className="text-slate-900 font-bold border-b border-slate-100 pb-1.5 mb-2 flex justify-between items-center font-serif text-sm">
                              <span>{data.name}</span>
                              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                data.hasNets 
                                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}>
                                {data.trainingBadge}
                              </span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-600">Current Rating:</span>
                                <span className="font-bold text-slate-900">
                                  {data.current} <span className="text-[10px] font-normal text-slate-500">({data.currentLabel})</span>
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-emerald-700 font-semibold">Projected (+{projectionWeeks}w):</span>
                                <span className="font-bold text-emerald-700">
                                  {data.projected} <span className="text-[10px] font-normal text-emerald-600">({data.projectedLabel})</span>
                                </span>
                              </div>
                              <div className="flex justify-between items-center border-t border-slate-100 pt-1 mt-1 text-slate-500">
                                <span>Estimated Growth:</span>
                                <span className="font-bold text-blue-600">+{data.gain} levels</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  {/* Current Rating Bar */}
                  <Bar dataKey="current" name="Current Rating" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {barChartData.map((entry) => (
                      <Cell 
                        key={`cell-curr-${entry.key}`} 
                        fill={entry.hasNets ? entry.color : '#94a3b8'} 
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>

                  {/* Projected Growth Bar */}
                  <Bar dataKey="projected" name={`Projected (+${projectionWeeks}w)`} fill="#10b981" radius={[4, 4, 0, 0]}>
                    {barChartData.map((entry) => (
                      <Cell 
                        key={`cell-proj-${entry.key}`} 
                        fill={entry.hasNets ? '#059669' : '#cbd5e1'} 
                        fillOpacity={0.9}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend & Training Indicators */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-2 text-xs font-mono text-slate-600 border-t border-slate-100">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-600"></span>
                  <span className="font-semibold text-slate-800">Current Rating</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-600"></span>
                  <span className="font-semibold text-slate-800">Projected (+{projectionWeeks}w)</span>
                </div>
                {trainedSkillsStats.hasTraining && (
                  <div className="flex items-center gap-1.5 text-blue-700 font-bold">
                    <span className="w-4 h-0.5 bg-blue-600 border-b border-dashed border-blue-600"></span>
                    <span>Trained Skills Average Line (Lv {trainedSkillsStats.avgCurrent.toFixed(1)})</span>
                  </div>
                )}
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                Grey bars indicate skills with zero active training nets.
              </div>
            </div>

          </div>
        ) : (
          /* View Mode 2: Full Tabular Data Matrix */
          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 text-slate-700 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-serif font-bold text-xs tracking-wide text-slate-900 min-w-[150px]">
                    Skill Parameter
                  </th>
                  {matrixColumns.map((col, idx) => (
                    <th key={idx} className="py-2.5 px-2 text-center font-bold text-xs text-slate-800 min-w-[58px]">
                      <div className="leading-tight">{col.weekLabel}</div>
                      <div className="text-[9px] font-normal text-slate-500 font-sans">
                        {col.isHistorical ? 'Actual' : 'Proj'}
                      </div>
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right font-bold text-[11px] text-slate-600 min-w-[80px]">
                    Growth/Wk
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {skillsConfig.map(sk => {
                  const isVisible = visibleSkills[sk.key];
                  const rate = skillRates[sk.key] || 0;
                  const trainingLabel = sk.nets > 0 
                    ? `${sk.nets} net${sk.nets > 1 ? 's' : ''}` 
                    : sk.isSquad 
                      ? 'Squad' 
                      : sk.key === 'concentration' && plannerNets.batting > 0 
                        ? 'Synergy' 
                        : sk.key === 'consistency' && plannerNets.bowling > 0 
                          ? 'Synergy' 
                          : '0 nets';

                  return (
                    <tr 
                      key={sk.key} 
                      className={`hover:bg-slate-50/90 transition-colors cursor-pointer ${!isVisible ? 'opacity-35 line-through' : ''}`}
                      onClick={() => toggleSkill(sk.key)}
                      title={`Click to toggle ${sk.name} on graph`}
                    >
                      <td className="py-2.5 px-3 font-bold flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sk.color }}></span>
                          <span className="font-semibold text-xs tracking-tight text-slate-900">{sk.name}</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 no-underline font-normal">
                          {trainingLabel}
                        </span>
                      </td>

                      {matrixColumns.map((col, idx) => {
                        const val = Number(col[sk.key] || 0);
                        const isPopped = val >= Math.floor(sk.baseLevel) + 1;
                        return (
                          <td 
                            key={idx} 
                            className={`py-2.5 px-2 text-center font-mono ${
                              isPopped ? 'text-blue-700 font-bold bg-blue-50/40' : 'text-slate-800'
                            }`}
                          >
                            {val.toFixed(1)}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 text-right font-mono text-[11px] font-semibold text-slate-700">
                        {rate > 0 ? (
                          <span className="text-emerald-600 font-bold">+{rate.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400">0.00</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* 4. Notes Section in Clean Light Styling */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4">
        {/* Left vertical header "Notes" */}
        <div className="flex items-center sm:flex-col justify-center shrink-0 border-b sm:border-b-0 sm:border-r border-slate-200 pb-2 sm:pb-0 sm:pr-4 sm:py-1">
          <span className="font-serif font-bold text-base sm:text-lg text-slate-900 tracking-wider uppercase sm:[writing-mode:vertical-lr] sm:rotate-180">
            Notes
          </span>
        </div>

        {/* Right side bullet points */}
        <div className="flex flex-col gap-1.5 text-xs sm:text-[13px] leading-relaxed text-slate-600 font-normal">
          <p>
            <b className="text-blue-600">Dedicated Net Training:</b> Primary cricket skills (Batting, Bowling, Wicket Keeping) advance fastest when receiving dedicated training nets.
          </p>
          <p>
            <b className="text-emerald-600">Average Benchmark Line:</b> The blue dashed reference line tracks the average skill level of your actively trained skills, making relative pop velocity easy to benchmark.
          </p>
          <p>
            <b className="text-amber-600">Squad-Wide Progress:</b> Stamina and Fielding advance across the whole squad when squad training options are selected.
          </p>
          <p>
            <b className="text-rose-600">Synergy Development:</b> Batting nets generate passive Concentration gains, while Bowling nets develop Consistency.
          </p>
        </div>
      </div>

    </div>
  );
}
