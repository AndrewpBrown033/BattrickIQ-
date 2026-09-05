import React, { useState, useEffect } from 'react';
import { BattrickPlayer, ClubFinances, BattrickGame, StadiumConfig, PavilionInfo, getSkillLabel } from '../types';
import { getWeeklyChanges } from '../utils/history';
import { 
  Bot, CheckCircle2, Circle, Sparkles, ArrowRight, 
  Calendar, RefreshCw, Users, Trophy, Landmark, Calculator,
  AlertTriangle, ShieldCheck, Zap, ChevronRight, ChevronDown, ChevronUp, HelpCircle,
  TrendingUp, Star, Award, Clock, Minimize2, Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIAssistantTasksProps {
  squad: BattrickPlayer[];
  finances: ClubFinances | null;
  stadium: StadiumConfig | null;
  fixtures: BattrickGame[];
  pavilion: PavilionInfo | null;
  setActiveTab: (tab: 'summary' | 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'rules' | 'admin') => void;
}

export interface AssistantTask {
  id: string;
  title: string;
  category: 'weekly_cycle' | 'skill_pops' | 'matchday' | 'training' | 'finance' | 'stadium';
  categoryLabel: string;
  badgeColor: string;
  priority: 'high' | 'medium' | 'normal';
  description: string;
  impactReason: string;
  actionLabel: string;
  actionTab: 'summary' | 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'rules' | 'admin';
  secondaryActionLabel?: string;
  secondaryActionTab?: 'summary' | 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'rules' | 'admin';
  coachPrompt?: string;
  highlightData?: string[];
  isCompleted?: boolean;
}

export default function AIAssistantTasks({
  squad,
  finances,
  stadium,
  fixtures,
  pavilion,
  setActiveTab
}: AIAssistantTasksProps) {
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('bt_assistant_minimized');
      if (saved === 'false') return false;
      return true; // Always minimized by default
    } catch {
      return true;
    }
  });

  const toggleMinimize = () => {
    setIsMinimized(prev => {
      const next = !prev;
      try {
        localStorage.setItem('bt_assistant_minimized', String(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bt_assistant_completed_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    try {
      const logsStr = localStorage.getItem('bt_sync_logs');
      if (logsStr) {
        const logs = JSON.parse(logsStr);
        if (Array.isArray(logs) && logs.length > 0 && logs[0].timestamp) {
          setLastSyncTime(logs[0].timestamp);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleTask = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompletedTaskIds(prev => {
      const next = prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId];
      try {
        localStorage.setItem('bt_assistant_completed_tasks', JSON.stringify(next));
      } catch (err) {
        console.error(err);
      }
      return next;
    });
  };

  const handleResetChecklist = () => {
    setCompletedTaskIds([]);
    try {
      localStorage.removeItem('bt_assistant_completed_tasks');
    } catch (e) {
      console.error(e);
    }
  };

  const handleAskCoach = (prompt: string) => {
    localStorage.setItem('bt_coach_initial_query', prompt);
    setActiveTab('coach');
  };

  // Determine current day & 7-day cycle timing
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
  const isSaturday = dayOfWeek === 6;
  const isSunday = dayOfWeek === 0;
  const isWeekendCycle = isSaturday || isSunday;

  // Detect recent player pops across squad history
  const poppedPlayersInfo: {
    playerId: string;
    playerName: string;
    role: string;
    pops: string[];
    btrGain?: number;
  }[] = [];

  squad.forEach(player => {
    // 1. Check getWeeklyChanges
    const changes = getWeeklyChanges(player);
    if (changes && changes.skillPops && changes.skillPops.length > 0) {
      const popDescs = changes.skillPops.map(
        p => `${p.skill} (${getSkillLabel(p.skill, p.from)} → ${getSkillLabel(p.skill, p.to)})`
      );
      poppedPlayersInfo.push({
        playerId: player.id,
        playerName: player.name,
        role: player.role,
        pops: popDescs,
        btrGain: changes.btRatingDiff > 0 ? changes.btRatingDiff : undefined
      });
    } else if (player.history && player.history.length > 0) {
      // Check last history entry for note containing 'Pop' or 'pop'
      const lastEntry = player.history[player.history.length - 1];
      if (lastEntry.note && /pop/i.test(lastEntry.note)) {
        poppedPlayersInfo.push({
          playerId: player.id,
          playerName: player.name,
          role: player.role,
          pops: [lastEntry.note],
          btrGain: undefined
        });
      }
    }
  });

  // Check training nets status
  const playersOnNets = squad.filter(p => 
    p.nets && (p.nets.batting > 0 || p.nets.bowling > 0 || p.nets.keeping > 0 || p.nets.fielding > 0 || p.nets.stamina > 0)
  ).length;

  const totalNetsInSquad = squad.reduce((sum, p) => {
    if (!p.nets) return sum;
    return sum + (p.nets.batting || 0) + (p.nets.bowling || 0) + (p.nets.keeping || 0) + (p.nets.fielding || 0) + (p.nets.stamina || 0);
  }, 0);

  // Financial health status
  const weeklyIncome = finances ? (finances.sponsorsIncome + finances.gateReceipts + finances.interestReceived) : 0;
  const weeklyExpense = finances ? (finances.playerWages + finances.staffWages) : 0;
  const weeklySurplus = weeklyIncome - weeklyExpense;
  const inFinancialDeficit = finances ? (finances.cash < 0 || weeklySurplus < -5000) : false;

  // Stadium adequacy status
  const members = finances?.members || 500;
  const recommendedCapacity = Math.round(members * 17.5);
  const isStadiumUnderbuilt = stadium ? (stadium.capacity < recommendedCapacity * 0.85) : false;

  // Next fixture info
  const nextMatch = fixtures && fixtures.length > 0 ? fixtures[0] : null;

  // Generate dynamic tasks
  const tasks: AssistantTask[] = [];

  // 1. Saturday 7-Day Training & Financials Update Cycle Task
  const daysSinceSync = lastSyncTime ? Math.floor((now.getTime() - new Date(lastSyncTime).getTime()) / (1000 * 60 * 60 * 24)) : 7;
  const needsWeeklySync = isSaturday || isSunday || daysSinceSync >= 5 || !lastSyncTime;

  tasks.push({
    id: 'weekly_saturday_cycle',
    title: isSaturday 
      ? '⚡ Saturday 7-Day Cycle: Sync Training Nets & Finances' 
      : 'Weekly 7-Day Sync Routine (Training & Finances)',
    category: 'weekly_cycle',
    categoryLabel: isSaturday ? 'Today: Saturday Update' : '7-Day Routine',
    badgeColor: isSaturday ? 'bg-amber-500 text-white' : 'bg-indigo-100 text-indigo-700',
    priority: isSaturday || needsWeeklySync ? 'high' : 'medium',
    description: isSaturday
      ? 'Every Saturday, Battrick processes weekly player training gains, skill pops, sponsor moods, and economic balances. Sync your squad, nets, and finances now to capture new skill levels.'
      : 'Battrick runs on a 7-day weekly cycle updating on Saturdays. Ensure your nets, finances, and squad roster are synced via Bookmarklet.',
    impactReason: 'Keeps player ratings, skill levels, wages, and bank balance 100% accurate for match calculations.',
    actionLabel: 'Sync with Bookmarklet',
    actionTab: 'sync',
    coachPrompt: 'Analyze my club status after this week\'s 7-day training and financial update cycle. What should be my top managerial priorities?',
    isCompleted: completedTaskIds.includes('weekly_saturday_cycle')
  });

  // 2. Player Skill Pop & Lineup Optimization Task
  if (poppedPlayersInfo.length > 0) {
    const poppedNames = poppedPlayersInfo.map(p => p.playerName).slice(0, 3).join(', ');
    const moreCount = poppedPlayersInfo.length > 3 ? ` and ${poppedPlayersInfo.length - 3} more` : '';
    
    tasks.push({
      id: 'skill_pop_lineup_review',
      title: `🎉 Review Best Starting XI (${poppedPlayersInfo.length} Skill Pop${poppedPlayersInfo.length > 1 ? 's' : ''} Detected)`,
      category: 'skill_pops',
      categoryLabel: 'Player Skill Pops',
      badgeColor: 'bg-emerald-500 text-white',
      priority: 'high',
      description: `${poppedNames}${moreCount} recently upgraded key abilities in training! Re-run the Lineup Optimizer to see if these upgraded players now qualify for your Starting XI or warrant a higher batting/bowling position.`,
      impactReason: 'Skill pops directly raise match contribution ratings and can transform backup players into first-choice match winners.',
      highlightData: poppedPlayersInfo.map(p => `${p.playerName} (${p.role}): ${p.pops.join(', ')}`),
      actionLabel: 'Optimize Starting XI',
      actionTab: 'lineup',
      secondaryActionLabel: 'View Pop History',
      secondaryActionTab: 'squad',
      coachPrompt: `I have recent player skill pops (${poppedNames}${moreCount}). How should I adjust my Starting XI and bowling attack in my upcoming match?`,
      isCompleted: completedTaskIds.includes('skill_pop_lineup_review')
    });
  } else if (squad.length > 0) {
    // If no pops detected yet, provide prompt to check squad progression
    tasks.push({
      id: 'skill_pop_lineup_review_check',
      title: 'Evaluate Squad Progression & Best Team XI',
      category: 'skill_pops',
      categoryLabel: 'Lineup Strategy',
      badgeColor: 'bg-blue-100 text-blue-700',
      priority: 'medium',
      description: 'Check if current player form, fitness, and training experience warrant changes to your starting batting lineup and strike bowling rotation.',
      impactReason: 'Optimal batting orders and pitch-matched bowling selections yield up to 15-20% higher team performance.',
      actionLabel: 'Open Lineup Optimizer',
      actionTab: 'lineup',
      secondaryActionLabel: 'Inspect Squad',
      secondaryActionTab: 'squad',
      coachPrompt: 'Based on my current squad roster and pitch conditions, suggest the absolute best First XI lineup configuration.',
      isCompleted: completedTaskIds.includes('skill_pop_lineup_review_check')
    });
  }

  // 3. Matchday Readiness & Pitch Strategy Task
  if (nextMatch) {
    tasks.push({
      id: 'matchday_tactics_prep',
      title: `Tactical Plan: vs ${nextMatch.opponent} (${nextMatch.venue})`,
      category: 'matchday',
      categoryLabel: `${nextMatch.type} Fixture`,
      badgeColor: 'bg-purple-100 text-purple-700',
      priority: 'high',
      description: `Prepare orders for your upcoming ${nextMatch.type} clash against ${nextMatch.opponent} (${nextMatch.venue} on ${nextMatch.date || 'matchday'}). Verify bowler fatigue and pitch suitability (${pavilion?.pitchType || 'Pitch'} conditions).`,
      impactReason: 'Aligning top-order batsmen and bowling attack to pitch characteristics gives a critical home/away tactical edge.',
      actionLabel: 'Set Match Tactics',
      actionTab: 'lineup',
      coachPrompt: `Give me a tactical breakdown and recommended match plan against ${nextMatch.opponent} in a ${nextMatch.type} match playing ${nextMatch.venue} on a ${pavilion?.pitchType || 'standard'} pitch with ${pavilion?.weather || 'fine'} weather.`,
      isCompleted: completedTaskIds.includes('matchday_tactics_prep')
    });
  }

  // 4. Training Net Allocations Task
  if (squad.length > 0 && (playersOnNets === 0 || totalNetsInSquad < 10)) {
    tasks.push({
      id: 'training_nets_allocation',
      title: 'Assign Weekly Training Nets (Nets Unassigned)',
      category: 'training',
      categoryLabel: 'Training Optimization',
      badgeColor: 'bg-rose-100 text-rose-700',
      priority: 'high',
      description: totalNetsInSquad === 0
        ? 'No training nets are currently allocated to your squad! You are missing out on weekly skill progression.'
        : `Only ${totalNetsInSquad} nets assigned across ${playersOnNets} players. You can assign up to 10-12 net sessions to accelerate player development.`,
      impactReason: 'Every unassigned net slows your players\' time to reach the next skill level by a full week.',
      actionLabel: 'Configure Training Nets',
      actionTab: 'squad',
      coachPrompt: 'How should I distribute my 10 training nets across my young prospects and main squad for maximum skill pop velocity?',
      isCompleted: completedTaskIds.includes('training_nets_allocation')
    });
  }

  // 5. Stadium Expansion Opportunity Task
  if (isStadiumUnderbuilt && finances && stadium) {
    tasks.push({
      id: 'stadium_expansion_task',
      title: `Stadium Upgrade Needed (${stadium.capacity.toLocaleString()} / ${recommendedCapacity.toLocaleString()} seats)`,
      category: 'stadium',
      categoryLabel: 'Revenue Growth',
      badgeColor: 'bg-amber-100 text-amber-800',
      priority: 'medium',
      description: `Your club has ${finances.members.toLocaleString()} members. Fan attendance model suggests an optimal capacity of ~${recommendedCapacity.toLocaleString()} seats. Expanding ground capacity will significantly boost gate receipts on matchdays.`,
      impactReason: 'Gate receipts represent up to 60% of match income for competitive clubs.',
      actionLabel: 'Open Stadium Planner',
      actionTab: 'stadium',
      coachPrompt: `My stadium has ${stadium.capacity} seats for ${finances.members} members (recommended: ${recommendedCapacity}). What is the most cost-effective stand construction strategy?`,
      isCompleted: completedTaskIds.includes('stadium_expansion_task')
    });
  }

  // 6. Financial Health & Wage Review Task
  if (inFinancialDeficit && finances) {
    tasks.push({
      id: 'financial_deficit_task',
      title: `Financial Deficit Warning: £${Math.abs(weeklySurplus).toLocaleString()} Weekly Loss`,
      category: 'finance',
      categoryLabel: 'Financial Safety',
      badgeColor: 'bg-rose-500 text-white',
      priority: 'high',
      description: `Your club weekly expenses (£${weeklyExpense.toLocaleString()}) exceed income (£${weeklyIncome.toLocaleString()}). Audit high-wage bench players or adjust PR/Financial Advisor staff to stabilize cash reserves.`,
      impactReason: 'Negative cash balances trigger bank interest penalties and risk forced fire sales.',
      actionLabel: 'Audit Club Wages',
      actionTab: 'wage',
      coachPrompt: `My club is running a weekly deficit of £${Math.abs(weeklySurplus).toLocaleString()} (Reserve: £${finances.cash.toLocaleString()}). How can I trim wages or boost revenue without hurting team performance?`,
      isCompleted: completedTaskIds.includes('financial_deficit_task')
    });
  }

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (activeFilter === 'pending') return !t.isCompleted;
    if (activeFilter === 'completed') return t.isCompleted;
    return true;
  });

  const completedCount = tasks.filter(t => t.isCompleted).length;
  const totalCount = tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isMinimized) {
    const nextPending = tasks.find(t => !t.isCompleted);
    return (
      <div 
        className="bg-white border border-slate-200/90 rounded-2xl p-4 md:p-5 shadow-2xs relative overflow-hidden transition-all hover:border-slate-300"
        id="ai-assistant-action-center-minimized"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center shadow-xs shrink-0">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif font-bold text-base md:text-lg text-slate-900 tracking-tight">
                  AI Assistant Playbook
                </h3>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  {completedCount}/{totalCount} Completed
                </span>
                {isSaturday && (
                  <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                    ⚡ Saturday Cycle
                  </span>
                )}
              </div>
              {nextPending ? (
                <p className="text-xs text-slate-600 mt-0.5 truncate max-w-md">
                  <span className="font-bold text-slate-800 font-sans">Next:</span> {nextPending.title}
                </p>
              ) : (
                <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> All manager playbook tasks completed!
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={toggleMinimize}
              className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-mono font-bold text-xs rounded-xl border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Expand Tasks ({totalCount - completedCount} To-Do)</span>
              <ChevronDown className="w-4 h-4 text-indigo-600" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-2xs relative overflow-hidden" id="ai-assistant-action-center">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-600 flex items-center justify-center shadow-xs shrink-0">
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif font-bold text-xl text-slate-900 tracking-tight">
                AI Assistant Playbook
              </h3>
              <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                Manager Action Center
              </span>
              {isSaturday && (
                <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                  ⚡ Saturday 7-Day Cycle Active
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Real-time actionable steps based on your 7-day training cycle, recent skill pops, match fixtures, and club finances.
            </p>
          </div>
        </div>

        {/* Controls & Progress */}
        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
            <div className="text-right pr-2 border-r border-slate-200">
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Progress
              </div>
              <div className="text-sm font-extrabold text-slate-800 font-mono">
                {completedCount} of {totalCount} Done
              </div>
            </div>
            <div className="w-16">
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[9px] font-mono font-bold text-indigo-600 text-right block mt-0.5">
                {progressPercent}%
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleMinimize}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="Minimize AI Assistant"
          >
            <ChevronUp className="w-4 h-4" />
            <span className="hidden sm:inline text-[11px]">Minimize</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Reset control */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-md transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Tasks ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('pending')}
            className={`px-3 py-1 rounded-md transition cursor-pointer ${
              activeFilter === 'pending'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            To Do ({totalCount - completedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('completed')}
            className={`px-3 py-1 rounded-md transition cursor-pointer ${
              activeFilter === 'completed'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {completedCount > 0 && (
          <button
            type="button"
            onClick={handleResetChecklist}
            className="text-[11px] font-mono text-slate-400 hover:text-slate-700 transition flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Checklist for New Week
          </button>
        )}
      </div>

      {/* Task List */}
      <div className="space-y-3.5 mt-2">
        <AnimatePresence>
          {filteredTasks.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 text-center bg-slate-50/70 border border-slate-200 border-dashed rounded-xl"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 text-sm">All Action Tasks Completed!</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Your club is fully primed for matchday and weekly training cycles. Check back on Saturday or after your next match.
              </p>
            </motion.div>
          ) : (
            filteredTasks.map(task => {
              const isDone = !!task.isCompleted;
              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`border rounded-xl p-4.5 transition-all duration-200 ${
                    isDone 
                      ? 'bg-slate-50/80 border-slate-200 opacity-70' 
                      : task.priority === 'high'
                        ? 'bg-gradient-to-r from-white via-indigo-50/30 to-white border-indigo-200 shadow-sm hover:border-indigo-300'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Checkbox and Main Content */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => toggleTask(task.id, e)}
                        className="mt-0.5 text-slate-400 hover:text-indigo-600 transition shrink-0 cursor-pointer"
                        title={isDone ? 'Mark as incomplete' : 'Mark as done'}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full ${task.badgeColor}`}>
                            {task.categoryLabel}
                          </span>
                          {task.priority === 'high' && !isDone && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200">
                              Priority
                            </span>
                          )}
                          <h4 className={`text-sm font-bold ${isDone ? 'text-slate-400 line-through' : 'text-slate-900 font-display'}`}>
                            {task.title}
                          </h4>
                        </div>

                        <p className={`text-xs mt-1.5 leading-relaxed ${isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                          {task.description}
                        </p>

                        {/* Highlight data list (e.g. player pops) */}
                        {task.highlightData && task.highlightData.length > 0 && !isDone && (
                          <div className="mt-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2.5 text-xs text-emerald-900 space-y-1">
                            <div className="font-bold text-[11px] text-emerald-800 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                              Recent Training Upgrades:
                            </div>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] font-mono text-emerald-700 pl-1">
                              {task.highlightData.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Impact Reason tag */}
                        {!isDone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-indigo-900/70 font-medium mt-2">
                            <Zap className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span><strong>Why it matters:</strong> {task.impactReason}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0 self-start">
                      {task.coachPrompt && !isDone && (
                        <button
                          type="button"
                          onClick={() => handleAskCoach(task.coachPrompt!)}
                          className="text-[11px] text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-2.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                          title="Ask AI Coach for deep tactical reasoning"
                        >
                          <Bot className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Ask AI Coach</span>
                        </button>
                      )}

                      {task.secondaryActionLabel && task.secondaryActionTab && !isDone && (
                        <button
                          type="button"
                          onClick={() => setActiveTab(task.secondaryActionTab!)}
                          className="text-[11px] text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer shrink-0"
                        >
                          {task.secondaryActionLabel}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setActiveTab(task.actionTab)}
                        className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 ${
                          isDone 
                            ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' 
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        <span>{task.actionLabel}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
