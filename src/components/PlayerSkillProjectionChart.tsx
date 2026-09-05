import React, { useState, useMemo } from 'react';
import { BattrickPlayer, getSkillLabel } from '../types';
import { estimateWeeksToNextLevel } from '../parser';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot
} from 'recharts';
import { Sparkles, RotateCcw } from 'lucide-react';

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

  // Skill metadata with specific palette matching the reference image:
  // - Batting: Vibrant Orange (like Hero Kill in image)
  // - Bowling: Purple (like Crate in image)
  // - Keeping: Sky/Cyan (like Trooper in image)
  // - Fielding: Light Green (like Urn in image)
  // - Stamina: Golden Yellow (like Camps in image)
  // - Concentration: Rose/Pink
  // - Consistency: Teal
  const skillsConfig: SkillMeta[] = useMemo(() => [
    {
      key: 'batting',
      name: 'Batting',
      color: '#fb923c', // Warm vibrant orange
      baseLevel: player.skills.batting,
      nets: plannerNets.batting,
      isSquad: false,
      maxLevel: 20,
    },
    {
      key: 'bowling',
      name: 'Bowling',
      color: '#c084fc', // Purple/Violet
      baseLevel: player.skills.bowling,
      nets: plannerNets.bowling,
      isSquad: false,
      maxLevel: 20,
    },
    {
      key: 'keeping',
      name: 'Wicket Keeping',
      color: '#38bdf8', // Sky Blue
      baseLevel: player.skills.keeping,
      nets: plannerNets.keeping,
      isSquad: false,
      maxLevel: 20,
    },
    {
      key: 'fielding',
      name: 'Fielding',
      color: '#4ade80', // Green
      baseLevel: player.skills.fielding || 0,
      nets: plannerNets.fielding,
      isSquad: squadTrainingFielding,
      maxLevel: 20,
    },
    {
      key: 'stamina',
      name: 'Stamina',
      color: '#facc15', // Gold/Yellow
      baseLevel: player.skills.stamina,
      nets: plannerNets.stamina,
      isSquad: squadTrainingStamina,
      maxLevel: 11,
    },
    {
      key: 'concentration',
      name: 'Concentration',
      color: '#fb7185', // Rose/Coral
      baseLevel: player.skills.concentration,
      nets: 0,
      isSquad: false,
      maxLevel: 20,
    },
    {
      key: 'consistency',
      name: 'Consistency',
      color: '#2dd4bf', // Teal
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

  // Weeks range: 0 to 16 (Full Season)
  const weeksList = [0, 2, 4, 6, 8, 10, 12, 14, 16];

  // Generate data points for Recharts (all weeks 0..16)
  const chartData = useMemo(() => {
    const points = [];
    for (let w = 0; w <= 16; w++) {
      const entry: Record<string, any> = { week: w };
      skillsConfig.forEach(sk => {
        const rate = skillRates[sk.key] || 0;
        const projected = Math.min(sk.maxLevel, sk.baseLevel + (w * rate));
        entry[sk.key] = parseFloat(projected.toFixed(2));
      });
      points.push(entry);
    }
    return points;
  }, [skillsConfig, skillRates]);

  // Detect pop milestones (first week an integer pop occurs) for star markers
  const popMilestones = useMemo(() => {
    const milestones: { skillKey: string; week: number; level: number; color: string; skillName: string }[] = [];
    
    skillsConfig.forEach(sk => {
      const rate = skillRates[sk.key] || 0;
      if (rate > 0) {
        for (let w = 1; w <= 16; w++) {
          const prev = Math.floor(sk.baseLevel + ((w - 1) * rate));
          const curr = Math.floor(sk.baseLevel + (w * rate));
          if (curr > prev && curr <= sk.maxLevel) {
            milestones.push({
              skillKey: sk.key,
              week: w,
              level: curr,
              color: sk.color,
              skillName: sk.name,
            });
            break; // Mark first pop
          }
        }
      }
    });

    return milestones;
  }, [skillsConfig, skillRates]);

  // Tabular matrix data for weeks [0, 2, 4, 6, 8, 10, 12, 14, 16]
  const tableData = useMemo(() => {
    return skillsConfig.map(sk => {
      const rate = skillRates[sk.key] || 0;
      const values = weeksList.map(w => {
        const val = Math.min(sk.maxLevel, sk.baseLevel + (w * rate));
        return parseFloat(val.toFixed(1));
      });
      return {
        ...sk,
        rate,
        values,
      };
    });
  }, [skillsConfig, skillRates, weeksList]);

  return (
    <div className="bg-[#091512] text-[#f4ecd8] border border-[#1e342c] rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col gap-5 font-sans overflow-hidden" id="player-skill-projection-chart-container">
      
      {/* 1. Header & Subtitle matching the reference image layout */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#1c2e27] pb-3">
        <div>
          <h3 className="font-serif font-bold text-2xl sm:text-3xl text-[#faecd0] tracking-tight">
            Normalized Skill Progression
          </h3>
          <p className="text-xs sm:text-sm text-[#9fad9f] mt-1 max-w-2xl leading-relaxed font-normal">
            This shows the relative rate that skills scale throughout a season (Weeks 0–16). Under that, we have the absolute values listed (with a little rounding).
          </p>
        </div>

        {/* Quick Reset Button */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={resetSkills}
            className="text-[11px] font-mono text-[#a3b8aa] hover:text-[#faecd0] bg-[#12231e] hover:bg-[#182c26] border border-[#273d34] px-2.5 py-1 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            title="Reset visible skills"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset All</span>
          </button>
        </div>
      </div>

      {/* 2. Main Graph Area */}
      <div className="relative w-full pt-1">
        {/* Scale Factor label on Y-Axis */}
        <div className="flex items-center justify-between text-[11px] font-mono text-[#faecd0] mb-1">
          <span className="font-serif font-bold text-sm tracking-wide">Skill Rating</span>
          <span className="text-[10px] text-[#7d9183] font-sans">
            1 to 20 Scale • Click any skill row below to toggle line
          </span>
        </div>

        {/* Graph Viewport */}
        <div className="h-72 sm:h-84 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: -10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="1 3" stroke="#162721" vertical={false} />

              {/* X Axis: Season Weeks */}
              <XAxis
                dataKey="week"
                type="number"
                domain={[0, 16]}
                ticks={weeksList}
                stroke="#faecd0"
                tick={{ fill: '#faecd0', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#faecd0', strokeWidth: 2 }}
                tickLine={{ stroke: '#faecd0', strokeWidth: 1.5 }}
                label={{
                  value: 'Weeks',
                  position: 'insideBottomLeft',
                  offset: -12,
                  fill: '#faecd0',
                  fontSize: 13,
                  fontFamily: 'serif',
                  fontWeight: 'bold',
                }}
              />

              {/* Y Axis: Skill Rating (1 - 20) */}
              <YAxis
                domain={[1, 20]}
                ticks={[1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]}
                stroke="#faecd0"
                tick={{ fill: '#faecd0', fontSize: 11, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#faecd0', strokeWidth: 2 }}
                tickLine={{ stroke: '#faecd0', strokeWidth: 1.5 }}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-[#0b1713] border border-[#2c473c] rounded-xl p-3 shadow-2xl text-xs font-mono min-w-[220px] z-50">
                        <div className="text-[#faecd0] font-bold border-b border-[#1c3027] pb-1 mb-2 flex justify-between items-center font-serif text-sm">
                          <span>Season Week {label}</span>
                          <span className="text-[10px] font-mono text-[#7d9183] font-normal">{label === 0 ? 'Current baseline' : `+${label} weeks`}</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {payload.map((entry: any) => {
                            const val = Number(entry.value);
                            const skConfig = skillsConfig.find(s => s.key === entry.dataKey);
                            const labelStr = skConfig ? getSkillLabel(skConfig.key, Math.floor(val)) : '';
                            return (
                              <div key={entry.dataKey} className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color }}></span>
                                  <span className="font-semibold">{entry.name}:</span>
                                </span>
                                <span className="text-[#faecd0] font-bold">
                                  {val.toFixed(1)} <span className="text-[10px] font-normal text-[#8fa093]">({labelStr})</span>
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

              {/* Lines for each skill */}
              {skillsConfig.map(sk => {
                if (!visibleSkills[sk.key]) return null;
                return (
                  <Line
                    key={sk.key}
                    type="linear"
                    dataKey={sk.key}
                    name={sk.name}
                    stroke={sk.color}
                    strokeWidth={2.8}
                    dot={false}
                    activeDot={{ r: 5, stroke: '#091512', strokeWidth: 2, fill: sk.color }}
                    isAnimationActive={true}
                    // Custom label placed on the line at week 10 matching the text on lines in the image
                    label={(props: any) => {
                      const { x, y, index } = props;
                      // Display label near week 10 for actively scaling skills, or week 14 for flatter skills
                      const labelTargetWeek = sk.nets > 0 ? 10 : 13;
                      if (index === labelTargetWeek) {
                        return (
                          <text
                            x={x}
                            y={y - 7}
                            fill={sk.color}
                            fontSize={10}
                            fontFamily="sans-serif"
                            fontWeight="bold"
                            textAnchor="middle"
                            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}
                          >
                            {sk.name}
                          </text>
                        );
                      }
                      return null;
                    }}
                  />
                );
              })}

              {/* Pop milestone markers (star marker matching reference image at pop week) */}
              {popMilestones.map((p, idx) => {
                if (!visibleSkills[p.skillKey]) return null;
                return (
                  <ReferenceDot
                    key={`pop-${idx}`}
                    x={p.week}
                    y={p.level}
                    r={4.5}
                    fill={p.color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
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

      {/* 3. Tabular Matrix directly underneath matching the reference image layout */}
      <div className="border-t-2 border-[#faecd0] pt-4 overflow-x-auto -mx-1 px-1">
        <table className="w-full text-left font-mono text-xs border-collapse">
          <thead>
            <tr className="text-[#faecd0] border-b border-[#223930]">
              <th className="py-2 px-3 font-serif font-bold text-sm tracking-wide text-[#faecd0] min-w-[130px]">
                Minutes (Wk)
              </th>
              {weeksList.map(w => (
                <th key={w} className="py-2 px-2.5 text-center font-bold text-xs text-[#faecd0] min-w-[50px]">
                  {w}
                </th>
              ))}
              <th className="py-2 px-2 text-right font-bold text-[10px] text-[#7d9183] min-w-[70px]">
                Rate/Wk
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#162721]">
            {tableData.map(row => {
              const isVisible = visibleSkills[row.key];
              const trainingLabel = row.nets > 0 
                ? `${row.nets} net${row.nets > 1 ? 's' : ''}` 
                : row.isSquad 
                  ? 'Squad' 
                  : row.key === 'concentration' && plannerNets.batting > 0 
                    ? 'Synergy' 
                    : row.key === 'consistency' && plannerNets.bowling > 0 
                      ? 'Synergy' 
                      : '0 nets';

              return (
                <tr 
                  key={row.key} 
                  className={`hover:bg-[#12231e] transition-colors cursor-pointer ${!isVisible ? 'opacity-35 line-through' : ''}`}
                  onClick={() => toggleSkill(row.key)}
                  title={`Click to toggle ${row.name} on graph`}
                >
                  <td className="py-2 px-3 font-bold flex items-center justify-between gap-2" style={{ color: row.color }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }}></span>
                      <span className="font-semibold text-xs tracking-tight">{row.name}</span>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#10201a] border border-[#21382f] text-[#a0b3a7] no-underline">
                      {trainingLabel}
                    </span>
                  </td>

                  {row.values.map((val, idx) => {
                    const isPopped = val >= Math.floor(row.baseLevel) + 1;
                    return (
                      <td 
                        key={idx} 
                        className={`py-2 px-2.5 text-center font-mono ${
                          isPopped ? 'text-[#ffffff] font-extrabold' : 'text-[#d8cdb4]'
                        }`}
                      >
                        {val.toFixed(1)}
                      </td>
                    );
                  })}

                  <td className="py-2 px-2 text-right font-mono text-[10px] text-[#8fa093]">
                    {row.rate > 0 ? `+${row.rate.toFixed(2)}` : '0.00'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Notes Section at bottom matching the reference image layout */}
      <div className="bg-[#0b1713] border border-[#1f352b] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4 shadow-inner">
        {/* Left vertical/bold header "Notes" */}
        <div className="flex items-center sm:flex-col justify-center shrink-0 border-b sm:border-b-0 sm:border-r border-[#263e33] pb-2 sm:pb-0 sm:pr-4 sm:py-1">
          <span className="font-serif font-bold text-lg sm:text-2xl text-[#faecd0] tracking-wider uppercase sm:[writing-mode:vertical-lr] sm:rotate-180">
            Notes
          </span>
        </div>

        {/* Right side bullet points */}
        <div className="flex flex-col gap-1.5 text-xs sm:text-[13px] leading-relaxed text-[#c3d1c7] font-normal">
          <p>
            <b className="text-[#fb923c]">Kills scale by far the most:</b> Primary skills (Batting, Bowling, Wicket Keeping) scale the fastest when assigned dedicated training nets.
          </p>
          <p>
            <b className="text-[#38bdf8]">Youth Jump:</b> Younger players (age 17–19) pop significantly faster due to exponential youth elasticity.
          </p>
          <p>
            <b className="text-[#4ade80]">Squad Training:</b> All squad-wide training (Stamina and Fielding) advances at a flat ~5.5 weeks per pop across the entire roster.
          </p>
          <p>
            <b className="text-[#fb7185]">Synergy Gains:</b> Batting nets passively develop Concentration; Bowling nets gradually enhance Consistency.
          </p>
          <p>
            <b className="text-[#facc15]">Ceiling:</b> Core cricket skills cap at Level 20 (Elite); Stamina peaks at Level 11 (Superb*).
          </p>
          {popMilestones.length > 0 && (
            <p className="text-[11px] text-[#93c5fd] font-mono flex items-center gap-1.5 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>
                Star markers (★) highlight estimated weeks when training produces a full integer skill level pop.
              </span>
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
