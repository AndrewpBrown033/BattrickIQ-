import React, { useState } from 'react';
import { BookOpen, Award, TrendingUp, Coins, ShieldCheck, Landmark, HeartPulse, Brain, Calculator, AlertTriangle, Info } from 'lucide-react';
import AuthController from './AuthController';

export default function BusinessRules() {
  const [calcMembers, setCalcMembers] = useState<number>(1200);
  const [calcCash, setCalcCash] = useState<number>(3500000);

  const skills = [
    'worthless', 'abysmal', 'woeful', 'feeble', 'mediocre', 'competent', 'respectable',
    'proficient', 'strong', 'superb', 'quality', 'remarkable', 'wonderful', 'exceptional',
    'sensational', 'exquisite', 'masterful', 'miraculous', 'phenomenal', 'elite'
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="business-rules-container">
      {/* Manager Profile & Team Association Applet */}
      <div className="md:col-span-12 lg:col-span-12">
        <AuthController />
      </div>

      {/* Column 1: Coaching, Training & Pops */}
      <div className="md:col-span-6 lg:col-span-6 flex flex-col gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <Award className="w-5 h-5 text-indigo-600" />
            1. Player Training & pop Speeds
          </h4>

          <div className="flex flex-col gap-4 text-xs text-slate-600 leading-relaxed">
            <div>
              <span className="font-bold text-slate-800">Age Training Penalty (Exponential Decay):</span>
              <p className="mt-1">
                A player's training speed decays rapidly with age. 17 is the golden training age (100% speed). Every year added increases weeks-to-pop by approximately <strong className="text-indigo-700">22%</strong>.
              </p>
              <div className="grid grid-cols-5 gap-1.5 mt-2 font-mono text-[10px] text-center">
                <div className="bg-slate-50 border p-1 rounded"><span className="block font-bold text-slate-800">17yo</span>1.0x</div>
                <div className="bg-slate-50 border p-1 rounded"><span className="block font-bold text-slate-800">18yo</span>1.22x</div>
                <div className="bg-slate-50 border p-1 rounded"><span className="block font-bold text-slate-800">19yo</span>1.49x</div>
                <div className="bg-slate-50 border p-1 rounded"><span className="block font-bold text-slate-800">20yo</span>1.81x</div>
                <div className="bg-slate-50 border p-1 rounded"><span className="block font-bold text-slate-800">21yo+</span>2.21x+</div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <span className="font-bold text-slate-800">Coaching Staff Multipliers:</span>
              <p className="mt-1">
                Your head coach level defines the base subskill training rate. A <strong className="text-slate-800">Superb Coach (Level 9)</strong> is the standard professional benchmark.
              </p>
              <ul className="list-disc pl-4 mt-1.5 space-y-1">
                <li><strong className="text-slate-800">Excellent/Quality Coach:</strong> Speed multiplier improves to ~1.05x.</li>
                <li><strong className="text-slate-800">Superb Coach:</strong> Base speed (1.00x).</li>
                <li><strong className="text-slate-800">Strong Coach:</strong> Slower, adds ~10% to training times.</li>
              </ul>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <span className="font-bold text-slate-800">The Diminishing Nets Law (Max 3 per Player):</span>
              <p className="mt-1">
                While you can assign multiple nets to a single skill (e.g., Batting), training efficiency experiences sharp diminishing returns. Additionally, Battrick imposes a strict hard limit of <strong className="text-indigo-700">3 nets in total</strong> per player.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-2 font-mono text-[10px] text-center">
                <div className="bg-indigo-50/50 border border-indigo-100 p-1.5 rounded"><span className="block font-bold text-indigo-900">1 Net</span>100% Speed</div>
                <div className="bg-indigo-50/50 border border-indigo-100 p-1.5 rounded"><span className="block font-bold text-indigo-900">2 Nets</span>150% (75%/net)</div>
                <div className="bg-indigo-50/50 border border-indigo-100 p-1.5 rounded"><span className="block font-bold text-indigo-900">3 Nets</span>175% (58%/net)</div>
              </div>
              <p className="text-[10px] text-amber-600 mt-1.5 font-medium">
                ⚠️ Battrick limits each player to a maximum of 3 nets in total across all skills! Setting more is not supported by the game engine.
              </p>
            </div>
          </div>
        </div>

        {/* 2. IQ Index Diagnostic Hierarchy */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <Brain className="w-5 h-5 text-indigo-600" />
              2. IQ Index Diagnostic Hierarchy
            </h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              The <strong>IQ Index</strong> is BattrickIQ's proprietary player valuation metric. Unlike basic primary skill values, the IQ Index weights each player's complete skill matrix based on their designated tactical role, and dynamically modulates it with their current physical readiness.
            </p>

            <div className="space-y-3 text-xs">
              {/* Core Role Formulas */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-lg p-3">
                <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block mb-2">Role Weighted Base Formulas</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10px] text-slate-600">
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <strong className="text-indigo-800">Batter:</strong>
                    <div className="mt-1">Batting × 1.0</div>
                    <div>+ Concentration × 0.35</div>
                    <div>+ Consistency × 0.25</div>
                    <div>+ Stamina × 0.15 + Exp × 0.15</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <strong className="text-indigo-800">Bowler:</strong>
                    <div className="mt-1">Bowling × 1.0</div>
                    <div>+ Consistency × 0.35</div>
                    <div>+ Concentration × 0.15</div>
                    <div>+ Stamina × 0.20 + Exp × 0.15</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <strong className="text-indigo-800">Wicketkeeper:</strong>
                    <div className="mt-1 font-semibold text-slate-700">Keeping × 1.0</div>
                    <div>+ Batting × 0.40</div>
                    <div>+ Concentration × 0.20</div>
                    <div>+ Stamina × 0.15 + Exp × 0.15</div>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-100">
                    <strong className="text-indigo-800">All-rounder:</strong>
                    <div className="mt-1 font-semibold text-slate-700">Batting × 0.70 + Bowling × 0.70</div>
                    <div>+ Consistency × 0.20</div>
                    <div>+ Concentration × 0.20</div>
                    <div>+ Stamina × 0.15 + Exp × 0.15</div>
                  </div>
                </div>
              </div>

              {/* Dynamic Modulators */}
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-3">
                <span className="font-bold text-indigo-950 text-[11px] uppercase tracking-wider block mb-1">Dynamic Condition Scaling</span>
                <p className="text-[11px] text-slate-600 mb-2 leading-relaxed">
                  Raw skills only set the foundation. Matchday output is heavily impacted by mental confidence (Form) and physical status (Fitness):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10px] text-indigo-900">
                  <div className="bg-white/80 p-2 rounded border border-indigo-100/50">
                    <span className="font-bold block text-indigo-950">Form Multiplier:</span>
                    0.70 + (Form Level × 0.05)
                  </div>
                  <div className="bg-white/80 p-2 rounded border border-indigo-100/50">
                    <span className="font-bold block text-indigo-950">Fitness Multiplier:</span>
                    0.70 + (Fitness Level × 0.05)
                  </div>
                </div>
              </div>

              {/* Final Formula */}
              <div className="flex items-center justify-between bg-indigo-950 text-white font-mono p-3 rounded-lg border border-indigo-900 text-center">
                <div className="w-full">
                  <span className="text-[9px] text-indigo-300 block font-bold uppercase tracking-widest leading-none mb-1">Final Diagnostic Output</span>
                  <span className="text-sm font-extrabold text-indigo-200">IQ Index = Base Score × Form Factor × Fitness Factor</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 leading-relaxed">
            📊 <strong>Strategic Insight:</strong> Two identical players with the same primary skills can have widely differing IQ Indexes on matchday. A player in <em>superb/sublime</em> condition operates at up to <strong>144%</strong> capability, while a player with <em>worthless/aching</em> condition operates at only <strong>50%</strong> capability.
          </div>
        </div>
      </div>

      {/* Column 2: Stadium & Financials */}
      <div className="md:col-span-6 lg:col-span-6 flex flex-col gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <Landmark className="w-5 h-5 text-emerald-600" />
            3. Stadium Expansion & Ratios
          </h4>

          <div className="flex flex-col gap-4 text-xs text-slate-600 leading-relaxed">
            <div>
              <span className="font-bold text-slate-800">Perfect Seat Allocation Ratios:</span>
              <p className="mt-1">
                To maximize ticket sales and completely eliminate empty seats during sold-out matches, your stadium must adhere exactly to the following ratio:
              </p>
              <div className="space-y-1.5 mt-2">
                <div className="flex justify-between items-center bg-slate-50 border p-2 rounded">
                  <span className="font-semibold text-slate-700">Terracing (General Admission)</span>
                  <span className="font-mono font-bold text-indigo-700">60%</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 border p-2 rounded">
                  <span className="font-semibold text-slate-700">Grass Banks (Premium Open-air)</span>
                  <span className="font-mono font-bold text-indigo-700">30%</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 border p-2 rounded">
                  <span className="font-semibold text-slate-700">Seats (Covered Grandstand)</span>
                  <span className="font-mono font-bold text-indigo-700">8%</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 border p-2 rounded">
                  <span className="font-semibold text-slate-700">Executive Boxes (VIP Lounges)</span>
                  <span className="font-mono font-bold text-indigo-700">2%</span>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <span className="font-bold text-slate-800">Club Members Expansion Benchmarks:</span>
              <p className="mt-1">
                Your ideal stadium capacity should scale directly with your Club Member count. Expanding too early leads to high weekly maintenance costs.
              </p>
              <ul className="list-disc pl-4 mt-1.5 space-y-1">
                <li><strong className="text-slate-800">Rebuilding Clubs:</strong> Members × 12 or 13 seats.</li>
                <li><strong className="text-slate-800">Mid-Table Clubs:</strong> Members × 15 seats.</li>
                <li><strong className="text-slate-800">Top-3 League Clubs:</strong> Members × 17 seats.</li>
                <li><strong className="text-slate-800">Championship Contenders:</strong> Members × 18 or 20 seats.</li>
              </ul>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <span className="font-bold text-slate-800">Construction & Maintenance Costs:</span>
              <p className="mt-1">
                Expanding involves fixed up-front fees, while unsold seats burn weekly wages:
              </p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-[10px]">
                <div className="bg-slate-50 border p-2 rounded">
                  <span className="font-bold block text-slate-800">Build Costs (per seat)</span>
                  Terracing: £25 • Grass: £50<br />Seats: £100 • Boxes: £1000
                </div>
                <div className="bg-slate-50 border p-2 rounded">
                  <span className="font-bold block text-slate-800">Maintenance (weekly)</span>
                  Terracing: £0.10 • Grass: £0.20<br />Seats: £0.50 • Boxes: £10.00
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
            <Coins className="w-5 h-5 text-emerald-600" />
            4. Financial & Staff Optimization Rules
          </h4>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Rule Explanations */}
            <div className="flex flex-col gap-4 text-xs text-slate-600 leading-relaxed">
              <div>
                <strong className="text-slate-800 block mb-1 text-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  Financial Advisors Rule (BTHF Standard)
                </strong>
                <span className="block pl-3 text-[11px] text-slate-500">
                  Each Financial Advisor adds a flat <strong className="text-slate-800">0.05%</strong> interest rate per week to your bank balance (capped at £10,000,000 reserves).
                </span>
                <span className="block mt-2 pl-3 p-2 rounded bg-slate-50 border-l-2 border-indigo-500">
                  Since each FA costs <strong className="text-slate-800">£1,250/week</strong> in wages, FAs are only profitable when your reserves exceed <strong className="text-indigo-700 font-bold">£2,500,000</strong>. Because the break-even is linear, the strategy is binary: hold <strong className="text-indigo-700">0 FAs</strong> if cash is under £2.5M, and immediately hire all <strong className="text-indigo-700">10 FAs (max)</strong> once you cross £2.5M.
                </span>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <strong className="text-slate-800 block mb-1 text-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>
                  PR Officers Staff Rule (BTHF Standard)
                </strong>
                <span className="block pl-3 text-[11px] text-slate-500">
                  PR Officers sustain fan morale, which boosts sponsors' weekly payments and ticket sales.
                </span>
                <span className="block mt-1 pl-3">
                  The optimal count is <strong className="text-slate-800">1 PR Officer per 250 club members</strong> (rounded up, max 10). Hiring more than 1 per 250 members wastes wage overhead, while having less loses massive sponsor and gates revenues.
                </span>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <strong className="text-slate-800 block mb-1 text-sm flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                  Wage Efficiency Rule
                </strong>
                <span className="block pl-3">
                  Your total player wages should not exceed <strong className="text-indigo-700 font-bold">60%</strong> of total weekly revenue (Sponsors + Gates). Exceeding this threshold makes the club financially unsustainable.
                </span>
              </div>
            </div>

            {/* Column 2: Interactive Calculator Widget */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-slate-200/50 pb-2 mb-1">
                <h5 className="font-display font-bold text-xs text-slate-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-indigo-600" />
                  BTHF Staff Optimizer Calculator
                </h5>
                <span className="text-[10px] bg-indigo-100 border border-indigo-200 text-indigo-700 font-mono font-bold px-1.5 py-0.5 rounded">
                  BTHF Aligned
                </span>
              </div>

              {/* Members Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">Club Members:</span>
                  <span className="font-mono text-indigo-700">{calcMembers.toLocaleString()} members</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3000"
                  step="25"
                  value={calcMembers}
                  onChange={(e) => setCalcMembers(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 h-1 bg-slate-200 rounded cursor-pointer"
                />
              </div>

              {/* Cash Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-600">Cash reserves:</span>
                  <span className="font-mono text-indigo-700">£{calcCash.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="12000000"
                  step="100000"
                  value={calcCash}
                  onChange={(e) => setCalcCash(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-600 h-1 bg-slate-200 rounded cursor-pointer"
                />
              </div>

              {/* Calculation output panel */}
              <div className="grid grid-cols-2 gap-3 mt-1">
                {/* PR Card */}
                <div className="bg-white border border-slate-200/60 rounded-lg p-2.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block mb-0.5">Optimal PR Officers</span>
                    {(() => {
                      const pr = Math.min(10, Math.max(1, Math.ceil(calcMembers / 250)));
                      const rangeText = pr >= 10 ? '2,251+ members' : `${((pr - 1) * 250 + 1).toLocaleString()} – ${(pr * 250).toLocaleString()}`;
                      return (
                        <>
                          <span className="font-mono text-base font-extrabold text-indigo-950 block">{pr} PRs</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Range: {rangeText}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* FA Card */}
                <div className="bg-white border border-slate-200/60 rounded-lg p-2.5 flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block mb-0.5">Optimal FAs</span>
                    {(() => {
                      const fa = calcCash >= 2500000 ? 10 : 0;
                      const outcomeText = calcCash >= 2500000 ? 'Profitable (10 FAs)' : 'Not Profitable (0 FAs)';
                      return (
                        <>
                          <span className="font-mono text-base font-extrabold text-indigo-950 block">{fa} FAs</span>
                          <span className={`text-[9px] font-medium block mt-0.5 ${calcCash >= 2500000 ? 'text-emerald-600' : 'text-amber-600'}`}>{outcomeText}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Weekly Interest Simulation details */}
              <div className="bg-indigo-950 text-white rounded-lg p-3 text-[11px] font-mono flex flex-col gap-1.5 shadow-sm">
                {(() => {
                  const fa = calcCash >= 2500000 ? 10 : 0;
                  const interestRate = 0.05 + 0.05 * fa;
                  const capCash = Math.min(10000000, calcCash);
                  const weeklyInterest = Math.floor(capCash * (interestRate / 100));
                  const faWages = fa * 1250;
                  const netGain = weeklyInterest - faWages;
                  return (
                    <>
                      <div className="flex justify-between border-b border-indigo-900 pb-1">
                        <span className="text-indigo-200">Weekly Interest Rate:</span>
                        <span className="font-bold">{interestRate.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-200">Interest Generated:</span>
                        <span className="font-bold">£{weeklyInterest.toLocaleString()}/wk</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-indigo-200">FA Wage Overhead:</span>
                        <span className="font-bold text-rose-300">−£{faWages.toLocaleString()}/wk</span>
                      </div>
                      <div className="flex justify-between border-t border-indigo-900 pt-1 text-xs">
                        <span className="text-indigo-100 font-bold">Net weekly FA Outcome:</span>
                        <span className={`font-extrabold ${netGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {netGain >= 0 ? '+' : ''}£{netGain.toLocaleString()} / wk
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Skill & Fitness Hierarchies together */}
      <div className="md:col-span-12 lg:col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skill Hierarchy Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              5a. Battrick Skill Hierarchy (Levels 1 to 20)
            </h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Skill levels represent numerical thresholds from worthless (1) up to elite (20). Lower levels pop significantly faster.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[10px]">
              {skills.map((sk, index) => (
                <div key={sk} className="flex items-center gap-1.5 bg-slate-50 border p-1.5 rounded">
                  <span className="font-bold text-indigo-600 w-4">{index + 1}</span>
                  <span className="text-slate-700 capitalize">{sk}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-[11px] text-indigo-800 leading-relaxed">
            💡 <strong>Skill Cap:</strong> The higher a player's skill level, the more nets and weeks required to see a "pop". Maintain a balanced training regimen across key positions.
          </div>
        </div>

        {/* Fitness Hierarchy Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <HeartPulse className="w-5 h-5 text-sky-600 animate-pulse" />
              5b. Battrick Fitness Hierarchy
            </h4>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Fitness is the ultimate governor of active player contribution. A tired squad suffers immense skill penalties on matchday. The list below represents Battrick's official fitness tiers (0 to 10) alongside their diagnostic <strong>Match Performance Multiplier</strong>:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[11px]">
              {[
                { lvl: 10, label: 'Sublime', mult: '1.20x', tier: 'Excellent', color: 'bg-indigo-50/50 text-indigo-950 border-indigo-200' },
                { lvl: 9, label: 'Energetic', mult: '1.15x', tier: 'Excellent', color: 'bg-indigo-50/50 text-indigo-950 border-indigo-200' },
                { lvl: 8, label: 'Invigorated', mult: '1.10x', tier: 'Excellent', color: 'bg-indigo-50/50 text-indigo-950 border-indigo-150' },
                { lvl: 7, label: 'Lively', mult: '1.05x', tier: 'Healthy', color: 'bg-slate-50 text-slate-800 border-slate-200' },
                { lvl: 6, label: 'Fit', mult: '1.00x', tier: 'Healthy', color: 'bg-slate-50 text-slate-800 border-slate-200' },
                { lvl: 5, label: 'Stable', mult: '0.95x', tier: 'Standard', color: 'bg-slate-50 text-slate-700 border-slate-200' },
                { lvl: 4, label: 'Aching', mult: '0.90x', tier: 'Fatigued', color: 'bg-amber-50 text-amber-900 border-amber-200' },
                { lvl: 3, label: 'Stiff', mult: '0.85x', tier: 'Fatigued', color: 'bg-amber-50 text-amber-900 border-amber-200' },
                { lvl: 2, label: 'Fatigued', mult: '0.80x', tier: 'Critical', color: 'bg-rose-50 text-rose-900 border-rose-200' },
                { lvl: 1, label: 'Exhausted', mult: '0.75x', tier: 'Critical', color: 'bg-rose-50 text-rose-900 border-rose-200' },
                { lvl: 0, label: 'Dying', mult: '0.70x', tier: 'Critical', color: 'bg-rose-100 text-rose-950 border-rose-300' },
              ].map((item) => (
                <div key={item.lvl} className={`flex items-center justify-between border px-3 py-2 rounded-lg ${item.color}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 min-w-[20px] text-center text-slate-700">
                      {item.lvl}
                    </span>
                    <span className="font-semibold capitalize truncate max-w-[120px]">{item.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900">{item.mult}</span>
                    <span className="block text-[8px] opacity-70 leading-none text-slate-500 font-bold">{item.tier}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 bg-sky-50 border border-sky-100 rounded-lg p-3 text-[11px] text-sky-800 leading-relaxed">
            💡 <strong>Training Tip:</strong> Assigning <strong>Stamina Nets</strong> increases a player's Stamina level, which directly increases their fitness recovery rate. Fitness levels naturally fluctuate week-by-week based on match playtime.
          </div>
        </div>
      </div>
    </div>
  );
}
