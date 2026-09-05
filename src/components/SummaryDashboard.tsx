import React, { useState, useEffect } from 'react';
import { BattrickPlayer, ClubFinances, BattrickGame, StadiumConfig, PavilionInfo } from '../types';
import AIAssistantTasks from './AIAssistantTasks';
import { getCustomUser, onCustomAuthStateChanged, CustomUser } from '../lib/customAuth';
import { 
  Award, Calculator, Users, FolderOpen, BookOpen, RefreshCw, Landmark, Bot, 
  TrendingUp, TrendingDown, DollarSign, Activity, ChevronRight, Calendar, 
  AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Scale, Info, Cloud,
  Database, Wifi, WifiOff, CheckCircle, ArrowUpRight, Upload, Swords
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SummaryDashboardProps {
  setActiveTab: (tab: any) => void;
}

export default function SummaryDashboard({ setActiveTab }: SummaryDashboardProps) {
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [finances, setFinances] = useState<ClubFinances | null>(null);
  const [stadium, setStadium] = useState<StadiumConfig | null>(null);
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [pavilion, setPavilion] = useState<PavilionInfo | null>(null);
  const [teamName, setTeamName] = useState<string>('My Battrick IQ Club');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CustomUser | null>(getCustomUser());
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [hasInitialSyncCompleted, setHasInitialSyncCompleted] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onCustomAuthStateChanged((u) => {
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  const loadLastSyncLogTime = () => {
    try {
      const uid = getCustomUser()?.uid;
      const key = uid ? `bt_sync_logs_${uid}` : 'bt_sync_logs_guest';
      const logs = localStorage.getItem(key) || localStorage.getItem('bt_sync_logs');
      if (logs) {
        const parsed = JSON.parse(logs);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].timestamp) {
          setLastSyncTime(parsed[0].timestamp);
        }
      }
    } catch {
      // ignore
    }
  };

  const loadData = () => {
    setTeamName(localStorage.getItem('bt_team_name') || 'My Battrick IQ Club');
    loadLastSyncLogTime();

    const savedSquad = localStorage.getItem('bt_squad');
    if (savedSquad) {
      try { setSquad(JSON.parse(savedSquad)); } catch (e) { setSquad([]); }
    } else { setSquad([]); }

    const savedFinances = localStorage.getItem('bt_finances');
    if (savedFinances) {
      try { setFinances(JSON.parse(savedFinances)); } catch (e) { setFinances(null); }
    } else { setFinances(null); }

    const savedStadium = localStorage.getItem('bt_stadium');
    if (savedStadium) {
      try { setStadium(JSON.parse(savedStadium)); } catch (e) { setStadium(null); }
    } else { setStadium(null); }

    const savedFixtures = localStorage.getItem('bt_fixtures');
    if (savedFixtures) {
      try { setFixtures(JSON.parse(savedFixtures)); } catch (e) { setFixtures([]); }
    } else { setFixtures([]); }

    const savedPavilion = localStorage.getItem('bt_pavilion');
    if (savedPavilion) {
      try {
        const parsedPav = JSON.parse(savedPavilion);
        setPavilion(parsedPav);
        if (parsedPav?.groundName && (!localStorage.getItem('bt_team_name') || localStorage.getItem('bt_team_name') === 'My Battrick IQ Club')) {
          setTeamName(parsedPav.groundName);
        }
      } catch (e) {
        setPavilion(null);
      }
    } else { setPavilion(null); }
  };

  const handleRefresh = async (silent = false) => {
    if (!silent) {
      setRefreshing(true);
      setIsCloudSyncing(true);
      setRefreshMessage('Refreshing database from cloud...');
    } else {
      setIsCloudSyncing(true);
    }

    // 1. Reload local state first
    loadData();

    // 2. Try to pull the absolute latest from Firestore if authenticated
    try {
      const { auth, db } = await import('../lib/firebase');
      const { doc, getDoc } = await import('firebase/firestore');

      // The target UID might be a team selected by Admin, or the currently logged-in user
      const targetUid = localStorage.getItem('bt_admin_selected_team') || auth.currentUser?.uid;

      if (targetUid) {
        if (!silent) setRefreshMessage('Connecting to Google Cloud Firestore...');
        const docRef = doc(db, 'users', targetUid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (!silent) setRefreshMessage('Updating database from cloud backup...');

          let updated = false;
          
          const updateLocalIfChanged = (key: string, val: any) => {
            const current = localStorage.getItem(key);
            const newValStr = typeof val === 'string' ? val : JSON.stringify(val);

            // If there was a very recent local write (within the last 15 seconds), do NOT overwrite it
            const lastLocalWrite = localStorage.getItem('bt_last_local_write_' + key);
            if (lastLocalWrite) {
              const elapsed = Date.now() - parseInt(lastLocalWrite, 10);
              if (elapsed < 15000) {
                console.log(`[SummaryDashboard] Recent local write for ${key} detected (${elapsed}ms ago). Skipping cloud overwrite to prevent data loss.`);
                return false;
              }
            }

            // Check if cloud value is empty but local has actual data
            let isCloudEmpty = false;
            if (!val) {
              isCloudEmpty = true;
            } else if (Array.isArray(val) && val.length === 0) {
              isCloudEmpty = true;
            } else if (typeof val === 'object') {
              const keys = Object.keys(val);
              if (keys.length === 0) {
                isCloudEmpty = true;
              } else if (key === 'bt_finances' && (val.cash === 0 || val.cash === undefined)) {
                isCloudEmpty = true;
              } else if (key === 'bt_stadium' && (val.capacity === 0 || val.capacity === undefined)) {
                isCloudEmpty = true;
              }
            }

            let isLocalPopulated = false;
            if (current && current !== '[]' && current !== 'null' && current !== '{}') {
              try {
                const parsed = JSON.parse(current);
                if (Array.isArray(parsed)) {
                  if (parsed.length > 0) isLocalPopulated = true;
                } else if (parsed && typeof parsed === 'object') {
                  if (key === 'bt_finances' && parsed.cash > 0) isLocalPopulated = true;
                  if (key === 'bt_stadium' && parsed.capacity > 0) isLocalPopulated = true;
                  if (key === 'bt_pavilion' && parsed.groundName) isLocalPopulated = true;
                }
              } catch (e) {}
            }

            if (isCloudEmpty && isLocalPopulated) {
              return false; // Preserve local data
            }

            if (current !== newValStr) {
              (window as any).isCloudUpdatingLocal = true;
              try {
                localStorage.setItem(key, newValStr);
              } finally {
                (window as any).isCloudUpdatingLocal = false;
              }
              return true;
            }
            return false;
          };

          if (data.squad) {
            if (updateLocalIfChanged('bt_squad', data.squad)) updated = true;
          }
          if (data.finances) {
            if (updateLocalIfChanged('bt_finances', data.finances)) updated = true;
          }
          if (data.stadium) {
            if (updateLocalIfChanged('bt_stadium', data.stadium)) updated = true;
          }
          if (data.fixtures) {
            if (updateLocalIfChanged('bt_fixtures', data.fixtures)) updated = true;
          }
          if (data.pavilion) {
            if (updateLocalIfChanged('bt_pavilion', data.pavilion)) updated = true;
          }
          if (data.teamName && localStorage.getItem('bt_team_name') !== data.teamName) {
            localStorage.setItem('bt_team_name', data.teamName);
            updated = true;
          }

          if (updated) {
            loadData();
            // Notify other components (like Header, Squad, etc.)
            window.dispatchEvent(new Event('storage'));
          }
          if (!silent) setRefreshMessage('Dashboard is 100% up to date!');
        } else {
          if (!silent) setRefreshMessage('No cloud backup found for this user.');
        }
      } else {
        if (!silent) setRefreshMessage('Signed in as Guest. Local data reloaded.');
      }
    } catch (error) {
      console.error('Error refreshing from cloud:', error);
      if (!silent) setRefreshMessage('Offline or connection error. Local data reloaded.');
    } finally {
      setIsCloudSyncing(false);
      setHasInitialSyncCompleted(true);
      if (!silent) {
        setTimeout(() => {
          setRefreshing(false);
          setRefreshMessage(null);
        }, 1200);
      } else {
        setRefreshing(false);
      }
    }
  };

  // Load all local data on mount and storage event
  useEffect(() => {
    // Run full background refresh on mount
    handleRefresh(false);

    const handleStorageUpdate = () => {
      loadData();
      setHasInitialSyncCompleted(true);
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('bt_cloud_backup_request', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('bt_cloud_backup_request', handleStorageUpdate);
    };
  }, []);

  const isDataAvailable = squad.length > 0;
  const isDataSynced = squad.length > 0 || (finances !== null && (finances.members > 0 || finances.cash > 0));
  const isPendingSync = !hasInitialSyncCompleted || isCloudSyncing || refreshing || !isDataSynced;

  // 1. Calculations for Financial Health
  const calculateFinances = () => {
    if (!finances) return { surplus: 0, health: 'Unknown', rating: 0, desc: 'No finance data found. Please sync your finances.' };
    
    const weeklyIncome = finances.sponsorsIncome + finances.gateReceipts + finances.interestReceived;
    const weeklyExpense = finances.playerWages + finances.staffWages;
    const surplus = weeklyIncome - weeklyExpense;
    
    let health = 'Stable';
    let rating = 70;
    let desc = 'Your weekly finances are balanced.';

    if (finances.cash < 0) {
      health = 'Critical (In Debt)';
      rating = 30;
      desc = 'Your club is currently in debt! Control player wages or expand your stadium quickly.';
    } else if (surplus < -10000) {
      health = 'At Risk (Deficit)';
      rating = 50;
      desc = 'Your club is losing cash weekly. Consider pruning staff or selling high-wage backup players.';
    } else if (surplus >= 25000) {
      health = 'Excellent (Strong Growth)';
      rating = 95;
      desc = 'Weekly cash flow is highly profitable. You are in a prime position to expand stadium or buy talent.';
    } else if (surplus > 0) {
      health = 'Healthy (Modest Surplus)';
      rating = 85;
      desc = 'Weekly receipts cover all operating costs with a positive balance.';
    }

    return { weeklyIncome, weeklyExpense, surplus, health, rating, desc };
  };

  const finDetails = calculateFinances();

  // 2. Calculations for Squad Health
  const calculateSquad = () => {
    if (squad.length === 0) return { avgBtr: 0, count: 0, avgAge: 0, netsAssigned: 0, health: 'Empty', rating: 0 };

    const totalBtr = squad.reduce((sum, p) => sum + p.btRating, 0);
    const avgBtr = Math.round(totalBtr / squad.length);
    const avgAge = Number((squad.reduce((sum, p) => sum + p.age, 0) / squad.length).toFixed(1));

    // Training nets status (players on nets)
    const playersOnNets = squad.filter(p => 
      p.nets && (p.nets.batting > 0 || p.nets.bowling > 0 || p.nets.keeping > 0 || p.nets.fielding > 0 || p.nets.stamina > 0)
    ).length;

    let health = 'Balanced';
    let rating = 80;
    
    if (squad.length < 11) {
      health = 'Critically Short';
      rating = 40;
    } else if (playersOnNets === 0 && squad.length > 0) {
      health = 'Training Idle';
      rating = 50;
    } else if (playersOnNets > 0 && playersOnNets < 5) {
      health = 'Low Training Activity';
      rating = 65;
    } else if (avgAge > 28) {
      health = 'Aging Squad';
      rating = 70;
    } else if (avgAge < 23) {
      health = 'Young Prospect Squad';
      rating = 85;
    } else {
      health = 'Prime Competitive';
      rating = 90;
    }

    return { avgBtr, count: squad.length, avgAge, netsAssigned: playersOnNets, health, rating };
  };

  const squadDetails = calculateSquad();

  // 3. Calculations for Stadium Adequacy
  const calculateStadium = () => {
    if (!stadium || !finances) return { current: 0, recommended: 0, status: 'Unknown', rating: 0, desc: 'Sync stadium and finance data to evaluate size.', ratio: 0 };

    const members = finances.members || 500;
    // Battrick general guideline: Recommended capacity is roughly members * 17
    const recommendedCapacity = Math.round(members * 17.5);
    const capacityRatio = stadium.capacity / recommendedCapacity;

    let status = 'Well Balanced';
    let rating = 90;
    let desc = 'Your stadium capacity is ideally sized for your member fanbase.';

    if (stadium.capacity === 0) {
      status = 'Unbuilt';
      rating = 10;
      desc = 'Stadium config is blank. Use the Stadium Planner to structure your ground.';
    } else if (capacityRatio < 0.75) {
      status = 'Severely Underbuilt';
      rating = 40;
      desc = 'Your stadium is too small for your fanbase! You are leaving significant gate revenue on the table.';
    } else if (capacityRatio < 0.9) {
      status = 'Underbuilt';
      rating = 65;
      desc = 'Consider expanding your stadium soon to capture growing gate demands.';
    } else if (capacityRatio > 1.3) {
      status = 'Overbuilt (Maintenance Heavy)';
      rating = 60;
      desc = 'Your stadium capacity exceeds fan demand. You may have paid excess construction fees.';
    }

    return { 
      current: stadium.capacity, 
      recommended: recommendedCapacity, 
      status, 
      rating, 
      desc,
      ratio: Math.min(100, Math.round((stadium.capacity / recommendedCapacity) * 100))
    };
  };

  const stadiumDetails = calculateStadium();

  // 4. Next Match / Fixture Info
  const getNextFixture = () => {
    if (fixtures.length === 0) return null;
    // Attempt to find the first incomplete/future fixture or just the first fixture
    return fixtures[0];
  };

  const nextFixture = getNextFixture();

  // Overall Club Health Score (weighted average)
  const calculateOverallHealth = () => {
    let scores = [];
    let weights = [];

    if (finances) {
      scores.push(finDetails.rating);
      weights.push(0.4); // Finances are crucial
    } else {
      scores.push(80); // Default placeholder
      weights.push(0.4);
    }

    if (squad.length > 0) {
      scores.push(squadDetails.rating);
      weights.push(0.4); // Squad is crucial
    } else {
      scores.push(85); // Default placeholder
      weights.push(0.4);
    }
    
    if (stadium) {
      scores.push(stadiumDetails.rating);
      weights.push(0.2);
    } else {
      scores.push(85); // Default placeholder
      weights.push(0.2);
    }

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weightedSum = scores.reduce((sum, score, i) => sum + (score * weights[i]), 0);
    
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 83;
  };

  const overallHealth = calculateOverallHealth();

  const getHealthGrade = (score: number) => {
    if (score >= 95) return { grade: 'A+', color: 'text-emerald-600 bg-emerald-50 border-emerald-150', text: 'Exceptional' };
    if (score >= 88) return { grade: 'A', color: 'text-emerald-600 bg-emerald-50 border-emerald-150', text: 'Superb' };
    if (score >= 80) return { grade: 'B+', color: 'text-indigo-600 bg-indigo-50 border-indigo-150', text: 'Highly Healthy' };
    if (score >= 70) return { grade: 'B', color: 'text-indigo-600 bg-indigo-50 border-indigo-150', text: 'Stable & Safe' };
    if (score >= 60) return { grade: 'C', color: 'text-amber-600 bg-amber-50 border-amber-150', text: 'Moderate Concerns' };
    return { grade: 'D', color: 'text-rose-600 bg-rose-50 border-rose-150', text: 'Critical Attention Needed' };
  };

  const healthGrade = getHealthGrade(overallHealth);

  const handleGradeDrilldown = () => {
    // Generate context summary for Coach Jarvis
    const squadInfo = squad.length > 0 
      ? `${squad.length} players, Avg Age: ${squadDetails.avgAge}, Avg BTR: ${squadDetails.avgBtr.toLocaleString()}` 
      : 'No squad roster synced';
      
    const financeInfo = finances 
      ? `Cash: £${finances.cash.toLocaleString()}, Weekly Balance: £${finDetails.surplus.toLocaleString()}/wk (${finDetails.health})`
      : 'No financial statements synced';
      
    const stadiumInfo = stadium && finances
      ? `Capacity: ${stadium.capacity.toLocaleString()} seats (Recommended for ${finances.members.toLocaleString()} members: ${stadiumDetails.recommended.toLocaleString()}) - ${stadiumDetails.status}`
      : 'No stadium details synced';

    const promptText = `I clicked my club's BattrickIQ Health Score Grade of **${healthGrade.grade}** (Score: **${overallHealth}/100**) on the Overview Dashboard to get a comprehensive diagnostic drill-down.

Please analyze my club details and explain:
1. Why is my club currently graded a **${healthGrade.grade}**?
2. What are the main bottlenecks or areas of risk in my:
   - **Finances**: ${financeInfo}
   - **Squad & Training**: ${squadInfo}
   - **Stadium Adequacy**: ${stadiumInfo}
3. Give me a clear, prioritized list of actions I can take to improve this score to at least a **B** (and eventually **A**)!`;

    localStorage.setItem('bt_coach_initial_query', promptText);
    setActiveTab('coach');
  };

  const getSeasonWeekDisplay = () => {
    const saved = localStorage.getItem('bt_season_week');
    if (saved) return saved;
    for (const p of squad) {
      if (p.history && p.history.length > 0) {
        const last = p.history[p.history.length - 1];
        if (last.season && last.week) {
          return `SEASON ${last.season} • WEEK ${last.week}`;
        }
      }
    }
    return 'SEASON 65 • WEEK 10';
  };

  const clubDisplayName = teamName && teamName !== 'My Battrick IQ Club' 
    ? teamName 
    : (pavilion?.groundName ? pavilion.groundName : "Lord's Lane CC");
  const groundDisplayName = pavilion?.groundName || (teamName && teamName !== 'My Battrick IQ Club' ? teamName : "Lord's Lane");
  const pitchDisplayName = pavilion?.pitchType || 'Flat';
  const weatherDisplayName = pavilion?.weather || 'Sunny';
  const groundSubtitle = `${groundDisplayName} • ${pitchDisplayName} pitch • ${weatherDisplayName}`;

  const displayHealth = overallHealth > 0 ? overallHealth : 81;
  const displayCash = finances?.cash !== undefined ? `£${finances.cash.toLocaleString()}` : '£0';
  const displaySurplus = finances ? `${finDetails.surplus >= 0 ? '+' : ''}£${finDetails.surplus.toLocaleString()} / wk` : '£0 / wk';
  const displaySquadCount = squad.length > 0 ? squad.length : 0;
  const displayAvgBtr = squad.length > 0 && squadDetails.avgBtr > 0 ? `avg BTR ${squadDetails.avgBtr.toLocaleString()}` : '0 players';
  const displayCapacity = stadium?.capacity ? stadium.capacity.toLocaleString() : (pavilion ? '14,000' : '0');
  const displayMembers = finances?.members ? `${finances.members.toLocaleString()} members` : 'Stadium ground';

  const displayFixtures = fixtures.length > 0 ? fixtures.slice(0, 3) : [
    { opponent: 'Lancashire Lightning', date: '18/07/2026', type: 'One Day', venue: 'Home' as const, result: 'Upcoming' },
    { opponent: 'Yorkshire Vikings', date: '21/07/2026', type: 'Twenty20', venue: 'Away' as const, result: 'Upcoming' },
    { opponent: 'Surrey Browns', date: '25/07/2026', type: 'First Class', venue: 'Home' as const, result: 'Upcoming' },
  ];

  return (
    <div className="flex flex-col gap-6" id="summary-dashboard-view">

      {/* High-Impact Dark Blue Club Header Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-[#0b192e] to-[#0f172a] text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-md border border-blue-900/40 relative overflow-hidden" id="club-hero-heading-banner">
        {/* Subtle decorative background accents */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex flex-col gap-2 max-w-2xl">
            {/* Top metadata tags */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-200 bg-blue-900/80 border border-blue-400/30 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-blue-300" />
                {getSeasonWeekDisplay()}
              </span>

              {(isCloudSyncing || refreshing) ? (
                <span className="text-[11px] font-mono font-bold text-amber-200 bg-amber-900/60 border border-amber-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-300" />
                  Syncing Live Data...
                </span>
              ) : (
                <span className="text-[11px] font-mono font-bold text-emerald-200 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Pavilion Synchronized
                </span>
              )}
            </div>

            {/* Main Club Name Display */}
            <h1 className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight leading-tight mt-1">
              {clubDisplayName}
            </h1>

            {/* Stadium & Conditions Subtitle */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-blue-100/90 font-medium flex-wrap mt-1">
              <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10">
                <Landmark className="w-3.5 h-3.5 text-blue-200" />
                <span>{groundDisplayName}</span>
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10">
                <span>{pitchDisplayName} Pitch</span>
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10">
                <span>{weatherDisplayName}</span>
              </span>
            </div>
          </div>

          {/* Quick Action Button to Sync / Direct Pavilion */}
          <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className="bg-white/15 hover:bg-white/25 active:bg-white/30 text-white border border-white/25 px-4 py-2.5 rounded-xl font-mono text-xs font-semibold transition-all duration-150 flex items-center gap-2 cursor-pointer shadow-sm backdrop-blur-xs"
              title="Open Pavilion Direct Sync Hub"
            >
              <Upload className="w-4 h-4 text-blue-200" />
              <span>Pavilion Sync</span>
              <ChevronRight className="w-3.5 h-3.5 text-blue-200" />
            </button>
          </div>
        </div>
      </div>

      {/* 2x2 Metric Cards Grid with standard app palette and clickable drilldowns */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: CLUB HEALTH */}
        <div 
          onClick={handleGradeDrilldown}
          className="bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-md rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer group shadow-2xs"
          title="Click to drill down with Coach Jarvis diagnostics"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] sm:text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">
              CLUB HEALTH
            </div>
            <span className="text-[10px] font-mono font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 group-hover:bg-blue-600 group-hover:text-white transition">
              <span>Diagnostics</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-slate-900 tracking-tight my-2 group-hover:text-blue-600 transition">
            {displayHealth}
          </div>
          <div className="text-xs text-slate-500 font-normal flex items-center justify-between">
            <span>weighted score / 100</span>
            <span className="font-mono font-bold text-slate-700">Grade {healthGrade.grade}</span>
          </div>
        </div>

        {/* Card 2: CASH with Financial Forecast Drilldown */}
        <div 
          onClick={() => setActiveTab('wage')}
          className="bg-white border border-slate-200/90 hover:border-emerald-400 hover:shadow-md rounded-2xl p-4 sm:p-5 flex flex-col justify-between relative transition-all duration-150 cursor-pointer group shadow-2xs"
          title="Click to drill down into Financial Forecast & Cash Flow"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] sm:text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">
              CASH RESERVES
            </div>
            <span className="text-[10px] font-mono font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 group-hover:bg-emerald-600 group-hover:text-white transition">
              <span>Finances</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="font-serif font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight my-2 group-hover:text-emerald-600 transition truncate">
            {displayCash}
          </div>
          <div className="text-xs text-slate-500 font-normal flex items-center justify-between">
            <span className={finDetails.surplus >= 0 ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold'}>
              {displaySurplus}
            </span>
            <span className="text-[10px] font-mono font-bold uppercase text-slate-400">
              {finDetails.health}
            </span>
          </div>
        </div>

        {/* Card 3: SQUAD with Roster Drilldown */}
        <div 
          onClick={() => setActiveTab('squad')}
          className="bg-white border border-slate-200/90 hover:border-indigo-400 hover:shadow-md rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer group shadow-2xs"
          title="Click to drill down into Squad Roster & Training"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] sm:text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">
              SQUAD ROSTER
            </div>
            <span className="text-[10px] font-mono font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 group-hover:bg-indigo-600 group-hover:text-white transition">
              <span>Squad</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="font-serif font-bold text-3xl sm:text-4xl lg:text-5xl text-slate-900 tracking-tight my-2 group-hover:text-indigo-600 transition">
            {displaySquadCount}
          </div>
          <div className="text-xs text-slate-500 font-normal flex items-center justify-between">
            <span>{displayAvgBtr}</span>
            {squadDetails.netsAssigned > 0 && (
              <span className="font-mono text-[10px] text-indigo-600 font-bold">
                {squadDetails.netsAssigned} nets
              </span>
            )}
          </div>
        </div>

        {/* Card 4: CAPACITY with Stadium Planner Drilldown */}
        <div 
          onClick={() => setActiveTab('stadium')}
          className="bg-white border border-slate-200/90 hover:border-amber-400 hover:shadow-md rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-150 cursor-pointer group shadow-2xs"
          title="Click to drill down into Stadium Expansion Planner"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] sm:text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">
              STADIUM CAPACITY
            </div>
            <span className="text-[10px] font-mono font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-0.5 group-hover:bg-amber-600 group-hover:text-white transition">
              <span>Stadium</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          <div className="font-serif font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight my-2 group-hover:text-amber-700 transition">
            {displayCapacity}
          </div>
          <div className="text-xs text-slate-500 font-normal flex items-center justify-between">
            <span>{displayMembers}</span>
            <span className="text-[10px] font-mono text-slate-400 font-medium capitalize">
              {stadiumDetails.status}
            </span>
          </div>
        </div>
      </div>

      {/* "This week" Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold text-2xl text-slate-900">This week</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('scout')}
              className="text-xs font-mono font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Scout Opponent</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lineup')}
              className="text-xs font-mono font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Match XI</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {displayFixtures.map((game, idx) => (
            <div 
              key={idx}
              onClick={() => setActiveTab('scout')}
              className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1 group hover:bg-slate-50 -mx-3 px-3 rounded-xl transition cursor-pointer"
            >
              <div>
                <h4 className="font-serif font-bold text-base text-slate-900 group-hover:text-blue-600 transition flex items-center gap-2">
                  <span>{game.opponent}</span>
                  <span className="text-[10px] font-mono text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded group-hover:bg-indigo-100">
                    Scout &gt;
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 font-normal">
                  {game.date} • {game.type} • {game.venue}
                </p>
              </div>
              <span className="text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-md bg-blue-50/80 text-blue-700 border border-blue-200/60 uppercase shrink-0">
                {game.result && game.result !== 'Upcoming' ? game.result : 'UPCOMING'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Assistant - Manager Action Center & Weekly Playbook */}
      <AIAssistantTasks
        squad={squad}
        finances={finances}
        stadium={stadium}
        fixtures={fixtures}
        pavilion={pavilion}
        setActiveTab={setActiveTab}
      />

      {/* 3. Action Bento Grid: Links to other sections of the app */}
      <div>
        <h3 className="font-display font-extrabold text-sm text-slate-800 uppercase tracking-wider mb-4 px-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          BattrickIQ Strategic Modules
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* Card: Sync Hub */}
          <div 
            onClick={() => setActiveTab('sync')}
            className="group bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-150 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">Step 01</span>
              </div>
              <h4 className="font-display font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">Roster Synchronization</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Keep the club current by pasting webpage copy or uploading HTML files from squad, nets, finance, or fixture screens.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 mt-4 group-hover:translate-x-0.5 transition-transform duration-150">
              <span>Sync Files</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card: Squad & Pops */}
          <div 
            onClick={() => setActiveTab('squad')}
            className="group bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-150 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">Step 02</span>
              </div>
              <h4 className="font-display font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">Squad & Training Pops</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Analyze player abilities, review weekly training pop logs, inspect detailed performance advice, and see age metrics.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 mt-4 group-hover:translate-x-0.5 transition-transform duration-150">
              <span>View Roster</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card: Lineup XI */}
          <div 
            onClick={() => setActiveTab('lineup')}
            className="group bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-150 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">Step 03</span>
              </div>
              <h4 className="font-display font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">Lineup Optimizer</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Set matchday orders, select your best bowlers/batters, and evaluate projected match ratings for different pitches.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 mt-4 group-hover:translate-x-0.5 transition-transform duration-150">
              <span>Formulate XI</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card: Wages Forecast */}
          <div 
            onClick={() => setActiveTab('wage')}
            className="group bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-150 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Calculator className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">Step 04</span>
              </div>
              <h4 className="font-display font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">Wage & Budget Forecast</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Assess player wage growth curves, project upcoming season wage bills, and build comprehensive multi-week balance sheets.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 mt-4 group-hover:translate-x-0.5 transition-transform duration-150">
              <span>Model Budgets</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card: Stadium Planner */}
          <div 
            onClick={() => setActiveTab('stadium')}
            className="group bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-150 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Landmark className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">Step 05</span>
              </div>
              <h4 className="font-display font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">Stadium Expansion</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Determine optimal stand proportions, estimate construction costs, and balance seat metrics against club membership size.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 mt-4 group-hover:translate-x-0.5 transition-transform duration-150">
              <span>Size Grounds</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card: Tactical AI Coach */}
          <div 
            onClick={() => setActiveTab('coach')}
            className="group bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-150 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">Step 06</span>
              </div>
              <h4 className="font-display font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">AI Tactical Assistant</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Pose strategic club queries directly to Coach Jarvis regarding lineup strategy, skill pops, and market acquisitions.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 mt-4 group-hover:translate-x-0.5 transition-transform duration-150">
              <span>Consult Coach</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card: Opponent Scouting & Match Analysis */}
          <div 
            onClick={() => setActiveTab('scout')}
            className="group bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-150 cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition">
                  <Swords className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold">Step 07</span>
              </div>
              <h4 className="font-display font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">Opponent Scout & Tactics</h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Analyze opposition lineups, identify tail collapses (#7–11), target weak 5th bowlers, and align match intensity with pitch conditions.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 mt-4 group-hover:translate-x-0.5 transition-transform duration-150">
              <span>Scout Opposition</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

        </div>
      </div>

      {/* 4. Secondary Information Block / Next Match Preview */}
      {isDataAvailable && nextFixture && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-inner">
          <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-500 flex items-center gap-2 mb-3.5">
            <Calendar className="w-4 h-4 text-blue-500" />
            Upcoming Scheduled Match
          </h4>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-150 p-4 rounded-lg">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">{nextFixture.opponent}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                  nextFixture.venue === 'Home' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {nextFixture.venue}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Format: <span className="font-bold">{nextFixture.type}</span> • Date: <span className="font-mono">{nextFixture.date}</span>
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => setActiveTab('lineup')}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg transition self-start sm:self-auto cursor-pointer"
            >
              Prepare Match Tactics
            </button>
          </div>
        </div>
      )}

      {/* Cloud & Local Storage Status Footer */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs mt-2">
        <div className="flex items-center gap-2.5">
          {isCloudSyncing || refreshing ? (
            <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
          ) : currentUser ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <Database className="w-4 h-4 text-blue-600 shrink-0" />
          )}
          <span className="text-slate-600">
            {isCloudSyncing || refreshing ? (
              <span className="text-amber-700 font-semibold">Synchronizing with Firestore cloud database...</span>
            ) : currentUser ? (
              <span>Cloud connected: <b className="text-slate-800">{currentUser.email || currentUser.username}</b> {lastSyncTime ? `• Last sync: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
            ) : (
              <span>Local storage mode • Sign in via <button type="button" onClick={() => setActiveTab('sync')} className="text-blue-600 font-bold hover:underline cursor-pointer">Sync Hub</button> for multi-device cloud backup</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleRefresh(false)}
            disabled={refreshing || isCloudSyncing}
            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || isCloudSyncing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{refreshing || isCloudSyncing ? 'Syncing...' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className="px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>
        </div>
      </div>

    </div>
  );
}
