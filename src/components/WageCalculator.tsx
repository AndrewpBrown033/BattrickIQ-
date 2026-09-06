import React, { useState, useEffect } from 'react';
import { BattrickPlayer, ClubFinances, BattrickGame, StadiumConfig } from '../types';
import { 
  DollarSign, Shield, TrendingUp, Info, Calendar, Landmark, 
  ArrowUpRight, ArrowDownRight, Scale, Coins, BarChart3, LineChart as LineIcon,
  AlertTriangle, CheckCircle, Award, Users, ChevronDown, ChevronUp, Settings2
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, Tooltip, CartesianGrid, Cell 
} from 'recharts';

export default function WageCalculator() {
  const [subTab, setSubTab] = useState<'forecast' | 'health'>('health');

  useEffect(() => {
    const requested = localStorage.getItem('bt_wage_subtab');
    if (requested === 'health' || requested === 'forecast') {
      setSubTab(requested);
      localStorage.removeItem('bt_wage_subtab');
    }
  }, []);

  // Real synchronized state from local storage
  const [importedPlayers, setImportedPlayers] = useState<BattrickPlayer[]>([]);
  const [finances, setFinances] = useState<ClubFinances | null>(null);
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);

  // Simulation staff overrides for the Optimizer panel
  const [simPR, setSimPR] = useState<number>(0);
  const [simFA, setSimFA] = useState<number>(0);
  const [simBat, setSimBat] = useState<number>(0);
  const [simBowl, setSimBowl] = useState<number>(0);
  const [simField, setSimField] = useState<number>(0);
  const [simKeep, setSimKeep] = useState<number>(0);
  const [simStam, setSimStam] = useState<number>(0);
  const [simPsych, setSimPsych] = useState<number>(0);

  // Staff Optimization logic
  const getPRAdvice = () => {
    const memberCount = finances?.members || 0;
    const optimal = Math.min(10, Math.max(1, Math.ceil(memberCount / 250)));
    const current = finances?.prOfficers || 0;
    const diff = current - optimal;

    let text = '';
    let color = 'text-slate-500';

    if (diff === 0) {
      text = 'Perfect! Your sponsor satisfaction is optimized efficiently.';
      color = 'text-emerald-600';
    } else if (diff > 0) {
      text = `Overstaffed by ${diff} PRs. Dismiss them to save £${(diff * 1250).toLocaleString()}/wk in staff salaries.`;
      color = 'text-amber-600';
    } else if (diff < 0) {
      text = `Understaffed by ${Math.abs(diff)} PRs. Recruit to maximize sponsor mood and weekly income.`;
      color = 'text-rose-600';
    }

    return { current, optimal, status: text, color };
  };

  const getFAAdvice = () => {
    const cash = finances?.cash || 0;
    
    // BTHF Formula: 0 FAs if cash < £2.5M, 10 FAs if cash >= £2.5M
    const optimal = cash >= 2500000 ? 10 : 0;

    const current = finances?.finAdvisors || 0;
    const diff = current - optimal;

    let text = '';
    let color = 'text-slate-500';

    if (diff === 0) {
      text = cash >= 2500000
        ? 'Perfect! Since your reserves exceed £2,500,000, holding the maximum of 10 FAs is highly profitable.'
        : 'Perfect! Since your reserves are below £2,500,000, holding 0 FAs avoids wasting staff wages.';
      color = 'text-emerald-600';
    } else if (diff > 0) {
      text = `Overstaffed by ${diff} FAs. Dismiss them to save £${(diff * 1250).toLocaleString()}/wk wages.`;
      color = 'text-amber-600';
    } else if (diff < 0) {
      text = `Understaffed by ${Math.abs(diff)} FAs. Hire up to 10 FAs to maximize interest yield.`;
      color = 'text-rose-600';
    }

    return { current, optimal, status: text, color };
  };

  const getBattingCoachesAdvice = () => {
    const current = finances?.battingCoaches || 0;
    const battingNets = importedPlayers.reduce((acc, p) => acc + (p.nets?.batting || 0), 0);
    const optimal = battingNets > 0 ? Math.min(10, Math.max(1, Math.ceil(battingNets / 2.5))) : 3;
    const diff = current - optimal;

    let text = '';
    let color = 'text-slate-500';

    if (diff === 0) {
      text = 'Perfect batting coaches ratio for your current training program.';
      color = 'text-emerald-600';
    } else if (diff > 0) {
      text = `Overstaffed by ${diff} batting coaches. Dismiss to save £${(diff * 1250).toLocaleString()}/wk.`;
      color = 'text-amber-600';
    } else {
      text = `Understaffed by ${Math.abs(diff)} batting coaches. Hire more to optimize your ${battingNets || 3} batting nets.`;
      color = 'text-rose-600';
    }

    return { current, optimal, status: text, color };
  };

  const getBowlingCoachesAdvice = () => {
    const current = finances?.bowlingCoaches || 0;
    const bowlingNets = importedPlayers.reduce((acc, p) => acc + (p.nets?.bowling || 0), 0);
    const optimal = bowlingNets > 0 ? Math.min(10, Math.max(1, Math.ceil(bowlingNets / 2.5))) : 3;
    const diff = current - optimal;

    let text = '';
    let color = 'text-slate-500';

    if (diff === 0) {
      text = 'Perfect bowling coaches ratio for your current training program.';
      color = 'text-emerald-600';
    } else if (diff > 0) {
      text = `Overstaffed by ${diff} bowling coaches. Dismiss to save £${(diff * 1250).toLocaleString()}/wk.`;
      color = 'text-amber-600';
    } else {
      text = `Understaffed by ${Math.abs(diff)} bowling coaches. Hire more to optimize your ${bowlingNets || 3} bowling nets.`;
      color = 'text-rose-600';
    }

    return { current, optimal, status: text, color };
  };

  const getFieldingCoachesAdvice = () => {
    const current = finances?.fieldingCoaches || 0;
    const fieldingNets = importedPlayers.reduce((acc, p) => acc + (p.nets?.fielding || 0), 0);
    const optimal = fieldingNets > 0 ? Math.min(5, Math.max(1, Math.ceil(fieldingNets / 3))) : 1;
    const diff = current - optimal;

    let text = '';
    let color = 'text-slate-500';

    if (diff === 0) {
      text = 'Optimized. 1 fielding coach is standard for squad fielding.';
      color = 'text-emerald-600';
    } else if (diff > 0) {
      text = `Overstaffed by ${diff} fielding coaches. Dismiss to save £${(diff * 1250).toLocaleString()}/wk.`;
      color = 'text-amber-600';
    } else {
      text = `Understaffed by ${Math.abs(diff)} fielding coaches. Hire to improve fielding efficiency.`;
      color = 'text-rose-600';
    }

    return { current, optimal, status: text, color };
  };

  const getKeepingCoachesAdvice = () => {
    const current = finances?.keepingCoaches || 0;
    const keepingNets = importedPlayers.reduce((acc, p) => acc + (p.nets?.keeping || 0), 0);
    const optimal = keepingNets > 0 ? 1 : 0;
    const diff = current - optimal;

    let text = '';
    let color = 'text-slate-500';

    if (diff === 0) {
      text = optimal === 0 ? 'No active keepers in training; 0 coaches is optimal.' : 'Perfect keeper coach ratio.';
      color = 'text-emerald-600';
    } else if (diff > 0) {
      text = `Overstaffed by ${diff} keeping coaches. Since you train ${keepingNets} keepers, you are wasting £${(diff * 1250).toLocaleString()}/wk.`;
      color = 'text-amber-600';
    } else {
      text = `Understaffed by ${Math.abs(diff)} keeping coaches. Hire to train your keepers effectively.`;
      color = 'text-rose-600';
    }

    return { current, optimal, status: text, color };
  };

  const getStaminaCoachesAdvice = () => {
    const current = finances?.staminaCoaches || 0;
    const staminaNets = importedPlayers.reduce((acc, p) => acc + (p.nets?.stamina || 0), 0);
    const optimal = staminaNets > 0 ? 1 : 1;
    const diff = current - optimal;

    let text = '';
    let color = 'text-slate-500';

    if (diff === 0) {
      text = 'Perfect stamina coach count. 1 is ideal for squad fitness.';
      color = 'text-emerald-600';
    } else if (diff > 0) {
      text = `Overstaffed by ${diff} stamina coaches. Dismiss them to save £${(diff * 1250).toLocaleString()}/wk.`;
      color = 'text-amber-600';
    } else {
      text = `Understaffed. Hire 1 stamina coach to prevent rapid fitness decline.`;
      color = 'text-rose-600';
    }

    return { current, optimal, status: text, color };
  };

  const getPsychologistsAdvice = () => {
    const current = finances?.psychologists || 0;
    const optimal = 1;
    const diff = current - optimal;

    let text = '';
    let color = 'text-slate-500';

    if (diff === 0) {
      text = 'Perfect. 1 psychologist maintains standard squad morale and confidence.';
      color = 'text-emerald-600';
    } else if (diff > 0) {
      text = `Overstaffed by ${diff} psychologists. Over 1 has heavy diminishing returns, wasting £${(diff * 1250).toLocaleString()}/wk.`;
      color = 'text-amber-600';
    } else {
      text = `Understaffed. Hire 1 psychologist to prevent morale degradation after losses.`;
      color = 'text-rose-600';
    }

    return { current, optimal, status: text, color };
  };

  // Stadium configuration state loaded from local storage
  const [stadium, setStadium] = useState<StadiumConfig>({
    terracing: 6000,
    grass: 3000,
    seats: 800,
    boxes: 200,
    capacity: 10000
  });

  // Financial Planner modeled state (users can override synced values via sliders)
  const [cashVal, setCashVal] = useState<number>(4521850);
  const [sponsorsVal, setSponsorsVal] = useState<number>(42500);
  const [interestVal, setInterestVal] = useState<number>(1250);
  const [playerWagesVal, setPlayerWagesVal] = useState<number>(26850);
  const [staffWagesVal, setStaffWagesVal] = useState<number>(7500);

  // Stadium Attendance and Ticketing Variables (requested by user)
  const [terracingPrice, setTerracingPrice] = useState<number>(15);
  const [grassPrice, setGrassPrice] = useState<number>(21);
  const [seatsPrice, setSeatsPrice] = useState<number>(35);
  const [boxesPrice, setBoxesPrice] = useState<number>(120);

  // Estimated attendance occupancy rates per game type
  const [fcAttendanceRate, setFcAttendanceRate] = useState<number>(60); // First Class (default 60%)
  const [odAttendanceRate, setOdAttendanceRate] = useState<number>(85); // One Day (default 85%)
  const [t20AttendanceRate, setT20AttendanceRate] = useState<number>(95); // Twenty20 (default 95%)
  const [cupAttendanceRate, setCupAttendanceRate] = useState<number>(80); // Cup Matches (default 80%)
  const [friendlyAttendanceRate, setFriendlyAttendanceRate] = useState<number>(25); // Friendly Matches (default 25%)

  // Venue toggle mapping for the projection weeks
  const [customVenues, setCustomVenues] = useState<Record<number, 'Home' | 'Away'>>({});
  // Match type overrides mapping for the projection weeks
  const [customTypes, setCustomTypes] = useState<Record<number, string>>({});
  // Opponent overrides mapping
  const [customOpponents, setCustomOpponents] = useState<Record<number, string>>({});

  const [showVariablesPanel, setShowVariablesPanel] = useState<boolean>(true);

  // Sync data from local storage
  const loadLocalStorageData = () => {
    const savedSquad = localStorage.getItem('bt_squad');
    if (savedSquad) {
      try {
        const parsed = JSON.parse(savedSquad);
        if (Array.isArray(parsed)) {
          setImportedPlayers(parsed);
        }
      } catch (e) {
        console.error('Error loading squad:', e);
      }
    } else {
      setImportedPlayers([]);
    }

    const savedStadium = localStorage.getItem('bt_stadium');
    if (savedStadium) {
      try {
        const parsed = JSON.parse(savedStadium) as StadiumConfig;
        if (parsed.capacity > 0) {
          setStadium(parsed);
        }
      } catch (e) {
        console.error('Error loading stadium:', e);
        setStadium({
          terracing: 6000,
          grass: 3000,
          seats: 800,
          boxes: 200,
          capacity: 10000
        });
      }
    } else {
      setStadium({
        terracing: 6000,
        grass: 3000,
        seats: 800,
        boxes: 200,
        capacity: 10000
      });
    }

    const savedFinances = localStorage.getItem('bt_finances');
    if (savedFinances) {
      try {
        const parsed = JSON.parse(savedFinances);
        setFinances(parsed);
      } catch (e) {
        console.error('Error loading finances:', e);
      }
    } else {
      setFinances(null);
    }

    const savedFixtures = localStorage.getItem('bt_fixtures');
    if (savedFixtures) {
      try {
        const parsed = JSON.parse(savedFixtures);
        if (Array.isArray(parsed)) {
          setFixtures(parsed);
        }
      } catch (e) {
        console.error('Error loading fixtures:', e);
      }
    } else {
      setFixtures([]);
    }
  };

  useEffect(() => {
    loadLocalStorageData();

    const handleStorageChange = () => {
      loadLocalStorageData();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Update default modeled states based on actual synced finances
  useEffect(() => {
    if (finances) {
      setCashVal(finances.cash || 0);
      setSponsorsVal(finances.sponsorsIncome || 0);
      setInterestVal(finances.interestReceived || 0);
      setStaffWagesVal(finances.staffWages || 0);
      setSimPR(finances.prOfficers || 0);
      setSimFA(finances.finAdvisors || 0);
      setSimBat(finances.battingCoaches || 0);
      setSimBowl(finances.bowlingCoaches || 0);
      setSimField(finances.fieldingCoaches || 0);
      setSimKeep(finances.keepingCoaches || 0);
      setSimStam(finances.staminaCoaches || 0);
      setSimPsych(finances.psychologists || 0);
    }
  }, [finances]);

  // Player Wages update based on official synced finances first, fallback to squad sum
  useEffect(() => {
    if (finances && finances.playerWages !== undefined && finances.playerWages > 0) {
      setPlayerWagesVal(finances.playerWages);
    } else if (importedPlayers.length > 0) {
      const sum = importedPlayers.reduce((acc, p) => acc + p.wage, 0);
      setPlayerWagesVal(sum);
    } else {
      setPlayerWagesVal(26850);
    }
  }, [importedPlayers, finances]);

  // Set default interactive schedules
  useEffect(() => {
    const initialVenues: Record<number, 'Home' | 'Away'> = {};
    const initialTypes: Record<number, string> = {};
    const initialOpponents: Record<number, string> = {};

    for (let w = 1; w <= 16; w++) {
      const fixtureIdx = w - 1;
      if (fixtures[fixtureIdx]) {
        initialVenues[w] = fixtures[fixtureIdx].venue;
        initialTypes[w] = fixtures[fixtureIdx].type || 'One Day';
        initialOpponents[w] = fixtures[fixtureIdx].opponent || 'Opponent Club';
      } else {
        initialVenues[w] = w % 2 === 1 ? 'Home' : 'Away';
        initialTypes[w] = w % 3 === 1 ? 'One Day' : w % 3 === 2 ? 'First Class' : 'Twenty20';
        initialOpponents[w] = `Club Match ${w}`;
      }
    }
    setCustomVenues(initialVenues);
    setCustomTypes(initialTypes);
    setCustomOpponents(initialOpponents);
  }, [fixtures]);

  // Reset interactive modeling sliders back to synced baseline
  const resetToSyncedFinances = () => {
    if (finances) {
      setCashVal(finances.cash || 0);
      setSponsorsVal(finances.sponsorsIncome || 0);
      setInterestVal(finances.interestReceived || 0);
      setStaffWagesVal(finances.staffWages || 0);
      
      if (finances.playerWages !== undefined && finances.playerWages > 0) {
        setPlayerWagesVal(finances.playerWages);
      } else if (importedPlayers.length > 0) {
        const sum = importedPlayers.reduce((acc, p) => acc + p.wage, 0);
        setPlayerWagesVal(sum);
      } else {
        setPlayerWagesVal(26850);
      }
    } else {
      // Demo defaults
      setCashVal(4521850);
      setSponsorsVal(42500);
      setInterestVal(1250);
      setPlayerWagesVal(26850);
      setStaffWagesVal(7500);
    }

    // Reset pricing
    setTerracingPrice(15);
    setGrassPrice(21);
    setSeatsPrice(35);
    setBoxesPrice(120);

    // Reset rates
    setFcAttendanceRate(60);
    setOdAttendanceRate(85);
    setT20AttendanceRate(95);
    setCupAttendanceRate(80);
    setFriendlyAttendanceRate(25);

    // Reset venues to default synced schedule
    const initialVenues: Record<number, 'Home' | 'Away'> = {};
    const initialTypes: Record<number, string> = {};
    const initialOpponents: Record<number, string> = {};

    for (let w = 1; w <= 16; w++) {
      const fixtureIdx = w - 1;
      if (fixtures[fixtureIdx]) {
        initialVenues[w] = fixtures[fixtureIdx].venue;
        initialTypes[w] = fixtures[fixtureIdx].type || 'One Day';
        initialOpponents[w] = fixtures[fixtureIdx].opponent || 'Opponent Club';
      } else {
        initialVenues[w] = w % 2 === 1 ? 'Home' : 'Away';
        initialTypes[w] = w % 3 === 1 ? 'One Day' : w % 3 === 2 ? 'First Class' : 'Twenty20';
        initialOpponents[w] = `Club Match ${w}`;
      }
    }
    setCustomVenues(initialVenues);
    setCustomTypes(initialTypes);
    setCustomOpponents(initialOpponents);
  };

  // Weekly Ground Maintenance cost in Battrick:
  // Terracing: £0.10/seat, Grass: £0.20/seat, Covered Seats: £0.50/seat, VIP Boxes: £10.00/box
  const weeklyMaintCost = (stadium.terracing * 0.10) + 
                          (stadium.grass * 0.20) + 
                          (stadium.seats * 0.50) + 
                          (stadium.boxes * 10.00);

  // Helper to resolve attendance occupancy factor for a match type
  const getAttendanceRate = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('first class') || t.includes('fc') || t === '3day') return fcAttendanceRate / 100;
    if (t.includes('twenty20') || t.includes('t20')) return t20AttendanceRate / 100;
    if (t.includes('cup')) return cupAttendanceRate / 100;
    if (t.includes('friendly')) return friendlyAttendanceRate / 100;
    return odAttendanceRate / 100; // Standard One Day/OD default
  };

  // Helper to calculate gate receipts based on game details and ticketing variables
  const calculateGateReceipts = (isHome: boolean, matchType: string) => {
    if (!isHome) return 0;
    
    const rate = getAttendanceRate(matchType);
    const tSeats = Math.round(stadium.terracing * rate);
    const gSeats = Math.round(stadium.grass * rate);
    const cSeats = Math.round(stadium.seats * rate);
    const bSeats = Math.round(stadium.boxes * rate);

    const rawRevenue = (tSeats * terracingPrice) + 
                       (gSeats * grassPrice) + 
                       (cSeats * seatsPrice) + 
                       (bSeats * boxesPrice);

    // In Battrick, gate receipts for Friendly and Cup matches are split 50/50
    const lowerType = matchType.toLowerCase();
    if (lowerType.includes('friendly') || lowerType.includes('cup')) {
      return Math.round(rawRevenue * 0.5);
    }
    return Math.round(rawRevenue);
  };

  // Helper to calculate projected total attendance headcount
  const calculateTotalAttendance = (matchType: string) => {
    const rate = getAttendanceRate(matchType);
    return Math.round(stadium.capacity * rate);
  };

  // --- CALCULATION FOR 16-WEEK CASHFLOW FORWARD LOOKING (WITH STAFF OPTIMIZERS) ---
  // Derived baseline for sponsors income (PR affects this)
  const currentPR = finances?.prOfficers || 0;
  const currentFA = finances?.finAdvisors || 0;
  const baseSponsorsIncome = finances ? (finances.sponsorsIncome / (1 + 0.03 * currentPR)) : sponsorsVal;
  
  // Simulated Sponsors Income per week
  const simSponsorsIncome = baseSponsorsIncome * (1 + 0.03 * simPR);
  const currentSponsorsIncome = baseSponsorsIncome * (1 + 0.03 * currentPR);

  // Derived baseline for staff wages
  // Staff salaries are computed at £1,250 per week per staff member
  const currentOtherStaffCount = finances
    ? (finances.bowlingCoaches || 0) + 
      (finances.battingCoaches || 0) + 
      (finances.fieldingCoaches || 0) + 
      (finances.keepingCoaches || 0) + 
      (finances.staminaCoaches || 0) + 
      (finances.psychologists || 0)
    : Math.max(0, Math.round(staffWagesVal / 1250) - currentPR - currentFA);

  const simStaffCount = currentOtherStaffCount + simPR + simFA;
  const simStaffWages = simStaffCount * 1250;
  const currentStaffCount = currentOtherStaffCount + currentPR + currentFA;
  const currentStaffWages = currentStaffCount * 1250;

  // 1. Calculate main simulated ledger week-by-week
  let runningCash = cashVal;
  const projectionData = Array.from({ length: 16 }, (_, idx) => {
    const weekNum = idx + 1;
    const isHome = customVenues[weekNum] === 'Home';
    const matchType = customTypes[weekNum] || 'One Day';
    const opponent = customOpponents[weekNum] || `Opponent ${weekNum}`;
    
    // Revenue parameters (Sponsors and interest update dynamically based on staff and reserves)
    const sponsors = simSponsorsIncome;
    const gate = calculateGateReceipts(isHome, matchType);
    const interest = Math.floor(Math.min(10000000, runningCash) * (0.0005 + 0.0005 * simFA));
    const totalRev = sponsors + gate + interest;

    // Expense parameters
    const players = playerWagesVal;
    const staff = simStaffWages;
    const maintenance = weeklyMaintCost;
    const totalExp = players + staff + maintenance;

    const net = totalRev - totalExp;
    const startingCash = runningCash;
    runningCash += net;
    const projectedCash = runningCash;

    return {
      week: weekNum,
      isHome,
      opponent,
      type: matchType,
      fixture: `${matchType} vs ${opponent}`,
      sponsors,
      gate,
      interest,
      revenue: totalRev,
      expenses: totalExp,
      maintenance,
      net,
      startingCash,
      projectedCash,
    };
  });

  const ledgerData = projectionData;

  // 2. Calculate comparison baseline (with current non-simulated staff counts)
  let runningCashCurrent = cashVal;
  const currentProjectionData = Array.from({ length: 16 }, (_, idx) => {
    const weekNum = idx + 1;
    const isHome = customVenues[weekNum] === 'Home';
    const matchType = customTypes[weekNum] || 'One Day';
    
    const sponsors = currentSponsorsIncome;
    const gate = calculateGateReceipts(isHome, matchType);
    const interest = Math.floor(Math.min(10000000, runningCashCurrent) * (0.0005 + 0.0005 * currentFA));
    const totalRev = sponsors + gate + interest;

    const players = playerWagesVal;
    const staff = currentStaffWages;
    const maintenance = weeklyMaintCost;
    const totalExp = players + staff + maintenance;

    const net = totalRev - totalExp;
    runningCashCurrent += net;

    return {
      week: weekNum,
      net,
      projectedCash: runningCashCurrent
    };
  });

  // Compute aggregate planning metrics
  const totalSeasonNet = ledgerData.reduce((acc, row) => acc + row.net, 0);
  const projectedEndingCash = ledgerData[ledgerData.length - 1]?.projectedCash || cashVal;
  const homeGamesCount = ledgerData.filter((r) => r.isHome).length;
  const awayGamesCount = ledgerData.filter((r) => !r.isHome).length;
  const avgWeeklyCashflow = totalSeasonNet / 16;

  // --- COMPUTE AI RECOMMENDATIONS AND METRICS ---
  const getFinancialRecommendations = () => {
    const recs = [];
    const totalWages = playerWagesVal + staffWagesVal + weeklyMaintCost;
    const sponsorsAndInterest = sponsorsVal + interestVal;
    
    // Calculate typical away week net loss
    const awayWeekLoss = totalWages - sponsorsAndInterest;
    // Calculate survive weeks
    const weeksCushion = awayWeekLoss > 0 ? cashVal / awayWeekLoss : Infinity;

    // 1. Staff wages recommendation
    if (staffWagesVal > 15000) {
      recs.push({
        id: 'staff-trim',
        type: 'warning',
        title: 'High Staff Overheads',
        desc: `Your weekly staff salaries (£${staffWagesVal.toLocaleString()}) represent a significant cash drain. Review your backroom staff; dismissing redundant coaches or PR officers can save valuable weekly capital.`,
        action: 'Trimming backroom staff'
      });
    }

    // 2. Roster Over-scaling Check
    const avgHomeGate = ledgerData.filter(r => r.isHome).reduce((sum, r) => sum + r.gate, 0) / (homeGamesCount || 1);
    if (playerWagesVal > sponsorsVal + (avgHomeGate / 2)) {
      recs.push({
        id: 'wage-deficit',
        type: 'danger',
        title: 'Structural Wage Deficit',
        desc: `Your player salaries (£${playerWagesVal.toLocaleString()}) exceed your typical weekly recurring revenues (Sponsors + average home ticket sales). Your team depends on away week savings to stay afloat. Consider trading older, high-wage players or trimming secondary squad reserves.`,
        action: 'Rationalize roster size'
      });
    } else if (playerWagesVal > 35000) {
      recs.push({
        id: 'high-skill-scale',
        type: 'info',
        title: 'Exponential Wage Warning',
        desc: `At superb skill levels and above, player wages scale exponentially. Make sure your highest-paid players are performing as crucial match-winners, rather than bench-warming.`,
        action: 'Review high-wage players'
      });
    }

    // 3. Cash cushion warning
    if (weeksCushion < 4) {
      recs.push({
        id: 'critical-cash',
        type: 'danger',
        title: 'Critical Away-Week Cushion',
        desc: `Your bank capital can support only ${weeksCushion.toFixed(1)} consecutive Away weeks of losses. If your fixtures deliver several Away games in a row, you face a severe cash crunch. Reduce your player salaries immediately.`,
        action: 'Raise emergency funds / Sell players'
      });
    } else if (weeksCushion < 8) {
      recs.push({
        id: 'low-cash-cushion',
        type: 'warning',
        title: 'Modest Cash Cushion',
        desc: `Your current cash cushion is ${weeksCushion.toFixed(1)} Away weeks. To safeguard against long periods of Away games, aim to build reserves supporting at least 8-10 weeks of wages.`,
        action: 'Build reserves reserve'
      });
    }

    // 4. Stadium expansion potential
    if (finances && finances.members > 1000 && avgHomeGate < 50000 && cashVal > 750000) {
      recs.push({
        id: 'stadium-potential',
        type: 'success',
        title: 'Stadium Revenue Potential',
        desc: `With ${finances.members.toLocaleString()} club members and healthy cash reserves, your stadium ticket yield is a bottleneck. Expanding seating according to optimal ratios will directly raise your ticket revenue to support your squad.`,
        action: 'Invest in seating expansion'
      });
    }

    // Default healthy feedback
    if (recs.length === 0) {
      recs.push({
        id: 'all-healthy',
        type: 'success',
        title: 'Excellent Financial Health',
        desc: 'Your weekly expenses are perfectly supported by your recurring sponsors and gate revenue. Your cash cushion is safe, and your club is in a strong position to invest in trainees.',
        action: 'Maintain current budget'
      });
    }

    return recs;
  };

  const recommendations = getFinancialRecommendations();

  return (
    <div className="flex flex-col gap-6 animate-fadeIn" id="wage-and-finance-view">
      
      {/* Sub-tab Selection Header */}
      <div className="flex border-b border-slate-200 bg-white p-1 rounded-xl shadow-sm gap-2">
        <button
          onClick={() => setSubTab('forecast')}
          className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-2 rounded-lg cursor-pointer ${
            subTab === 'forecast' 
              ? 'bg-blue-50 text-blue-700 border border-blue-100/60' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4.5 h-4.5" />
          Financial Projections & Cashflow Forecast
        </button>
        <button
          onClick={() => setSubTab('health')}
          className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-2 rounded-lg cursor-pointer ${
            subTab === 'health' 
              ? 'bg-blue-50 text-blue-700 border border-blue-100/60' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Shield className="w-4.5 h-4.5" />
          Club Health & Backroom Staff Audit
        </button>
      </div>

      {subTab === 'forecast' ? (
        <>
          {/* Synchronized Notice Banner */}
          <div>
            {!finances ? (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-indigo-950 shadow-sm">
                <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Using Sandbox Finance Baseline</span>
                  <span className="leading-relaxed">To view your actual club projections, go to the <strong className="text-indigo-900">Roster Sync</strong> tab and paste your Club Finances ledger. Showing a standard Battrick club scenario below for planning.</span>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-950 shadow-sm">
                <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Club Financial Ledger & Roster Synced!</span>
                  <span className="leading-relaxed">Model interactive forecasts using your real synchronized parameters and upcoming Battrick fixtures. Customize ticket prices and ground occupancy below!</span>
                </div>
              </div>
            )}
          </div>

      {/* Key Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">Current Reserves</span>
            <span className="font-mono text-lg font-bold text-slate-800">£{cashVal.toLocaleString()}</span>
          </div>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Landmark className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">Projected Season Net</span>
            <span className={`font-mono text-lg font-bold ${totalSeasonNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totalSeasonNet >= 0 ? '+' : ''}£{totalSeasonNet.toLocaleString()}
            </span>
          </div>
          <div className={`p-2 rounded-lg ${totalSeasonNet >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {totalSeasonNet >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">Ending Bank Balance</span>
            <span className={`font-mono text-lg font-bold ${projectedEndingCash >= cashVal ? 'text-emerald-600' : 'text-indigo-600'}`}>
              £{projectedEndingCash.toLocaleString()}
            </span>
          </div>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">Venues Balance</span>
            <span className="font-mono text-sm font-bold text-slate-700">
              {homeGamesCount} Home / {awayGamesCount} Away
            </span>
          </div>
          <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Interactive Stadium Variables & Ticket Pricing Control Area (Requested!) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <button 
          onClick={() => setShowVariablesPanel(!showVariablesPanel)}
          className="w-full flex justify-between items-center font-display font-bold text-sm text-slate-800"
        >
          <span className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-600" />
            Ground Attendance & Ticket Pricing Variables
          </span>
          {showVariablesPanel ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showVariablesPanel && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-5 pt-4 border-t border-slate-100">
            {/* Ticket Prices Columns */}
            <div className="md:col-span-6 flex flex-col gap-4 text-xs">
              <h4 className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interactive Ticket Pricing (£ per seat)</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Terracing (Standing)</label>
                  <input
                    type="number"
                    value={terracingPrice}
                    onChange={(e) => setTerracingPrice(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Grass Banks (Uncovered)</label>
                  <input
                    type="number"
                    value={grassPrice}
                    onChange={(e) => setGrassPrice(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Covered Seats</label>
                  <input
                    type="number"
                    value={seatsPrice}
                    onChange={(e) => setSeatsPrice(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Executive Boxes (VIP)</label>
                  <input
                    type="number"
                    value={boxesPrice}
                    onChange={(e) => setBoxesPrice(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Attendance occupancy percentages Columns */}
            <div className="md:col-span-6 flex flex-col gap-4 text-xs">
              <h4 className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Estimated Attendance % by Game Type</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-600">First Class (FC)</span>
                    <span className="font-mono text-indigo-600 font-bold">{fcAttendanceRate}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="5"
                    value={fcAttendanceRate}
                    onChange={(e) => setFcAttendanceRate(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-100 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-600">One Day (OD)</span>
                    <span className="font-mono text-indigo-600 font-bold">{odAttendanceRate}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="5"
                    value={odAttendanceRate}
                    onChange={(e) => setOdAttendanceRate(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-100 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-600">Twenty20 (T20)</span>
                    <span className="font-mono text-indigo-600 font-bold">{t20AttendanceRate}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="5"
                    value={t20AttendanceRate}
                    onChange={(e) => setT20AttendanceRate(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-100 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-600">Cup Matches</span>
                    <span className="font-mono text-indigo-600 font-bold">{cupAttendanceRate}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="5"
                    value={cupAttendanceRate}
                    onChange={(e) => setCupAttendanceRate(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-100 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-slate-600">Friendlies</span>
                    <span className="font-mono text-indigo-600 font-bold">{friendlyAttendanceRate}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="5"
                    value={friendlyAttendanceRate}
                    onChange={(e) => setFriendlyAttendanceRate(parseInt(e.target.value))}
                    className="w-full h-1 bg-slate-100 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="bg-slate-50 border border-slate-150 p-2.5 rounded text-[10px] text-slate-500 flex flex-col justify-center leading-normal">
                  <span className="font-semibold text-slate-700">Stadium Maintenance:</span>
                  <span>£{weeklyMaintCost.toLocaleString()} paid every week</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="cashflow-planner-panel">
        
        {/* Left Column: Financial Modeling Parameters & Recommendations */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Scenario Modeling Parameters */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5 font-mono">
                <Scale className="w-4 h-4 text-indigo-600" />
                Scenario Modeling
              </h3>
              <button
                onClick={resetToSyncedFinances}
                className="text-[10px] font-semibold font-mono text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded transition cursor-pointer"
              >
                Reset to Synced
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              {/* Initial bank cash */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-600">Starting Cash (Bank Capital)</span>
                  <span className="font-mono font-bold text-indigo-600">£{cashVal.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10000000"
                  step="100000"
                  value={cashVal}
                  onChange={(e) => setCashVal(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-100 rounded accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Sponsors income */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-600">Weekly Sponsors Income</span>
                  <span className="font-mono font-bold text-emerald-600">£{sponsorsVal.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150000"
                  step="2500"
                  value={sponsorsVal}
                  onChange={(e) => setSponsorsVal(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-100 rounded accent-emerald-600 cursor-pointer"
                />
              </div>

              {/* Weekly Player wages */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-600">
                    Squad Wages 
                    {finances?.playerWages ? (
                      <span className="ml-1.5 text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded font-sans">Synced Expenses</span>
                    ) : importedPlayers.length > 0 ? (
                      <span className="ml-1.5 text-[9px] text-indigo-600 font-bold bg-indigo-50 px-1 rounded font-sans font-medium">Roster Sum</span>
                    ) : null}
                  </span>
                  <span className="font-mono font-bold text-rose-600">£{playerWagesVal.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150000"
                  step="2500"
                  value={playerWagesVal}
                  onChange={(e) => setPlayerWagesVal(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-100 rounded accent-rose-600 cursor-pointer"
                />
              </div>

              {/* Staff wages */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-600">Weekly Staff Salaries</span>
                  <span className="font-mono font-bold text-rose-600">£{staffWagesVal.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50000"
                  step="1000"
                  value={staffWagesVal}
                  onChange={(e) => setStaffWagesVal(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-100 rounded accent-rose-600 cursor-pointer"
                />
              </div>

              {/* Interest received */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-600">Weekly Interest Received</span>
                  <span className="font-mono font-bold text-emerald-600">£{interestVal.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="250"
                  value={interestVal}
                  onChange={(e) => setInterestVal(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-100 rounded accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Cyclical Profit Explanation block */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-slate-600 text-xs flex gap-2.5 leading-relaxed shadow-inner">
              <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-indigo-950 font-bold block mb-0.5">Battrick Finances Logic:</strong>
                Ticket sales (Gate receipts) are earned during Home matches. Away game weeks yield negative balances since salaries are paid weekly but gate receipts are 0! Friendlies & Cup matches split gate receipts 50/50.
              </div>
            </div>
          </div>

          {/* Club Financial Diagnostics & Recommendations Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5 font-mono">
                <Award className="w-4 h-4 text-emerald-600" />
                Financial Diagnostics
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Customized advice based on your current expenses & income</p>
            </div>

            <div className="flex flex-col gap-3">
              {recommendations.map((rec) => {
                const isDanger = rec.type === 'danger';
                const isWarning = rec.type === 'warning';
                const isSuccess = rec.type === 'success';

                let iconColor = 'text-sky-500 bg-sky-50 border-sky-100';
                let iconElement = <Info className="w-4 h-4" />;

                if (isDanger) {
                  iconColor = 'text-rose-600 bg-rose-50 border-rose-100';
                  iconElement = <AlertTriangle className="w-4 h-4" />;
                } else if (isWarning) {
                  iconColor = 'text-amber-600 bg-amber-50 border-amber-100';
                  iconElement = <AlertTriangle className="w-4 h-4" />;
                } else if (isSuccess) {
                  iconColor = 'text-emerald-600 bg-emerald-50 border-emerald-100';
                  iconElement = <CheckCircle className="w-4 h-4" />;
                }

                return (
                  <div key={rec.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50/60 hover:bg-slate-50 transition flex gap-3 items-start">
                    <div className={`p-1.5 rounded-lg border shrink-0 mt-0.5 ${iconColor}`}>
                      {iconElement}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-display font-extrabold text-slate-800 text-[11px] font-sans">{rec.title}</span>
                      <p className="text-[10px] text-slate-500 leading-relaxed font-sans">{rec.desc}</p>
                      {rec.action && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                          <span>Action:</span>
                          <span className={isDanger ? 'text-rose-600' : isWarning ? 'text-amber-600' : isSuccess ? 'text-emerald-600' : 'text-indigo-600'}>
                            {rec.action}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Recharts Graphs & 16-Week Ledger */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Charts Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1 font-mono">
                <LineIcon className="w-3.5 h-3.5 text-indigo-600" />
                Bank Reserves Projection
              </h4>
              <div className="h-[200px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ledgerData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={9} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(v) => `£${(v / 1000000).toFixed(2)}M`}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`£${Number(value).toLocaleString()}`, 'Bank Balance']}
                      labelFormatter={(label) => `Week ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="projectedCash" 
                      stroke="#4f46e5" 
                      strokeWidth={2} 
                      dot={{ r: 2.5, strokeWidth: 1 }} 
                      activeDot={{ r: 4 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1 font-mono">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                Net Weekly Income/Loss
              </h4>
              <div className="h-[200px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ledgerData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={9} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(v) => `${v >= 0 ? '+' : ''}£${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`£${Number(value).toLocaleString()}`, 'Net Flow']}
                      labelFormatter={(label) => `Week ${label}`}
                    />
                    <Bar dataKey="net" radius={[2, 2, 0, 0]}>
                      {ledgerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 🎯 4-Week Week-by-Week Cashflow Progression & Dynamic Staff Optimizer (User Requested) */}
          <div className="bg-slate-900 text-white rounded-xl p-5 shadow-lg border border-slate-800 flex flex-col gap-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-3">
              <div>
                <h4 className="font-display font-extrabold text-sm text-white uppercase tracking-wider flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  Interactive 4-Week Cashflow Progression
                </h4>
                <p className="text-[11px] text-slate-400 mt-1">
                  Adjust backroom staff counts below to optimize sponsors interest yields and week-by-week cashflow in real-time.
                </p>
              </div>
              
              {/* Quick staff controls inline */}
              <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-2 rounded-lg border border-slate-800">
                {/* PR simulation */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400">PR Officers</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">+{simPR * 3}% Sponsors</span>
                  </div>
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-1">
                    <button
                      type="button"
                      onClick={() => setSimPR(Math.max(0, simPR - 1))}
                      className="w-5 h-5 flex items-center justify-center font-bold text-slate-400 hover:text-white transition text-xs font-mono cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-mono text-xs font-bold text-white">{simPR}</span>
                    <button
                      type="button"
                      onClick={() => setSimPR(Math.min(10, simPR + 1))}
                      className="w-5 h-5 flex items-center justify-center font-bold text-slate-400 hover:text-white transition text-xs font-mono cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="h-6 w-[1px] bg-slate-800"></div>

                {/* FA simulation */}
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-400">Fin Advisors</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">+{simFA * 0.05}% Interest</span>
                  </div>
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded px-1">
                    <button
                      type="button"
                      onClick={() => setSimFA(Math.max(0, simFA - 1))}
                      className="w-5 h-5 flex items-center justify-center font-bold text-slate-400 hover:text-white transition text-xs font-mono cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-mono text-xs font-bold text-white">{simFA}</span>
                    <button
                      type="button"
                      onClick={() => setSimFA(Math.min(10, simFA + 1))}
                      className="w-5 h-5 flex items-center justify-center font-bold text-slate-400 hover:text-white transition text-xs font-mono cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 4-Week Week-by-Week timeline cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {ledgerData.slice(0, 4).map((week, idx) => {
                const currentWeek = currentProjectionData[idx] || { net: 0, projectedCash: cashVal };
                const netDiff = week.net - currentWeek.net;
                const isHome = week.isHome;

                return (
                  <div 
                    key={week.week} 
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-slate-700 transition duration-300 relative group overflow-hidden"
                  >
                    {/* Top status header */}
                    <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-mono font-black text-indigo-400 tracking-wider">Week {week.week}</span>
                        <span className="font-semibold text-xs text-white truncate max-w-[120px] mt-0.5" title={week.opponent}>
                          {week.opponent}
                        </span>
                      </div>
                      <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold font-mono uppercase shrink-0 ${
                        isHome 
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' 
                          : 'bg-slate-900 text-slate-400 border border-slate-800/60'
                      }`}>
                        {isHome ? '🏠 Home' : '✈️ Away'}
                      </span>
                    </div>

                    {/* Week Ledger Details */}
                    <div className="flex flex-col gap-1 text-[11px] text-slate-400 font-mono font-bold">
                      <div className="flex justify-between">
                        <span>Sponsors:</span>
                        <span className="text-slate-200">£{Math.round(week.sponsors).toLocaleString()}</span>
                      </div>
                      {isHome && (
                        <div className="flex justify-between">
                          <span>Gate Receipts:</span>
                          <span className="text-slate-200">£{Math.round(week.gate).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Interest:</span>
                        <span className="text-slate-200">£{Math.round(week.interest).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-rose-400/80">
                        <span>Expenses:</span>
                        <span>-£{Math.round(week.expenses).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Net flow indicator card block */}
                    <div className={`p-2 rounded-lg flex items-center justify-between ${
                      week.net >= 0 
                        ? 'bg-emerald-950/40 border border-emerald-900/40 text-emerald-400' 
                        : 'bg-rose-950/40 border border-rose-900/40 text-rose-400'
                    }`}>
                      <div className="flex flex-col">
                        <span className="text-[8px] uppercase font-sans font-bold opacity-80">Weekly Net</span>
                        <span className="font-mono text-xs font-black">
                          {week.net >= 0 ? '+' : ''}£{week.net.toLocaleString()}
                        </span>
                      </div>
                      
                      {/* Cost difference / delta vs baseline */}
                      {netDiff !== 0 && (
                        <div className="text-right flex flex-col">
                          <span className="text-[7.5px] uppercase font-sans font-bold opacity-80">Staff Delta</span>
                          <span className={`text-[10px] font-mono font-bold ${netDiff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {netDiff > 0 ? '+' : ''}£{netDiff.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Ending Cash balance for the week */}
                    <div className="flex justify-between items-center text-[10.5px] border-t border-slate-900 pt-2 font-mono">
                      <span className="text-slate-500 text-[10px]">Ending Balance:</span>
                      <span className="font-bold text-slate-300">£{week.projectedCash.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive 16-Week Season Ledger Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">
                  16-Week Match Ledger & Cash Projection (Fixtures Integrated)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Adjust venues, match types, or opponents per week to refine your forecast!</p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-mono font-bold sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-3 w-12">Week</th>
                    <th className="p-3 w-48">Opponent</th>
                    <th className="p-3 w-32">Match Type</th>
                    <th className="p-3 w-24">Venue</th>
                    <th className="p-3">Projected Attendance</th>
                    <th className="p-3">Weekly Net Flow</th>
                    <th className="p-3 text-right">Ending Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {ledgerData.map((row) => (
                    <tr key={row.week} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono font-bold text-slate-500">{row.week}</td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={row.opponent}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomOpponents(prev => ({ ...prev, [row.week]: val }));
                          }}
                          className="font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full p-0.5 transition"
                        />
                      </td>
                      <td className="p-3">
                        <select
                          value={row.type}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomTypes(prev => ({ ...prev, [row.week]: val }));
                          }}
                          className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="One Day">One Day</option>
                          <option value="First Class">First Class</option>
                          <option value="Twenty20">Twenty20</option>
                          <option value="Cup">Cup Match</option>
                          <option value="Friendly">Friendly</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => {
                            setCustomVenues(prev => ({
                              ...prev,
                              [row.week]: prev[row.week] === 'Home' ? 'Away' : 'Home'
                            }));
                          }}
                          className={`px-2 py-1 rounded text-[9px] font-bold font-mono tracking-wide uppercase transition cursor-pointer flex items-center justify-center w-full gap-1 border ${
                            row.isHome
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Click to toggle venue home/away"
                        >
                          <span>{row.isHome ? '🏠 Home' : '✈️ Away'}</span>
                        </button>
                      </td>
                      <td className="p-3 font-mono">
                        {row.isHome ? (
                          <div>
                            <div className="font-semibold text-indigo-700">
                              {calculateTotalAttendance(row.type).toLocaleString()} / {stadium.capacity.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              ({(getAttendanceRate(row.type) * 100).toFixed(0)}% Occupancy)
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No attendance (Away)</span>
                        )}
                      </td>
                      <td className="p-3 font-mono">
                        <div className="flex flex-col">
                          <span className={`font-bold ${
                            row.net >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {row.net >= 0 ? '+' : ''}£{row.net.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Rev: +£{row.revenue.toLocaleString()} | Exp: -£{row.expenses.toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-slate-900 font-bold text-right">
                        £{row.projectedCash.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  ) : (
        /* CLUB HEALTH & STAFF AUDIT SUB-TAB VIEW */
        <div className="flex flex-col gap-6" id="club-health-and-staff-subview">
          
          {/* Help notice if not synced */}
          {!finances && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4.5 flex items-start gap-3 text-xs text-indigo-950 shadow-sm">
              <Info className="w-5.5 h-5.5 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <span className="font-bold block text-sm mb-1">Sandbox Environment Details</span>
                <span className="leading-relaxed text-slate-600">
                  This sub-tab provides backroom staff optimization recommendations and wage efficiency calculations. To analyze your actual squad, go to the <strong className="text-slate-800">Roster Sync</strong> tab and import your Battrick club or finance page. Below is a simulated club profile for planning purposes.
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* COLUMN 1: Financial Cockpit Ledgers */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              
              {/* Club Stats Summary Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Coins className="w-4.5 h-4.5 text-indigo-600" />
                  Weekly Revenue & Expense Ledger
                </h3>

                <div className="flex flex-col gap-2.5 bg-slate-50/60 p-4 rounded-lg border border-slate-100">
                  <div className="flex justify-between text-xs font-semibold border-b border-slate-200 pb-2 text-slate-700">
                    <span>Account Balance</span>
                    <span className="font-mono text-indigo-700 font-bold">
                      £{(finances?.cash ?? cashVal).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Sponsors Income:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      £{(finances?.sponsorsIncome ?? sponsorsVal).toLocaleString()}/wk
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Average Gate Receipts:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      £{(finances?.gateReceipts ?? 48000).toLocaleString()}/wk
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Bank Interest Yield:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      £{(finances?.interestReceived ?? interestVal).toLocaleString()}/wk
                    </span>
                  </div>
                  <div className="border-t border-slate-200/60 my-1"></div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Player Salary Bill:</span>
                    <span className="font-mono text-rose-600 font-medium">
                      -£{(finances?.playerWages ?? playerWagesVal).toLocaleString()}/wk
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Staff Salary Bill:</span>
                    <span className="font-mono text-rose-600 font-medium">
                      -£{(finances?.staffWages ?? staffWagesVal).toLocaleString()}/wk
                    </span>
                  </div>
                  <div className="flex justify-between text-xs font-bold pt-2.5 border-t border-slate-200">
                    <span>Net Weekly Flow</span>
                    <span className={`font-mono ${
                      ((finances?.sponsorsIncome ?? sponsorsVal) + (finances?.gateReceipts ?? 48000) + (finances?.interestReceived ?? interestVal)) -
                      ((finances?.playerWages ?? playerWagesVal) + (finances?.staffWages ?? staffWagesVal)) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      £{(((finances?.sponsorsIncome ?? sponsorsVal) + (finances?.gateReceipts ?? 48000) + (finances?.interestReceived ?? interestVal)) -
                        ((finances?.playerWages ?? playerWagesVal) + (finances?.staffWages ?? staffWagesVal))).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 leading-relaxed bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/40">
                  💡 <strong>Tip:</strong> Home matches happen every other week. In away weeks, your ticket gate receipts drop to zero, so your weekly balance fluctuates. Optimize advisors and staff wages to build a cushion!
                </div>
              </div>

              {/* Wage Efficiency Ratio Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-3">
                <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Scale className="w-4.5 h-4.5 text-indigo-600" />
                  Wage Efficiency Ratio
                </h3>

                {(() => {
                  const income = (finances?.sponsorsIncome ?? sponsorsVal) + (finances?.gateReceipts ?? 48000) + (finances?.interestReceived ?? interestVal);
                  const wages = finances?.playerWages ?? playerWagesVal;
                  const ratio = income > 0 ? (wages / income) * 100 : 0;
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600 font-semibold">Roster Wage Overhead Ratio</span>
                        <span className={`font-mono font-bold ${ratio > 60 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {ratio.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${ratio > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, ratio)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        {ratio > 60 
                          ? '⚠️ Your player salaries absorb a significant portion of club revenues. Dismiss excess squad reserves, sell non-essential high-wage veterans, or optimize PR staff to increase fan counts.' 
                          : '✅ Excellent! Your squad wages are well-balanced and easily supported by sponsors and gate yields.'}
                      </p>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* COLUMN 2: Backroom Staff Audit & Optimal Advice Panel */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              
              {/* Backroom Staff Audit Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-5">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Award className="w-5 h-5 text-indigo-600" />
                    Backroom Staff Optimization Audit
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Staff salaries are computed at a fixed rate of <strong className="text-slate-700">£1,250 per week per staff member</strong>. Overstaffing leads to wasted wages, while understaffing leaves sponsor income or investment yields on the table.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* FA Block */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">Financial Advisors</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded">
                          Cost: £1,250/wk each
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-slate-500">Currently Hired:</span>
                        <span className="font-mono font-bold text-sm text-slate-800">{(finances?.finAdvisors ?? 0)} FAs</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-3.5">
                        <span className="text-xs text-slate-500">Optimal Target:</span>
                        <span className="font-mono font-bold text-sm text-indigo-700">{getFAAdvice().optimal} FAs</span>
                      </div>
                      <p className={`text-xs font-semibold leading-relaxed p-2.5 rounded-lg bg-white border border-slate-100 ${getFAAdvice().color}`}>
                        {getFAAdvice().status}
                      </p>
                    </div>
                  </div>

                  {/* PR Block */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">PR Officers</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded">
                          Cost: £1,250/wk each
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-slate-500">Currently Hired:</span>
                        <span className="font-mono font-bold text-sm text-slate-800">{(finances?.prOfficers ?? 0)} PRs</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-3.5">
                        <span className="text-xs text-slate-500">Optimal Target:</span>
                        <span className="font-mono font-bold text-sm text-indigo-700">{getPRAdvice().optimal} PRs</span>
                      </div>
                      <p className={`text-xs font-semibold leading-relaxed p-2.5 rounded-lg bg-white border border-slate-100 ${getPRAdvice().color}`}>
                        {getPRAdvice().status}
                      </p>
                    </div>
                  </div>

                  {/* Batting Coaches Block */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">Batting Coaches</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded">
                          Cost: £1,250/wk each
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-slate-500">Currently Hired:</span>
                        <span className="font-mono font-bold text-sm text-slate-800">{(finances?.battingCoaches ?? 0)} Coaches</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-3.5">
                        <span className="text-xs text-slate-500">Optimal Target:</span>
                        <span className="font-mono font-bold text-sm text-indigo-700">{getBattingCoachesAdvice().optimal} Coaches</span>
                      </div>
                      <p className={`text-xs font-semibold leading-relaxed p-2.5 rounded-lg bg-white border border-slate-100 ${getBattingCoachesAdvice().color}`}>
                        {getBattingCoachesAdvice().status}
                      </p>
                    </div>
                  </div>

                  {/* Bowling Coaches Block */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">Bowling Coaches</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded">
                          Cost: £1,250/wk each
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-slate-500">Currently Hired:</span>
                        <span className="font-mono font-bold text-sm text-slate-800">{(finances?.bowlingCoaches ?? 0)} Coaches</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-3.5">
                        <span className="text-xs text-slate-500">Optimal Target:</span>
                        <span className="font-mono font-bold text-sm text-indigo-700">{getBowlingCoachesAdvice().optimal} Coaches</span>
                      </div>
                      <p className={`text-xs font-semibold leading-relaxed p-2.5 rounded-lg bg-white border border-slate-100 ${getBowlingCoachesAdvice().color}`}>
                        {getBowlingCoachesAdvice().status}
                      </p>
                    </div>
                  </div>

                  {/* Fielding Coaches Block */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">Fielding Coaches</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded">
                          Cost: £1,250/wk each
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-slate-500">Currently Hired:</span>
                        <span className="font-mono font-bold text-sm text-slate-800">{(finances?.fieldingCoaches ?? 0)} Coaches</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-3.5">
                        <span className="text-xs text-slate-500">Optimal Target:</span>
                        <span className="font-mono font-bold text-sm text-indigo-700">{getFieldingCoachesAdvice().optimal} Coaches</span>
                      </div>
                      <p className={`text-xs font-semibold leading-relaxed p-2.5 rounded-lg bg-white border border-slate-100 ${getFieldingCoachesAdvice().color}`}>
                        {getFieldingCoachesAdvice().status}
                      </p>
                    </div>
                  </div>

                  {/* Wicket Keeping Coaches Block */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">Keeper Coaches</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded">
                          Cost: £1,250/wk each
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-slate-500">Currently Hired:</span>
                        <span className="font-mono font-bold text-sm text-slate-800">{(finances?.keepingCoaches ?? 0)} Coaches</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-3.5">
                        <span className="text-xs text-slate-500">Optimal Target:</span>
                        <span className="font-mono font-bold text-sm text-indigo-700">{getKeepingCoachesAdvice().optimal} Coaches</span>
                      </div>
                      <p className={`text-xs font-semibold leading-relaxed p-2.5 rounded-lg bg-white border border-slate-100 ${getKeepingCoachesAdvice().color}`}>
                        {getKeepingCoachesAdvice().status}
                      </p>
                    </div>
                  </div>

                  {/* Stamina Coaches Block */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">Stamina Coaches</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded">
                          Cost: £1,250/wk each
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-slate-500">Currently Hired:</span>
                        <span className="font-mono font-bold text-sm text-slate-800">{(finances?.staminaCoaches ?? 0)} Coaches</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-3.5">
                        <span className="text-xs text-slate-500">Optimal Target:</span>
                        <span className="font-mono font-bold text-sm text-indigo-700">{getStaminaCoachesAdvice().optimal} Coaches</span>
                      </div>
                      <p className={`text-xs font-semibold leading-relaxed p-2.5 rounded-lg bg-white border border-slate-100 ${getStaminaCoachesAdvice().color}`}>
                        {getStaminaCoachesAdvice().status}
                      </p>
                    </div>
                  </div>

                  {/* Psychologists Block */}
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
                        <span className="font-bold text-xs text-slate-700 uppercase tracking-wider font-mono">Sports Psychologists</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded">
                          Cost: £1,250/wk each
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline mb-2">
                        <span className="text-xs text-slate-500">Currently Hired:</span>
                        <span className="font-mono font-bold text-sm text-slate-800">{(finances?.psychologists ?? 0)} Staff</span>
                      </div>
                      <div className="flex justify-between items-baseline mb-3.5">
                        <span className="text-xs text-slate-500">Optimal Target:</span>
                        <span className="font-mono font-bold text-sm text-indigo-700">{getPsychologistsAdvice().optimal} Staff</span>
                      </div>
                      <p className={`text-xs font-semibold leading-relaxed p-2.5 rounded-lg bg-white border border-slate-100 ${getPsychologistsAdvice().color}`}>
                        {getPsychologistsAdvice().status}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl">
                  <strong className="text-slate-800">How Advisor Optimization works:</strong>
                  <ul className="list-disc pl-4.5 mt-2 space-y-1.5 text-[11px]">
                    <li><strong>Financial Advisors:</strong> Directly increase your weekly bank balance interest payout. If you hold low reserves under £750k, FAs are unnecessary. At higher reserves, they are highly profitable.</li>
                    <li><strong>PR Officers:</strong> Keep sponsors and fans extremely happy. High fan satisfaction increases your weekly ticket revenues and sponsors pay.</li>
                  </ul>
                </div>
              </div>

              {/* Backroom Staff Interactive Simulator Tool */}
              {finances && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                  <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Settings2 className="w-5 h-5 text-indigo-600" />
                    Interactive Staff Optimization Simulator
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Drag the sliders to model changes in your backroom staff counts and see the net weekly effect on your budget before enacting changes in the real game!
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Simulate PR Officers:</span>
                        <span className="font-mono font-bold text-indigo-700">{simPR} hired (£{(simPR * 1250).toLocaleString()}/wk)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={simPR}
                        onChange={(e) => setSimPR(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Simulate Financial Advisors:</span>
                        <span className="font-mono font-bold text-indigo-700">{simFA} hired (£{(simFA * 1250).toLocaleString()}/wk)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={simFA}
                        onChange={(e) => setSimFA(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Simulate Batting Coaches:</span>
                        <span className="font-mono font-bold text-indigo-700">{simBat} hired (£{(simBat * 1250).toLocaleString()}/wk)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={simBat}
                        onChange={(e) => setSimBat(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Simulate Bowling Coaches:</span>
                        <span className="font-mono font-bold text-indigo-700">{simBowl} hired (£{(simBowl * 1250).toLocaleString()}/wk)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={simBowl}
                        onChange={(e) => setSimBowl(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Simulate Fielding Coaches:</span>
                        <span className="font-mono font-bold text-indigo-700">{simField} hired (£{(simField * 1250).toLocaleString()}/wk)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        value={simField}
                        onChange={(e) => setSimField(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Simulate Keeper Coaches:</span>
                        <span className="font-mono font-bold text-indigo-700">{simKeep} hired (£{(simKeep * 1250).toLocaleString()}/wk)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        value={simKeep}
                        onChange={(e) => setSimKeep(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Simulate Stamina Coaches:</span>
                        <span className="font-mono font-bold text-indigo-700">{simStam} hired (£{(simStam * 1250).toLocaleString()}/wk)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        value={simStam}
                        onChange={(e) => setSimStam(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="font-semibold text-slate-700">Simulate Psychologists:</span>
                        <span className="font-mono font-bold text-indigo-700">{simPsych} hired (£{(simPsych * 1250).toLocaleString()}/wk)</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        value={simPsych}
                        onChange={(e) => setSimPsych(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {(() => {
                    const currentPR = finances.prOfficers || 0;
                    const currentFA = finances.finAdvisors || 0;
                    const currentBat = finances.battingCoaches || 0;
                    const currentBowl = finances.bowlingCoaches || 0;
                    const currentField = finances.fieldingCoaches || 0;
                    const currentKeep = finances.keepingCoaches || 0;
                    const currentStam = finances.staminaCoaches || 0;
                    const currentPsych = finances.psychologists || 0;

                    const totalSimulatedCount = simPR + simFA + simBat + simBowl + simField + simKeep + simStam + simPsych;
                    const totalCurrentCount = currentPR + currentFA + currentBat + currentBowl + currentField + currentKeep + currentStam + currentPsych;
                    const diffWages = (totalSimulatedCount - totalCurrentCount) * 1250;

                    // Calculate simulated vs current interest received (capped at 10M cash)
                    const cashForInterest = Math.min(10000000, finances.cash || 0);
                    const simInterestRate = 0.0005 + (0.0005 * simFA);
                    const simInterestEarned = Math.floor(cashForInterest * simInterestRate);

                    const currInterestRate = 0.0005 + (0.0005 * currentFA);
                    const currInterestEarned = Math.floor(cashForInterest * currInterestRate);
                    
                    const diffInterest = simInterestEarned - currInterestEarned;
                    const netBenefit = diffInterest - diffWages;
                    
                    return (
                      <div className="mt-2 bg-indigo-50/40 border border-indigo-100/50 p-4 rounded-xl text-xs flex flex-col gap-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-indigo-100/30 pb-3">
                          <div>
                            <span className="font-bold text-indigo-950 block text-sm">Simulated Staff Overhead Delta</span>
                            <span className="text-slate-500 text-[11px] leading-relaxed block mt-0.5">
                              Simulated overhead wages: <strong className="text-slate-700">£{(totalSimulatedCount * 1250).toLocaleString()}/wk</strong> ({totalSimulatedCount} total backroom staff) vs Current: <strong className="text-slate-700">£{(totalCurrentCount * 1250).toLocaleString()}/wk</strong>.
                            </span>
                          </div>
                          <div className="text-left md:text-right mt-2 md:mt-0 shrink-0">
                            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Weekly Cost Shift</span>
                            <span className={`font-mono text-base font-extrabold ${diffWages > 0 ? 'text-rose-600' : diffWages < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                              {diffWages > 0 ? '+' : ''}£{diffWages.toLocaleString()} / week
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          <div className="bg-white border border-slate-200/60 rounded-lg p-3 flex flex-col justify-between">
                            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-1">Staff Wage Change</span>
                            <div className="flex justify-between items-baseline">
                              <span className="font-mono font-bold text-sm text-slate-700">
                                {diffWages > 0 ? 'Cost Up' : diffWages < 0 ? 'Savings' : 'No Change'}
                              </span>
                              <span className={`font-mono text-sm font-bold ${diffWages > 0 ? 'text-rose-600' : diffWages < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                {diffWages > 0 ? '−' : diffWages < 0 ? '+' : ''}£{Math.abs(diffWages).toLocaleString()}/wk
                              </span>
                            </div>
                          </div>

                          <div className="bg-white border border-slate-200/60 rounded-lg p-3 flex flex-col justify-between">
                            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-1">Interest Revenue Change</span>
                            <div className="flex justify-between items-baseline">
                              <span className="font-mono font-bold text-sm text-slate-700">
                                {diffInterest > 0 ? 'Yield Up' : diffInterest < 0 ? 'Yield Down' : 'No Change'}
                              </span>
                              <span className={`font-mono text-sm font-bold ${diffInterest > 0 ? 'text-emerald-600' : diffInterest < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                                {diffInterest > 0 ? '+' : diffInterest < 0 ? '−' : ''}£{Math.abs(diffInterest).toLocaleString()}/wk
                              </span>
                            </div>
                          </div>

                          <div className="bg-indigo-950 text-white rounded-lg p-3 flex flex-col justify-between col-span-1 sm:col-span-2 md:col-span-1 shadow-sm">
                            <span className="text-[10px] uppercase font-mono font-bold text-indigo-200 block mb-1">Net Weekly Outcome</span>
                            <div className="flex justify-between items-baseline">
                              <span className="font-mono font-semibold text-xs text-indigo-100">Overall Profit Delta</span>
                              <span className={`font-mono text-sm font-black ${netBenefit > 0 ? 'text-emerald-400' : netBenefit < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                                {netBenefit > 0 ? '+' : ''}£{netBenefit.toLocaleString()}/wk
                              </span>
                            </div>
                          </div>
                        </div>

                        {finances.cash < 2500000 && simFA > 0 && (
                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200/50 p-2.5 rounded-lg text-amber-800 text-[10.5px] leading-relaxed">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Efficiency Warning:</strong> Your cash reserves (£{finances.cash.toLocaleString()}) are below the £2,500,000 threshold. Simulated Financial Advisors cost more in wages than they recover in extra interest, leading to a negative net weekly outcome.
                            </span>
                          </div>
                        )}

                        {finances.cash >= 2500000 && simFA < 10 && (
                          <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200/50 p-2.5 rounded-lg text-indigo-900 text-[10.5px] leading-relaxed">
                            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                            <span>
                              <strong>Optimization Tip:</strong> Your cash reserves (£{finances.cash.toLocaleString()}) are above the £2.5M threshold. Simulating 10 Financial Advisors will yield more than their wages in extra interest, maximizing your net weekly profit!
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>

          </div>

        </div>
      )}
    </div>
  );
}
