import React, { useState, useEffect } from 'react';
import { BattrickPlayer, SKILL_LEVELS, STAMINA_LEVELS, getSkillLabel } from '../types';
import { 
  getPlayerWeightedScore, 
  getTradeAction, 
  estimateWeeksToNextLevel 
} from '../parser';
import { 
  Search, Coins, User, TrendingUp, 
  Shield, Award, Activity, Info, History, Plus, ChevronRight, Calendar, Sparkles,
  ArrowLeft, Cpu, Sliders, BarChart2, BookOpen
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip 
} from 'recharts';
import { generateRealisticHistory, getWeeklyChanges } from '../utils/history';

interface PlayerDetailsProps {
  playerId: string | null;
  onBack: () => void;
}

export default function PlayerDetails({ playerId, onBack }: PlayerDetailsProps) {
  const [player, setPlayer] = useState<BattrickPlayer | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'skills' | 'history'>('skills');
  const [isWicketKeeper, setIsWicketKeeper] = useState<boolean>(false);

  // Training planner states
  const [plannerNets, setPlannerNets] = useState<{ batting: number; bowling: number; keeping: number; stamina: number; fielding: number }>({
    batting: 0,
    bowling: 0,
    keeping: 0,
    stamina: 0,
    fielding: 0,
  });
  const [coachLevel, setCoachLevel] = useState<number>(9); // 9 = Superb Coach by default
  const [squadTrainingStamina, setSquadTrainingStamina] = useState<boolean>(() => {
    return localStorage.getItem('bt_squad_training_stamina') === 'true';
  });
  const [squadTrainingFielding, setSquadTrainingFielding] = useState<boolean>(() => {
    return localStorage.getItem('bt_squad_training_fielding') === 'true';
  });

  const handleToggleSquadStamina = (enabled: boolean) => {
    setSquadTrainingStamina(enabled);
    localStorage.setItem('bt_squad_training_stamina', String(enabled));
    window.dispatchEvent(new Event('storage'));
  };

  const handleToggleSquadFielding = (enabled: boolean) => {
    setSquadTrainingFielding(enabled);
    localStorage.setItem('bt_squad_training_fielding', String(enabled));
    window.dispatchEvent(new Event('storage'));
  };

  useEffect(() => {
    if (!playerId) return;

    const loadPlayer = () => {
      const savedSquad = localStorage.getItem('bt_squad');
      if (savedSquad) {
        try {
          const parsed: BattrickPlayer[] = JSON.parse(savedSquad);
          const found = parsed.find(p => p.id === playerId);
          if (found) {
            // Generate history if none exists
            if (!found.history || found.history.length === 0) {
              found.history = generateRealisticHistory(found);
            }
            
            // Check if player is the designated keeper of the squad
            const keepers = [...parsed].sort((a, b) => {
              if (b.skills.keeping !== a.skills.keeping) return b.skills.keeping - a.skills.keeping;
              return b.skills.batting - a.skills.batting;
            });
            const designatedKeeper = keepers[0];
            setIsWicketKeeper(designatedKeeper && designatedKeeper.id === found.id);

            setPlayer(found);
            setPlannerNets({
              batting: found.nets?.batting || 0,
              bowling: found.nets?.bowling || 0,
              keeping: found.nets?.keeping || 0,
              stamina: found.nets?.stamina || 0,
              fielding: found.nets?.fielding || 0,
            });
          }
        } catch (e) {
          console.error('Error loading player details:', e);
        }
      }

      setSquadTrainingStamina(localStorage.getItem('bt_squad_training_stamina') === 'true');
      setSquadTrainingFielding(localStorage.getItem('bt_squad_training_fielding') === 'true');
    };

    loadPlayer();
    window.addEventListener('storage', loadPlayer);
    return () => {
      window.removeEventListener('storage', loadPlayer);
    };
  }, [playerId]);

  if (!player) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3">
        <User className="w-12 h-12 text-slate-300 animate-pulse" />
        <h3 className="font-display font-bold text-slate-800 text-lg">Player Profile Not Found</h3>
        <p className="text-slate-500 text-xs max-w-sm">
          This player may have been released, traded, or is not synced properly to the club roster.
        </p>
        <button
          onClick={onBack}
          className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
        >
          Return to Squad
        </button>
      </div>
    );
  }

  // Update localStorage and notify
  const updatePlayerAndSave = (updatedPlayer: BattrickPlayer) => {
    const savedSquad = localStorage.getItem('bt_squad');
    if (savedSquad) {
      try {
        const parsed: BattrickPlayer[] = JSON.parse(savedSquad);
        const updatedSquad = parsed.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
        localStorage.setItem('bt_squad', JSON.stringify(updatedSquad));
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('bt_cloud_backup_request'));
        setPlayer(updatedPlayer);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleUpdatePlayerNets = (key: keyof typeof plannerNets, count: number) => {
    const updatedNets = {
      ...plannerNets,
      [key]: count
    };
    setPlannerNets(updatedNets);
    const updatedPlayer: BattrickPlayer = {
      ...player,
      nets: updatedNets
    };
    updatePlayerAndSave(updatedPlayer);
  };

  const handleSimulateWeeklyPop = () => {
    if (!player.history || player.history.length === 0) return;
    const lastEntry = player.history[player.history.length - 1];
    
    // Auto-increment week
    let nextWeek = (lastEntry.week % 16) + 1;
    let nextSeason = lastEntry.season;
    if (nextWeek === 1) {
      nextSeason += 1;
    }
    
    const netsKeys = ['batting', 'bowling', 'keeping', 'stamina', 'fielding'] as const;
    const activeCandidates: ('batting' | 'bowling' | 'keeping' | 'stamina' | 'fielding')[] = [];
    
    netsKeys.forEach(k => {
      if (plannerNets[k] > 0) activeCandidates.push(k);
    });
    if (squadTrainingStamina && !activeCandidates.includes('stamina')) {
      activeCandidates.push('stamina');
    }
    if (squadTrainingFielding && !activeCandidates.includes('fielding')) {
      activeCandidates.push('fielding');
    }
    
    const chosenSkillKey = activeCandidates.length > 0 
      ? activeCandidates[Math.floor(Math.random() * activeCandidates.length)] 
      : 'batting';
      
    const updatedSkills = { ...player.skills };
    const oldLevel = updatedSkills[chosenSkillKey as keyof typeof updatedSkills] || 0;
    const maxLevel = chosenSkillKey === 'stamina' ? 11 : 20;
    const newLevel = Math.min(maxLevel, oldLevel + 1);
    updatedSkills[chosenSkillKey as keyof typeof updatedSkills] = newLevel;
    
    const isSquadPop = (chosenSkillKey === 'stamina' && squadTrainingStamina && plannerNets.stamina === 0) ||
                       (chosenSkillKey === 'fielding' && squadTrainingFielding && plannerNets.fielding === 0);
    const btrGain = Math.round(1200 + Math.random() * 800 + (plannerNets[chosenSkillKey] || (isSquadPop ? 1 : 0)) * 400);
    const nextBtr = player.btRating + btrGain;
    
    let nextWage = player.wage;
    if (nextWeek === 1) {
      const isYoung = player.age <= 21;
      nextWage = Math.round((player.wage * (isYoung ? 1.15 : 1.05)) / 100) * 100;
    }
    
    const note = `Training Pop: ${chosenSkillKey.toUpperCase()} popped ${getSkillLabel(chosenSkillKey, oldLevel)} -> ${getSkillLabel(chosenSkillKey, newLevel)}${isSquadPop ? ' (Squad Training)' : ''}`;
    
    const newHistoryEntry = {
      season: nextSeason,
      week: nextWeek,
      btRating: nextBtr,
      wage: nextWage,
      form: player.form,
      fitness: player.fitness,
      skills: updatedSkills,
      note
    };
    
    const updatedPlayer: BattrickPlayer = {
      ...player,
      btRating: nextBtr,
      wage: nextWage,
      skills: updatedSkills,
      history: [...player.history, newHistoryEntry]
    };
    
    updatePlayerAndSave(updatedPlayer);
  };

  const handleLogWeeklySnapshot = () => {
    if (!player.history || player.history.length === 0) return;
    const lastEntry = player.history[player.history.length - 1];
    
    let nextWeek = (lastEntry.week % 16) + 1;
    let nextSeason = lastEntry.season;
    if (nextWeek === 1) {
      nextSeason += 1;
    }
    
    const btrGain = Math.round(150 + Math.random() * 250);
    const nextBtr = player.btRating + btrGain;
    
    let nextWage = player.wage;
    if (nextWeek === 1) {
      const isYoung = player.age <= 21;
      nextWage = Math.round((player.wage * (isYoung ? 1.15 : 1.05)) / 100) * 100;
    }
    
    const newHistoryEntry = {
      season: nextSeason,
      week: nextWeek,
      btRating: nextBtr,
      wage: nextWage,
      form: player.form,
      fitness: player.fitness,
      skills: { ...player.skills },
      note: 'Weekly snapshot'
    };
    
    const updatedPlayer: BattrickPlayer = {
      ...player,
      btRating: nextBtr,
      wage: nextWage,
      history: [...player.history, newHistoryEntry]
    };
    
    updatePlayerAndSave(updatedPlayer);
  };

  const pScore = getPlayerWeightedScore(player);
  const trade = getTradeAction(player);
  const changes = getWeeklyChanges(player);

  const actionColors = {
    HOLD: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    DEVELOP: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    TRADE: 'bg-rose-50 text-rose-800 border-rose-200',
    PEAK: 'bg-amber-50 text-amber-800 border-amber-200'
  };

  return (
    <div className="flex flex-col gap-6" id="player-details-container">
      {/* Header Breadcrumbs navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold font-sans transition flex items-center gap-1.5 shadow-sm cursor-pointer hover:border-slate-300"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            Back to Squad
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div>
            <h2 className="text-xl font-display font-extrabold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              <User className="w-5 h-5 text-blue-600" />
              {player.name}
              {isWicketKeeper && (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-250 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-sm">
                  🧤 Designated Keeper
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Player Details, training logs, pop milestones & performance diagnostics
            </p>
          </div>
        </div>
        
        {/* Quick Highlights */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg font-mono shadow-sm">
            Age: {player.age} yrs
          </span>
          <span className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-700 text-[11px] font-bold rounded-lg font-mono shadow-sm">
            Rating: {player.btRating.toLocaleString()} BTR
          </span>
          <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-bold rounded-lg font-mono shadow-sm">
            IQ Index: {pScore}
          </span>
        </div>
      </div>

      {/* Main layout card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6 animate-fadeIn">
        
        {/* Weekly Progression Banner */}
        {(() => {
          if (!changes) return null;
          const hasChanges = changes.btRatingDiff !== 0 || changes.formDiff !== 0 || changes.fitnessDiff !== 0 || changes.skillPops.length > 0;
          if (!hasChanges) {
            return (
              <div className="bg-slate-50/50 text-slate-500 border border-slate-250/30 p-4 rounded-xl text-xs flex items-center gap-2">
                <Info className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                <span>No changes detected this week. Player skills, form, and fitness are stable compared to last week.</span>
              </div>
            );
          }

          return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-200/50 pb-2">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="inline-flex h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                  Weekly Progression Snapshot
                </span>
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100/30">
                  Season {player.history?.[player.history.length - 1]?.season || 65} Wk {player.history?.[player.history.length - 1]?.week || 10}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white p-2.5 rounded-lg border border-slate-150 flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">BT Rating</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xs font-bold text-slate-700">{player.btRating.toLocaleString()}</span>
                    {changes.btRatingDiff !== 0 && (
                      <span className={`text-[10px] font-bold ${changes.btRatingDiff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {changes.btRatingDiff > 0 ? '▲ +' : '▼ '}{changes.btRatingDiff.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-150 flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Wage /wk</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xs font-bold text-slate-700">£{player.wage.toLocaleString()}</span>
                    {changes.wageDiff !== 0 && (
                      <span className={`text-[10px] font-bold ${changes.wageDiff > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {changes.wageDiff > 0 ? '▲ +' : '▼ '}{changes.wageDiff.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-150 flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Current Form</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xs font-bold text-slate-700">{player.form}/10</span>
                    {changes.formDiff !== 0 && (
                      <span className={`text-[10px] font-bold ${changes.formDiff > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {changes.formDiff > 0 ? '▲ +' : '▼ '}{changes.formDiff}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-slate-150 flex flex-col gap-0.5 shadow-sm">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Fitness Level</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-xs font-bold text-slate-700">{player.fitness}/10</span>
                    {changes.fitnessDiff !== 0 && (
                      <span className={`text-[10px] font-bold ${changes.fitnessDiff > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {changes.fitnessDiff > 0 ? '▲ +' : '▼ '}{changes.fitnessDiff}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Skill Pops detail */}
              {changes.skillPops.length > 0 && (
                <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-lg flex flex-col gap-1.5 shadow-sm">
                  <span className="text-[9px] text-emerald-800 font-bold uppercase tracking-wider">🚀 Training pops triggered this week</span>
                  <div className="flex flex-col gap-1">
                    {changes.skillPops.map((pop, i) => (
                      <div key={i} className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                        <span className="text-emerald-600 font-bold">▲</span>
                        <span className="font-semibold">{pop.skill}:</span>
                        <span className="font-mono text-slate-450 line-through text-[10px]">{getSkillLabel(pop.skill, pop.from)}</span>
                        <span className="text-slate-400 font-bold">→</span>
                        <span className="font-mono text-emerald-700 font-bold">{getSkillLabel(pop.skill, pop.to)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 pb-px gap-2">
          <button
            onClick={() => setInspectorTab('skills')}
            className={`px-5 py-2.5 text-xs font-bold border-b-2 -mb-px transition duration-150 flex items-center gap-1.5 cursor-pointer ${
              inspectorTab === 'skills'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Skills & Market Advisor
          </button>
          <button
            onClick={() => setInspectorTab('history')}
            className={`px-5 py-2.5 text-xs font-bold border-b-2 -mb-px transition duration-150 flex items-center gap-1.5 cursor-pointer ${
              inspectorTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <History className="w-4 h-4" />
            Weekly Progress Report
          </button>
        </div>

        {/* Content Pane */}
        {inspectorTab === 'skills' ? (
          <div className="flex flex-col gap-6">
            {/* Career Advisor hold/develop/trade advice */}
            <div className={`p-4 rounded-xl border ${actionColors[trade.action as keyof typeof actionColors]} shadow-sm flex gap-3 text-xs`}>
              <Cpu className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase block mb-1">Career Strategy Advisor Decision: {trade.action}</span>
                <span className="leading-relaxed block">{trade.reason}</span>
              </div>
            </div>

            {/* Core Skills Summary Grid */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider block">Detailed Skills Matrix</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 bg-slate-50/50 p-4.5 rounded-xl border border-slate-100">
                {[
                  { name: 'Stamina', key: 'stamina' as const, val: player.skills.stamina, hasNet: (player.nets?.stamina || 0) > 0 },
                  { name: 'Wicket Keeping', key: 'keeping' as const, val: player.skills.keeping, hasNet: (player.nets?.keeping || 0) > 0 },
                  { name: 'Batting', key: 'batting' as const, val: player.skills.batting, hasNet: (player.nets?.batting || 0) > 0 },
                  { name: 'Concentration', key: 'concentration' as const, val: player.skills.concentration, hasNet: false },
                  { name: 'Bowling', key: 'bowling' as const, val: player.skills.bowling, hasNet: (player.nets?.bowling || 0) > 0, sub: player.bowlingType !== 'None' ? player.bowlingType : null },
                  { name: 'Consistency', key: 'consistency' as const, val: player.skills.consistency, hasNet: false },
                  { name: 'Fielding', key: 'fielding' as const, val: player.skills.fielding || 0, hasNet: (player.nets?.fielding || 0) > 0 },
                  { name: 'Leadership', key: 'leadership' as const, val: player.skills.leadership, hasNet: false },
                  { name: 'Experience', key: 'experience' as const, val: player.skills.experience, hasNet: false },
                ].map(sk => {
                  const levelStr = getSkillLabel(sk.key, sk.val);
                  const displayedLevel = sk.hasNet ? `${levelStr}*` : levelStr;
                  const pop = changes?.skillPops.find(p => p.skill === sk.name);
                  const isUp = pop && pop.to > pop.from;
                  const isDown = pop && pop.to < pop.from;
                  
                  return (
                    <div key={sk.name} className={`flex flex-col gap-0.5 border-b border-slate-150 pb-2 transition-colors duration-150 ${pop ? (isUp ? 'bg-emerald-100/70 border border-emerald-300 rounded p-1.5 -mx-1.5 my-0.5 shadow-sm' : 'bg-rose-100/70 border border-rose-300 rounded p-1.5 -mx-1.5 my-0.5 shadow-sm') : ''}`}>
                      <span className={`text-[10px] font-bold uppercase truncate ${
                        isUp ? 'text-emerald-600 font-extrabold' : isDown ? 'text-rose-600 font-extrabold' : 'text-slate-400'
                      }`}>
                        {sk.name}{pop ? (isUp ? ' ▲' : ' ▼') : ''}:
                      </span>
                      <span className={`text-xs font-semibold ${
                        isUp ? 'text-emerald-700 font-bold' : isDown ? 'text-rose-700 font-bold' : sk.hasNet ? 'text-blue-600 font-bold' : 'text-slate-800'
                      }`}>
                        {displayedLevel} {pop && `(${getSkillLabel(sk.key, pop.from)} → ${getSkillLabel(sk.key, pop.to)})`}
                      </span>
                      {sk.sub && (
                        <span className="text-[9px] text-blue-600 font-mono font-medium">{sk.sub}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sub-simulation controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Interactive coaching nets editor */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-display font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Interactive Coaching Nets Simulator
                  </h5>
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                    Max 4 Nets Total
                  </span>
                </div>

                {/* Coach Selection */}
                <div className="flex items-center justify-between gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                  <span className="text-slate-600 font-bold">Squad Coach Quality:</span>
                  <select
                    value={coachLevel}
                    onChange={(e) => setCoachLevel(parseInt(e.target.value))}
                    className="bg-slate-50 border border-slate-250 rounded px-2.5 py-1 font-mono text-xs text-slate-700 outline-none"
                  >
                    <option value={5}>competent (5)</option>
                    <option value={6}>respectable (6)</option>
                    <option value={7}>proficient (7)</option>
                    <option value={8}>strong (8)</option>
                    <option value={9}>superb (9) *standard</option>
                    <option value={10}>quality (10)</option>
                    <option value={11}>remarkable (11)</option>
                  </select>
                </div>

                {/* Squad Training Toggles */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm flex flex-col gap-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Squad-Wide Training Flags</span>
                    <span className="text-[10px] font-normal text-slate-400">Affects entire squad</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSquadStamina(!squadTrainingStamina)}
                      className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold flex flex-col items-start border transition cursor-pointer text-left ${
                        squadTrainingStamina 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-400/30' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>⚡ Squad Stamina</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${squadTrainingStamina ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'}`}>
                          {squadTrainingStamina ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <span className="text-[9px] opacity-75 mt-0.5 font-normal">Flat 6 wks (Age 17-32)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSquadFielding(!squadTrainingFielding)}
                      className={`px-2.5 py-2 rounded-lg text-[11px] font-semibold flex flex-col items-start border transition cursor-pointer text-left ${
                        squadTrainingFielding 
                          ? 'bg-blue-50 border-blue-300 text-blue-800 ring-1 ring-blue-400/30' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>🧤 Squad Fielding</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${squadTrainingFielding ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-600'}`}>
                          {squadTrainingFielding ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <span className="text-[9px] opacity-75 mt-0.5 font-normal">5 to 6 wks per pop</span>
                    </button>
                  </div>
                </div>

                {/* Nets list */}
                <div className="flex flex-col gap-2">
                  {[
                    { label: 'Batting Nets', key: 'batting' as const, level: player.skills.batting },
                    { label: 'Bowling Nets', key: 'bowling' as const, level: player.skills.bowling },
                    { label: 'Keeping Nets', key: 'keeping' as const, level: player.skills.keeping },
                    { label: 'Stamina Nets', key: 'stamina' as const, level: player.skills.stamina },
                    { label: 'Fielding Nets', key: 'fielding' as const, level: player.skills.fielding || 0 },
                  ].map((n) => {
                    const count = plannerNets[n.key];
                    const totalNets = plannerNets.batting + plannerNets.bowling + plannerNets.keeping + plannerNets.stamina + plannerNets.fielding;
                    
                    return (
                      <div key={n.key} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-xl border border-slate-150 text-xs shadow-sm">
                        <div>
                          <span className="font-bold text-slate-700">{n.label}</span>
                          {n.level > 0 && (
                            <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
                              Current Level: <span className="font-semibold text-slate-500 capitalize">{getSkillLabel(n.key, n.level)}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdatePlayerNets(n.key, Math.max(0, count - 1))}
                            disabled={count === 0}
                            className="w-6 h-6 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold transition disabled:opacity-40"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-slate-800 text-sm">{count}</span>
                          <button
                            onClick={() => {
                              if (totalNets < 3) {
                                handleUpdatePlayerNets(n.key, count + 1);
                              }
                            }}
                            disabled={totalNets >= 3 || count >= 3}
                            className="w-6 h-6 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-bold transition disabled:opacity-40"
                            title={count >= 3 ? "Diminishing returns max out at 3 nets" : "Maximum 3 nets per player"}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Net training pop speed results */}
                <div className="bg-blue-50/40 p-3 rounded-xl border border-blue-100/50 flex flex-col gap-1.5 text-xs text-blue-950">
                  <div className="flex justify-between font-bold text-blue-900 border-b border-blue-100/30 pb-1.5">
                    <span>Simulated Pop Speeds</span>
                    <span className="font-mono">Cost: £{((plannerNets.batting + plannerNets.bowling + plannerNets.keeping + plannerNets.stamina + plannerNets.fielding) * 1250).toLocaleString()}/wk</span>
                  </div>

                  {(() => {
                    const estimates: { label: string; weeks: number; note?: string }[] = [];
                    if (plannerNets.batting > 0) {
                      estimates.push({ label: 'Batting', weeks: estimateWeeksToNextLevel(player.skills.batting, player.age, plannerNets.batting, coachLevel, 'batting') });
                    }
                    if (plannerNets.bowling > 0) {
                      estimates.push({ label: 'Bowling', weeks: estimateWeeksToNextLevel(player.skills.bowling, player.age, plannerNets.bowling, coachLevel, 'bowling') });
                    }
                    if (plannerNets.keeping > 0) {
                      estimates.push({ label: 'Keeping', weeks: estimateWeeksToNextLevel(player.skills.keeping, player.age, plannerNets.keeping, coachLevel, 'keeping') });
                    }
                    if (plannerNets.stamina > 0 || squadTrainingStamina) {
                      const w = estimateWeeksToNextLevel(player.skills.stamina, player.age, plannerNets.stamina, coachLevel, 'stamina', squadTrainingStamina);
                      const isIndividualFlatRange = !squadTrainingStamina && player.age >= 17 && player.age <= 32;
                      estimates.push({ 
                        label: plannerNets.stamina > 0 ? 'Stamina' : 'Stamina (Squad Training)', 
                        weeks: w,
                        note: squadTrainingStamina ? 'Flat 5-6 wks (All Ages)' : (isIndividualFlatRange ? 'Flat 6.0 wks (Age 17-32)' : undefined)
                      });
                    }
                    if (plannerNets.fielding > 0 || squadTrainingFielding) {
                      const w = estimateWeeksToNextLevel(player.skills.fielding || 0, player.age, plannerNets.fielding, coachLevel, 'fielding', squadTrainingFielding);
                      estimates.push({ 
                        label: plannerNets.fielding > 0 ? 'Fielding' : 'Fielding (Squad Training)', 
                        weeks: w,
                        note: squadTrainingFielding ? 'Flat 5-6 wks (All Ages)' : '5 to 6 wks per pop'
                      });
                    }

                    if (estimates.length === 0) {
                      return <span className="text-slate-500 italic text-[11px] py-1">No nets or squad training active. Assign nets or toggle squad training.</span>;
                    }

                    return (
                      <div className="flex flex-col gap-1 font-semibold text-slate-700">
                        {estimates.map((est) => (
                          <div key={est.label} className="flex justify-between items-center bg-white/70 px-2 py-1.5 rounded-lg border border-slate-100">
                            <span className="text-slate-650 font-semibold flex items-center gap-1">
                              {est.label}:
                              {est.note && <span className="text-[10px] text-slate-400 font-normal">({est.note})</span>}
                            </span>
                            <span className="font-mono text-blue-700 font-bold">{est.weeks} weeks</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Training projection predictions & outlooks */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col gap-4">
                <h5 className="font-display font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Net Forecast Prediction
                </h5>

                {(() => {
                  const lastHistory = player.history && player.history.length > 0 
                    ? player.history[player.history.length - 1] 
                    : { season: 65, week: 10 };
                  const currentSeason = lastHistory.season || 65;
                  const currentWeek = lastHistory.week || 10;

                  function addWeeks(s: number, w: number, add: number): { season: number, week: number } {
                    const roundedAdd = Math.round(add);
                    let totalWeeks = (s - 1) * 16 + (w - 1) + roundedAdd;
                    const newS = Math.floor(totalWeeks / 16) + 1;
                    const newW = (totalWeeks % 16) + 1;
                    return { season: newS, week: newW };
                  }

                  const rawEfficiency = 100 / Math.pow(1.22, player.age - 17);
                  const efficiency = Math.min(100, Math.max(2, Math.round(rawEfficiency)));

                  let efficiencyText = '';
                  let efficiencyColor = '';
                  if (player.age <= 19) {
                    efficiencyText = '⚡ Elite Speed: Young age guarantees rapid progression. Ideal for development!';
                    efficiencyColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                  } else if (player.age <= 22) {
                    efficiencyText = '🏃 Good Speed: Moderate standard progression. Keep focused on primary skills.';
                    efficiencyColor = 'text-blue-700 bg-blue-50 border-blue-100';
                  } else if (player.age <= 26) {
                    efficiencyText = '🐢 Slow Speed: Mature age limits training velocity. High intensity (multiple nets) required.';
                    efficiencyColor = 'text-amber-700 bg-amber-50 border-amber-100';
                  } else {
                    efficiencyText = '⛔ Extremely Inefficient: Training is very slow. Nets are only recommended to keep fitness/stamina high.';
                    efficiencyColor = 'text-rose-700 bg-rose-50 border-rose-100';
                  }

                  const forecasts: {
                    skillName: string;
                    currentLevel: number;
                    targetLevel: number;
                    weeksNeeded: number;
                    targetSeason: number;
                    targetWeek: number;
                    nets: number;
                  }[] = [];

                  const activeNetsList = [
                    { key: 'batting' as const, label: 'Batting', level: player.skills.batting, isSquad: false },
                    { key: 'bowling' as const, label: 'Bowling', level: player.skills.bowling, isSquad: false },
                    { key: 'keeping' as const, label: 'Wicket Keeping', level: player.skills.keeping, isSquad: false },
                    { key: 'stamina' as const, label: 'Stamina', level: player.skills.stamina, isSquad: squadTrainingStamina },
                    { key: 'fielding' as const, label: 'Fielding', level: player.skills.fielding || 0, isSquad: squadTrainingFielding },
                  ];

                  activeNetsList.forEach((n) => {
                    const count = plannerNets[n.key];
                    const maxLevelForSkill = n.key === 'stamina' ? 11 : 20;
                    const isTrainingActive = count > 0 || (n.isSquad && count === 0);
                    if (isTrainingActive && n.level < maxLevelForSkill) {
                      const weeks = estimateWeeksToNextLevel(n.level, player.age, count, coachLevel, n.key, n.isSquad);
                      if (weeks !== Infinity && weeks > 0) {
                        const target = addWeeks(currentSeason, currentWeek, weeks);
                        forecasts.push({
                          skillName: n.label + (count === 0 && n.isSquad ? ' (Squad)' : ''),
                          currentLevel: n.level,
                          targetLevel: n.level + 1,
                          weeksNeeded: weeks,
                          targetSeason: target.season,
                          targetWeek: target.week,
                          nets: count,
                        });
                      }
                    }
                  });

                  let btrGain = 0;
                  forecasts.forEach(f => {
                    if (f.skillName === 'Batting' || f.skillName === 'Bowling' || f.skillName === 'Wicket Keeping') {
                      btrGain += 1800;
                    } else if (f.skillName === 'Fielding') {
                      btrGain += 600;
                    } else if (f.skillName === 'Stamina') {
                      btrGain += 400;
                    }
                  });
                  const projectedBtr = player.btRating + btrGain;
                  const isYoung = player.age <= 21;
                  const projectedWage = btrGain > 0 
                    ? Math.round((player.wage * (isYoung ? 1.15 : 1.05) + (btrGain * 0.12)) / 50) * 50
                    : player.wage;

                  if (forecasts.length === 0) {
                    return (
                      <div className="flex flex-col gap-4 justify-between h-full py-1">
                        <div className="text-center py-8 px-4 bg-white rounded-xl border border-slate-150 shadow-sm flex flex-col items-center justify-center gap-2">
                          <Calendar className="w-8 h-8 text-slate-300 animate-pulse" />
                          <span className="text-xs font-bold text-slate-700">No Nets Assigned</span>
                          <span className="text-[11px] text-slate-400 leading-normal max-w-[220px]">
                            Assign training nets in the simulator panel to forecast exact pop dates and ratings!
                          </span>
                        </div>

                        <div className={`p-3.5 rounded-xl border text-[10px] leading-relaxed font-medium ${efficiencyColor}`}>
                          <div className="font-bold flex justify-between mb-1 text-slate-800">
                            <span>Training Efficiency Score</span>
                            <span className="font-mono font-extrabold">{efficiency}%</span>
                          </div>
                          <p className="font-normal opacity-90">{efficiencyText}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-3 justify-between h-full">
                      {/* Efficiency Badge */}
                      <div className={`p-3 rounded-xl border text-[10px] leading-normal font-medium ${efficiencyColor} shadow-sm`}>
                        <div className="font-bold flex justify-between items-center mb-1 border-b border-black/5 pb-1">
                          <span>Training Speed Efficiency</span>
                          <span className="font-mono font-extrabold text-[11px] bg-white/70 px-1.5 py-0.5 rounded border border-black/5">{efficiency}%</span>
                        </div>
                        <p className="font-normal opacity-95">{efficiencyText}</p>
                      </div>

                      {/* List of predicted pops */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Projected Pop Milestones</span>
                        <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                          {forecasts.map((f, idx) => (
                            <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-150 shadow-sm flex flex-col gap-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                  {f.skillName}
                                </span>
                                <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100/30">
                                  {f.nets} {f.nets === 1 ? 'Net' : 'Nets'}
                                </span>
                              </div>
                              <div className="flex justify-between items-baseline text-xs">
                                <div className="text-slate-500 font-semibold flex items-center gap-1">
                                  <span>{getSkillLabel(f.skillName, f.currentLevel)}</span>
                                  <span className="text-slate-400 text-[10px]">→</span>
                                  <span className="text-blue-700 font-bold">{getSkillLabel(f.skillName, f.targetLevel)}</span>
                                </div>
                                <div className="font-mono text-[10px] font-bold text-emerald-700">
                                  In {f.weeksNeeded} wks
                                </div>
                              </div>
                              <div className="flex justify-between items-center mt-1 border-t border-slate-50 pt-1 text-[10px] text-slate-400">
                                <span>Expected Arrival:</span>
                                <span className="font-bold text-blue-850 font-mono">Season {f.targetSeason} Wk {f.targetWeek}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Projected BTR / Wages prediction */}
                      <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-sm flex flex-col gap-2">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">End-Of-Training Rating Outlook</span>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col">
                            <span className="text-[10px] text-slate-500 font-medium">Projected BTR</span>
                            <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">{projectedBtr.toLocaleString()}</span>
                            <span className="text-[9px] text-emerald-600 font-bold font-mono">+{btrGain.toLocaleString()}</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex flex-col">
                            <span className="text-[10px] text-slate-500 font-medium">Projected Wage</span>
                            <span className="text-xs font-bold text-slate-800 font-mono mt-0.5">£{projectedWage.toLocaleString()}</span>
                            <span className="text-[9px] text-rose-500 font-bold font-mono">+{Math.max(0, projectedWage - player.wage).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[9px] text-slate-400 italic leading-snug">
                        *Pop predictions assume constant net allocation and superb coach quality. Actual results may slightly vary due to sub-level fractional states.
                      </p>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-fadeIn">
            
            {/* Header info */}
            <div className="bg-slate-50/70 border border-slate-200/50 p-4 rounded-xl text-xs flex items-start gap-3 shadow-sm">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-700 block mb-0.5">Week-by-Week Skill Pop & Rating Auditor</span>
                <p className="text-slate-500 leading-relaxed">
                  Visualize historical training progress, log weekly pop events, and simulate skill advancements. Weekly updates are preserved in your local secure container and automatically synced.
                </p>
              </div>
            </div>

            {/* Simulated progression action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={handleSimulateWeeklyPop}
                className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-150 hover:border-indigo-300 rounded-2xl text-left flex justify-between items-center transition group shadow-sm cursor-pointer"
              >
                <div>
                  <span className="text-xs font-bold text-indigo-950 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                    Simulate Next Training Pop
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[240px]">
                    Increments week and triggers a randomized pop in one of the player's active nets.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 transition transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={handleLogWeeklySnapshot}
                className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-150 hover:border-emerald-300 rounded-2xl text-left flex justify-between items-center transition group shadow-sm cursor-pointer"
              >
                <div>
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    Log Weekly Snapshot
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[240px]">
                    Preserves current player skills as a stable historical baseline and advances week count.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 transition transform group-hover:translate-x-1" />
              </button>
            </div>

            {/* Line chart of historical stats */}
            <div className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-4">
              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-blue-600" />
                Battrick Rating & Salary Growth
              </span>
              
              <div className="h-64 w-full">
                {player.history && player.history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={player.history.map(h => ({
                        label: `S${h.season} W${h.week}`,
                        rating: h.btRating,
                        wage: h.wage,
                      }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} fontClassName="font-mono" tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} fontClassName="font-mono" tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff' }}
                        labelStyle={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '11px' }}
                        itemStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                      />
                      <Area type="monotone" dataKey="rating" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorRating)" name="BT Rating" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 italic text-xs">
                    Insufficient historical snapshots to render growth models.
                  </div>
                )}
              </div>
            </div>

            {/* Table of historic logs */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-wider block">Historical Snapshot Ledger</span>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-450 uppercase font-mono tracking-wider text-[9px]">
                        <th className="py-3 px-4 font-bold">Week</th>
                        <th className="py-3 px-4 font-bold">Battrick Rating</th>
                        <th className="py-3 px-4 font-bold">Weekly Wage</th>
                        <th className="py-3 px-4 font-bold">Audit Parameters</th>
                        <th className="py-3 px-4 font-bold text-right">Event Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {player.history && [...player.history].reverse().map((entry, idx) => {
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 transition">
                            <td className="py-3 px-4 font-mono font-bold text-blue-700">
                              S{entry.season} W{entry.week}
                            </td>
                            <td className="py-3 px-4 font-mono">
                              {entry.btRating.toLocaleString()} BTR
                            </td>
                            <td className="py-3 px-4 font-mono">
                              £{entry.wage.toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div>
                                  F: <span className="font-bold text-slate-700">{entry.form || player.form}/10</span>
                                </div>
                                <div>
                                  Ft: <span className="font-bold text-slate-700">{entry.fitness || player.fitness}/10</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {entry.note ? (
                                  <span className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                    entry.note.includes('Pop') || entry.note.includes('popped')
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200/60'
                                  }`}>
                                    {entry.note}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 italic text-[11px]">-</span>
                                )}
                                
                                {/* Hoverable exact skills list */}
                                <div className="group relative inline-block">
                                  <button className="text-[10px] text-slate-400 hover:text-blue-600 font-bold border border-slate-200 hover:border-blue-300 px-1.5 py-0.5 rounded cursor-help">
                                    Skills
                                  </button>
                                  <div className="invisible group-hover:visible absolute right-0 bottom-6 bg-slate-900 text-white rounded-lg p-3 shadow-lg z-50 w-52 text-left text-[10px] flex flex-col gap-1 border border-slate-800">
                                    <div className="font-bold text-slate-350 border-b border-slate-800 pb-1 mb-1 font-mono">
                                      Skills at S{entry.season} W{entry.week}
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1 gap-x-3 text-slate-250 font-medium">
                                      <div>Stamina: <span className="font-bold text-white capitalize">{getSkillLabel('stamina', entry.skills.stamina)}</span></div>
                                      <div>Batting: <span className="font-bold text-white capitalize">{getSkillLabel('batting', entry.skills.batting)}</span></div>
                                      <div>Bowling: <span className="font-bold text-white capitalize">{getSkillLabel('bowling', entry.skills.bowling)}</span></div>
                                      <div>Fielding: <span className="font-bold text-white capitalize">{getSkillLabel('fielding', entry.skills.fielding)}</span></div>
                                      <div>Conc: <span className="font-bold text-white capitalize">{getSkillLabel('concentration', entry.skills.concentration)}</span></div>
                                      <div>Cons: <span className="font-bold text-white capitalize">{getSkillLabel('consistency', entry.skills.consistency)}</span></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
