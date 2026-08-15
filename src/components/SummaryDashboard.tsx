import React, { useState, useEffect } from 'react';
import { BattrickPlayer, ClubFinances, BattrickGame, StadiumConfig, PavilionInfo } from '../types';
import AIAssistantTasks from './AIAssistantTasks';
import { getCustomUser, onCustomAuthStateChanged, CustomUser } from '../lib/customAuth';
import { 
  Award, Calculator, Users, FolderOpen, BookOpen, RefreshCw, Landmark, Bot, 
  TrendingUp, TrendingDown, DollarSign, Activity, ChevronRight, Calendar, 
  AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Scale, Info, Cloud,
  Database, Wifi, WifiOff, CheckCircle, ArrowUpRight, Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SummaryDashboardProps {
  setActiveTab: (tab: 'summary' | 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'rules' | 'admin') => void;
}

export default function SummaryDashboard({ setActiveTab }: SummaryDashboardProps) {
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [finances, setFinances] = useState<ClubFinances | null>(null);
  const [stadium, setStadium] = useState<StadiumConfig | null>(null);
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [pavilion, setPavilion] = useState<PavilionInfo | null>(null);
  const [teamName, setTeamName] = useState<string>('My Battrick IQ Club');
  const [refreshing, setRefreshing] = useState(true);
  const [refreshMessage, setRefreshMessage] = useState<string | null>('Connecting to database...');
  const [currentUser, setCurrentUser] = useState<CustomUser | null>(getCustomUser());
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(true);
  const [hasInitialSyncCompleted, setHasInitialSyncCompleted] = useState<boolean>(false);
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
      try { setPavilion(JSON.parse(savedPavilion)); } catch (e) { setPavilion(null); }
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

  return (
    <div className="flex flex-col gap-6" id="summary-dashboard-view">

      {/* 0. Live Database Sync & Cloud Status Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs" id="database-sync-status-bar">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isCloudSyncing || refreshing ? (
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
              </div>
            ) : currentUser ? (
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <Cloud className="w-4.5 h-4.5 text-emerald-600" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <Database className="w-4.5 h-4.5 text-blue-600" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  {isCloudSyncing || refreshing ? (
                    <span className="text-amber-700 font-extrabold flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Synchronizing with Cloud Database...
                    </span>
                  ) : currentUser ? (
                    <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Cloud Database Synchronized
                    </span>
                  ) : (
                    <span className="text-slate-700 font-extrabold flex items-center gap-1">
                      <Database className="w-3.5 h-3.5 text-blue-600" />
                      Local Storage Mode (Guest)
                    </span>
                  )}
                </span>
                
                {currentUser && (
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[200px]">
                    {currentUser.email || currentUser.username}
                  </span>
                )}

                <span className="text-[10px] font-mono text-slate-400">
                  • {squad.length} Players {finances ? `• £${finances.cash.toLocaleString()}` : ''}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                {isCloudSyncing || refreshing ? (
                  <span className="text-amber-800 font-medium animate-pulse">
                    Please wait while your squad roster, finances, nets, and pavilion synchronize with Google Cloud Firestore...
                  </span>
                ) : currentUser ? (
                  <span>
                    Real-time cloud database backup active. {lastSyncTime ? `Last imported: ${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready for match operations.'}
                  </span>
                ) : (
                  <span>
                    Club data is cached in this browser. <button type="button" onClick={() => setActiveTab('sync')} className="text-indigo-600 font-bold hover:underline cursor-pointer">Sign In / Register</button> to enable persistent cloud sync.
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => handleRefresh(false)}
              disabled={refreshing || isCloudSyncing}
              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing || isCloudSyncing ? 'animate-spin text-indigo-600' : ''}`} />
              <span>{refreshing || isCloudSyncing ? 'Syncing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Sync Source</span>
            </button>
          </div>
        </div>

        {/* Dynamic progress bar when syncing */}
        {(isCloudSyncing || refreshing) && (
          <div className="w-full bg-amber-100 h-1 rounded-full overflow-hidden mt-3">
            <div className="bg-amber-500 h-full w-full animate-pulse" />
          </div>
        )}
      </div>
      
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        {/* Background visuals */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono font-bold tracking-wider uppercase px-2.5 py-1 rounded-full border border-blue-500/30">
                Club Overview Dashboard
              </span>
              <button
                type="button"
                onClick={() => handleRefresh(false)}
                disabled={refreshing}
                className="text-[10px] bg-white/10 hover:bg-white/15 disabled:bg-white/5 border border-white/10 hover:border-white/20 px-2.5 py-1 rounded-full font-mono font-bold text-blue-200 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              {refreshMessage && (
                <span className="text-[9px] font-mono text-emerald-400 animate-pulse bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {refreshMessage}
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-display font-black tracking-tight mt-2.5">
              {teamName}
            </h2>
            {pavilion ? (
              <p className="text-xs text-slate-300 font-mono mt-1 flex items-center gap-2">
                <span>🏟️ {pavilion.groundName || 'My Club Ground'}</span>
                <span>•</span>
                <span>Pitch: {pavilion.pitchType}</span>
                <span>•</span>
                <span>Weather: {pavilion.weather}</span>
              </p>
            ) : (
              <p className="text-xs text-slate-300 font-mono mt-1 flex items-center gap-2">
                <span>🏟️ My Club Ground</span>
                <span>•</span>
                <span>Pitch: Flat (Simulated)</span>
                <span>•</span>
                <span>Weather: Sunny</span>
              </p>
            )}
          </div>

          {/* Comprehensive Club Score Display */}
          <button
            type="button"
            onClick={isPendingSync ? () => setActiveTab('sync') : handleGradeDrilldown}
            className="flex items-center gap-4 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-left rounded-xl p-4.5 shrink-0 w-full md:w-auto cursor-pointer group focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            title={isPendingSync ? "Database sync in progress - Click to open Sync Hub" : "Click to drill down with Coach Jarvis"}
          >
            {isPendingSync ? (
              <>
                <div className="w-14 h-14 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                  <span className="text-[8px] font-mono font-bold mt-1 text-amber-300 uppercase tracking-wider">Syncing</span>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                    <span>BattrickIQ Health Score</span>
                  </div>
                  <div className="text-xl font-bold flex items-baseline gap-1 mt-0.5">
                    <span className="text-amber-300 font-extrabold text-base sm:text-lg">Pending Sync</span>
                  </div>
                  <div className="text-[11px] text-amber-200/90 font-medium flex items-center gap-1.5 mt-1">
                    <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                    <span>{isCloudSyncing || refreshing ? 'Synchronizing database...' : 'Awaiting club sync'}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${healthGrade.color}`}>
                  <span className="text-xl font-display font-black leading-none">{healthGrade.grade}</span>
                  <span className="text-[8px] font-mono font-bold mt-0.5 tracking-wider uppercase">Grade</span>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                    <span>BattrickIQ Health Score</span>
                    <span className="text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] bg-blue-500/20 px-1 py-0.2 rounded font-sans">Ask Jarvis →</span>
                  </div>
                  <div className="text-xl font-bold flex items-baseline gap-1 mt-0.5">
                    <span className="text-white font-extrabold">{overallHealth}</span>
                    <span className="text-slate-400 text-xs">/ 100</span>
                  </div>
                  <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-1 group-hover:text-blue-300 transition-colors">
                    <Activity className="w-3.5 h-3.5 group-hover:hidden" />
                    <Bot className="w-3.5 h-3.5 text-blue-400 hidden group-hover:block animate-pulse" />
                    <span>{healthGrade.text} <span className="group-hover:underline">(Ask Jarvis)</span></span>
                  </div>
                </div>
              </>
            )}
          </button>
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

      {/* 2. Key Health Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Finance Pillar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400">Financial Vitality</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPendingSync 
                    ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                    : finDetails.surplus >= 0 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'bg-rose-50 text-rose-700'
                }`}>
                  {isPendingSync ? 'Pending Sync' : finDetails.health}
                </span>
              </div>
              
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-extrabold font-mono text-slate-900">
                  {isPendingSync ? 'Pending Sync' : (finances ? `£${finances.cash.toLocaleString()}` : '£0')}
                </span>
                {!isPendingSync && <span className="text-xs text-slate-400">Reserve</span>}
              </div>

              {isPendingSync ? (
                <div className="flex items-center gap-1.5 mt-2.5 text-xs text-slate-400 font-mono">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span>Synchronizing financial records...</span>
                </div>
              ) : finances ? (
                <div className="flex items-center gap-1.5 mt-2.5 text-xs">
                  {finDetails.surplus >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-500" />
                  )}
                  <span className={`font-mono font-semibold ${finDetails.surplus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {finDetails.surplus >= 0 ? '+' : ''}£{finDetails.surplus.toLocaleString()}
                  </span>
                  <span className="text-slate-500">weekly change</span>
                </div>
              ) : (
                <div className="text-slate-400 text-xs mt-2 italic">No financial statements synced</div>
              )}

              <p className="text-xs text-slate-500 mt-4 leading-relaxed border-t border-slate-100 pt-3">
                {isPendingSync ? 'Please wait while financial balance, sponsor income, and wages load...' : finDetails.desc}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                localStorage.setItem('bt_wage_subtab', 'health');
                setActiveTab('wage');
              }}
              className="mt-4 flex items-center justify-between text-xs text-blue-600 hover:text-blue-700 font-bold transition pt-2 border-t border-slate-100 w-full cursor-pointer"
            >
              <span>Audit Club Health & Wages</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Squad Depth Pillar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400">Roster Capacity</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPendingSync ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700'
                }`}>
                  {isPendingSync ? 'Pending Sync' : squadDetails.health}
                </span>
              </div>
              
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-extrabold font-mono text-slate-900">
                  {isPendingSync ? 'Pending Sync' : squadDetails.count}
                </span>
                {!isPendingSync && <span className="text-xs text-slate-400">Active Players</span>}
              </div>

              {isPendingSync ? (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400 font-mono border-t border-slate-100 pt-3">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span>Synchronizing player skills & nets...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs border-t border-slate-100 pt-3">
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-mono">Avg BTR</div>
                    <div className="font-mono font-bold text-slate-700 mt-0.5">
                      {squadDetails.avgBtr.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px] uppercase font-mono">Avg Age</div>
                    <div className="font-mono font-bold text-slate-700 mt-0.5">
                      {squadDetails.avgAge} yrs
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                {isPendingSync ? (
                  <span className="text-slate-400">Loading squad roster and training nets...</span>
                ) : squadDetails.netsAssigned > 0 ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {squadDetails.netsAssigned} players receiving training nets
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Zero players assigned to weekly training nets!
                  </span>
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('squad')}
              className="mt-4 flex items-center justify-between text-xs text-blue-600 hover:text-blue-700 font-bold transition pt-2 border-t border-slate-100 w-full cursor-pointer"
            >
              <span>Manage Players</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Stadium Adequacy Pillar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-slate-400">Stadium Sizing</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPendingSync 
                    ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                    : stadiumDetails.rating >= 80 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'bg-amber-50 text-amber-700'
                }`}>
                  {isPendingSync ? 'Pending Sync' : stadiumDetails.status}
                </span>
              </div>
              
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-extrabold font-mono text-slate-900">
                  {isPendingSync ? 'Pending Sync' : stadiumDetails.current.toLocaleString()}
                </span>
                {!isPendingSync && <span className="text-xs text-slate-400">Capacity</span>}
              </div>

              {isPendingSync ? (
                <div className="flex items-center gap-1.5 mt-3.5 text-xs text-slate-400 font-mono border-t border-slate-100 pt-3">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span>Synchronizing stadium ground specs...</span>
                </div>
              ) : (
                <div className="mt-3.5 border-t border-slate-100 pt-3">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span>Fan Match Rate</span>
                    <span>{stadiumDetails.ratio}% of Recommended</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        stadiumDetails.ratio > 115 
                          ? 'bg-amber-500' 
                          : stadiumDetails.ratio >= 90 
                            ? 'bg-emerald-500' 
                            : 'bg-blue-500'
                      }`}
                      style={{ width: `${stadiumDetails.ratio}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                {isPendingSync ? 'Checking stadium seating capacity against fan demand...' : stadiumDetails.desc}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('stadium')}
              className="mt-4 flex items-center justify-between text-xs text-blue-600 hover:text-blue-700 font-bold transition pt-2 border-t border-slate-100 w-full cursor-pointer"
            >
              <span>Expand & Model Seats</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>

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

    </div>
  );
}
