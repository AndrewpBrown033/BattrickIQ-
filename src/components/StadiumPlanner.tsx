import React, { useState, useEffect } from 'react';
import { StadiumConfig, ClubFinances } from '../types';
import { 
  Landmark, 
  ArrowUpRight, 
  Calculator, 
  Coins, 
  BarChart3, 
  HelpCircle, 
  Users, 
  TrendingUp, 
  Info,
  ChevronRight,
  TrendingDown,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';

interface StadiumPlannerProps {
  setActiveTab?: (tab: 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'rules' | 'admin') => void;
}

export default function StadiumPlanner({ setActiveTab }: StadiumPlannerProps = {}) {
  // Current stadium specs synced from Ground Page Import
  const [stadium, setStadium] = useState<StadiumConfig>({
    terracing: 6000,
    grass: 3000,
    seats: 800,
    boxes: 200,
    capacity: 10000,
  });

  const [members, setMembers] = useState<number>(600);
  const [prOfficers, setPrOfficers] = useState<number>(0);
  const [teamMorale, setTeamMorale] = useState<string>('respectable');
  const [sponsorsMood, setSponsorsMood] = useState<string>('respectable');
  const [leagueTier, setLeagueTier] = useState<'rebuild' | 'mid' | 'top3' | 'championship'>('mid');
  const [syncMessage, setSyncMessage] = useState<{ text: string; success: boolean } | null>(null);
  
  // Option to show growth projections
  const [showGrowth, setShowGrowth] = useState<boolean>(true);
  const [projectPrOfficers, setProjectPrOfficers] = useState<number>(0);

  const showSyncMessage = (text: string, success: boolean) => {
    setSyncMessage({ text, success });
    setTimeout(() => setSyncMessage(null), 6000);
  };

  // Load from local storage and listen to storage updates
  useEffect(() => {
    const handleStorageChange = () => {
      const savedStadium = localStorage.getItem('bt_stadium');
      if (savedStadium) {
        try {
          setStadium(JSON.parse(savedStadium));
        } catch (e) {
          console.error(e);
          setStadium({
            terracing: 6000,
            grass: 3000,
            seats: 800,
            boxes: 200,
            capacity: 10000,
          });
        }
      } else {
        setStadium({
          terracing: 6000,
          grass: 3000,
          seats: 800,
          boxes: 200,
          capacity: 10000,
        });
      }

      const savedFinances = localStorage.getItem('bt_finances');
      if (savedFinances) {
        try {
          const fin = JSON.parse(savedFinances) as ClubFinances;
          const safeMembers = fin.members > 0 && fin.members < 500000 ? fin.members : (fin.members >= 500000 ? 1500 : 0);
          if (safeMembers > 0) {
            setMembers(safeMembers);
          }
          if (fin.prOfficers !== undefined) {
            setPrOfficers(fin.prOfficers);
            setProjectPrOfficers(fin.prOfficers);
          }
          if (fin.morale) {
            setTeamMorale(fin.morale);
          }
          if (fin.sponsorsMood) {
            setSponsorsMood(fin.sponsorsMood);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        setMembers(1000);
        setPrOfficers(0);
        setProjectPrOfficers(0);
        setTeamMorale('respectable');
        setSponsorsMood('respectable');
      }
    };

    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const saveStadiumConfig = (newConfig: StadiumConfig) => {
    setStadium(newConfig);
    localStorage.setItem('bt_stadium', JSON.stringify(newConfig));
    // Dispatch storage and cloud backup events
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('bt_cloud_backup_request'));
  };

  const syncWithFinances = () => {
    const savedFinances = localStorage.getItem('bt_finances');
    if (savedFinances) {
      try {
        const fin = JSON.parse(savedFinances) as ClubFinances;
        const safeMembers = fin.members > 0 && fin.members < 500000 ? fin.members : (fin.members >= 500000 ? 1500 : 0);
        if (safeMembers > 0) {
          setMembers(safeMembers);
          if (fin.prOfficers !== undefined) {
            setPrOfficers(fin.prOfficers);
            setProjectPrOfficers(fin.prOfficers);
          }
          if (fin.morale) {
            setTeamMorale(fin.morale);
          }
          if (fin.sponsorsMood) {
            setSponsorsMood(fin.sponsorsMood);
          }
          showSyncMessage(`Successfully synced members (${safeMembers.toLocaleString()}), PR staff (${fin.prOfficers}), morale (${fin.morale}), and sponsors mood (${fin.sponsorsMood}) from finances!`, true);
        } else {
          showSyncMessage('No member count found in finances. Please sync your finances page in the Roster Sync tab first.', false);
        }
      } catch (e) {
        showSyncMessage('Failed to parse club finances.', false);
      }
    } else {
      showSyncMessage('No club finances found. Please sync your finances page in the Roster Sync tab first.', false);
    }
  };

  // Seating distribution ratios (Wombat/Battrick optimal standard)
  const terracingRatio = 0.60;
  const grassRatio = 0.30;
  const seatsRatio = 0.08;
  const boxesRatio = 0.02;

  // Pricing per seating type
  const terracingPrice = 15;
  const grassPrice = 21;
  const seatsPrice = 35;
  const boxesPrice = 120;

  // Seating construction costs
  const terracingBuildCost = 25;
  const grassBuildCost = 50;
  const seatsBuildCost = 100;
  const boxesBuildCost = 1000;

  // Seating weekly maintenance costs
  const terracingMaintCost = 0.10;
  const grassMaintCost = 0.20;
  const seatsMaintCost = 0.50;
  const boxesMaintCost = 10.00;

  // Seating coefficient per performance tier
  const getCapacityFactor = (tier: 'rebuild' | 'mid' | 'top3' | 'championship') => {
    if (tier === 'rebuild') return 13;
    if (tier === 'mid') return 15;
    if (tier === 'top3') return 17;
    return 20; // Championship
  };

  const factor = getCapacityFactor(leagueTier);
  const recommendedCapacity = Math.round(members * factor);

  // Suggested optimal breakdown of recommended size
  const recTerracing = Math.round(recommendedCapacity * terracingRatio);
  const recGrass = Math.round(recommendedCapacity * grassRatio);
  const recSeats = Math.round(recommendedCapacity * seatsRatio);
  const recBoxes = Math.round(recommendedCapacity * boxesRatio);
  const recTotalCalculated = recTerracing + recGrass + recSeats + recBoxes;

  // Difference calculator
  const diffTerracing = Math.max(0, recTerracing - stadium.terracing);
  const diffGrass = Math.max(0, recGrass - stadium.grass);
  const diffSeats = Math.max(0, recSeats - stadium.seats);
  const diffBoxes = Math.max(0, recBoxes - stadium.boxes);

  // Expansion costs
  const costTerracing = diffTerracing * terracingBuildCost;
  const costGrass = diffGrass * grassBuildCost;
  const costSeats = diffSeats * seatsBuildCost;
  const costBoxes = diffBoxes * boxesBuildCost;
  const totalBuildCost = costTerracing + costGrass + costSeats + costBoxes;

  // Weekly maintenance costs
  const currentWeeklyMaint = (stadium.terracing * terracingMaintCost) +
                             (stadium.grass * grassMaintCost) +
                             (stadium.seats * seatsMaintCost) +
                             (stadium.boxes * boxesMaintCost);

  const recommendedWeeklyMaint = (recTerracing * terracingMaintCost) +
                                 (recGrass * grassMaintCost) +
                                 (recSeats * seatsMaintCost) +
                                 (recBoxes * boxesMaintCost);

  // Maximum single-match ticket revenue
  const currentMaxRevenue = (stadium.terracing * terracingPrice) +
                            (stadium.grass * grassPrice) +
                            (stadium.seats * seatsPrice) +
                            (stadium.boxes * boxesPrice);

  const recommendedMaxRevenue = (recTerracing * terracingPrice) +
                                (recGrass * grassPrice) +
                                (recSeats * seatsPrice) +
                                (recBoxes * boxesPrice);

  // Seating breakdown chart data
  const chartData = [
    {
      name: 'Terracing (60%)',
      Current: stadium.terracing,
      Optimal: recTerracing,
    },
    {
      name: 'Grass Banks (30%)',
      Current: stadium.grass,
      Optimal: recGrass,
    },
    {
      name: 'Seats (8%)',
      Current: stadium.seats,
      Optimal: recSeats,
    },
    {
      name: 'VIP Boxes (2%)',
      Current: stadium.boxes,
      Optimal: recBoxes,
    },
  ];

  // --- GROWTH PROJECTIONS CALCULATION ENGINE ---
  // Base growth rate of members per week in Battrick (depends on squad tier success)
  const getBaseGrowth = (tier: 'rebuild' | 'mid' | 'top3' | 'championship') => {
    if (tier === 'rebuild') return 5;
    if (tier === 'mid') return 10;
    if (tier === 'top3') return 18;
    return 25; // Championship winning streak
  };

  const getMoraleBonus = (morale: string) => {
    const m = morale.toLowerCase();
    if (m.includes('sublime') || m.includes('ecstatic') || m.includes('sensational')) return 0.10;
    if (m.includes('superb') || m.includes('pleased') || m.includes('delighted')) return 0.05;
    if (m.includes('low') || m.includes('poor') || m.includes('shattered') || m.includes('abysmal')) return -0.10;
    return 0.0; // respectable, moderate, etc.
  };

  const getSponsorsBonus = (mood: string) => {
    const m = mood.toLowerCase();
    if (m.includes('ecstatic') || m.includes('delighted') || m.includes('sublime')) return 0.15;
    if (m.includes('pleased') || m.includes('satisfied') || m.includes('happy')) return 0.05;
    if (m.includes('irritated') || m.includes('unhappy') || m.includes('abysmal')) return -0.15;
    return 0.0; // respectable, moderate, etc.
  };

  const baseGrowthRate = getBaseGrowth(leagueTier);
  // PR Officers bonus: each PR officer up to 10 yields +12% weekly member growth rate
  const prBonusPercentage = Math.min(10, projectPrOfficers) * 0.12;
  const moraleBonus = getMoraleBonus(teamMorale);
  const sponsorsBonus = getSponsorsBonus(sponsorsMood);
  const totalBonusPercentage = prBonusPercentage + moraleBonus + sponsorsBonus;
  const weeklyGrowthRate = Math.max(1, Math.round(baseGrowthRate * (1 + totalBonusPercentage)));

  // Timeline points for projections (up to 32 weeks / 2 Seasons)
  const projectionTimeline = [0, 4, 8, 12, 16, 20, 24, 28, 32];
  
  const growthChartData = projectionTimeline.map(week => {
    const projectedM = members + Math.round(weeklyGrowthRate * week);
    const projectedCap = Math.round(projectedM * factor);
    return {
      week: `Week ${week}`,
      weekNum: week,
      'Projected Members': projectedM,
      'Recommended Capacity': projectedCap,
      'Current Capacity': stadium.capacity,
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fadeIn" id="stadium-planner-container">
      {syncMessage && (
        <div className={`col-span-12 p-3.5 rounded-xl flex items-center justify-between gap-2 text-xs font-semibold ${
          syncMessage.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-100 animate-scaleUp' : 'bg-rose-50 text-rose-800 border border-rose-100 animate-scaleUp'
        }`}>
          <span>{syncMessage.text}</span>
          {!syncMessage.success && setActiveTab && (
            <button
              onClick={() => setActiveTab('sync')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-indigo-700 border border-slate-200 rounded text-[10px] font-bold transition cursor-pointer shrink-0"
            >
              Go to Roster Sync
            </button>
          )}
        </div>
      )}

      {/* Left Sidebar Inputs Column */}
      <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-6">
        
        {/* Sync Status Info Banner */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Club Sync Status</span>
            {members > 0 && stadium.capacity > 0 ? (
              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded">GROUND SYNCED</span>
            ) : (
              <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded">DEFAULT DATA</span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Stadium estimator calculates recommendations using synced Battrick Ground sizes and club member records.
          </p>
        </div>

        {/* Stadium Config Input Form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2">
              <Landmark className="w-4.5 h-4.5 text-indigo-600" />
              Current Ground Specs
            </h3>
            {setActiveTab && (
              <button
                onClick={() => setActiveTab('sync')}
                className="text-[10px] text-indigo-600 font-bold hover:underline"
              >
                Upload Ground
              </button>
            )}
          </div>

          <div className="flex flex-col gap-3.5 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-600 font-semibold">Terracing (Standing)</span>
                <span className="text-[10px] text-slate-400">Ratio: {((stadium.terracing / (stadium.capacity || 1)) * 100).toFixed(0)}%</span>
              </div>
              <input
                id="stadium-input-terracing"
                type="number"
                value={stadium.terracing}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value) || 0);
                  saveStadiumConfig({ ...stadium, terracing: val, capacity: val + stadium.grass + stadium.seats + stadium.boxes });
                }}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-600 font-semibold">Grass Banks (Uncovered)</span>
                <span className="text-[10px] text-slate-400">Ratio: {((stadium.grass / (stadium.capacity || 1)) * 100).toFixed(0)}%</span>
              </div>
              <input
                id="stadium-input-grass"
                type="number"
                value={stadium.grass}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value) || 0);
                  saveStadiumConfig({ ...stadium, grass: val, capacity: stadium.terracing + val + stadium.seats + stadium.boxes });
                }}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-600 font-semibold">Seating (Covered)</span>
                <span className="text-[10px] text-slate-400">Ratio: {((stadium.seats / (stadium.capacity || 1)) * 100).toFixed(0)}%</span>
              </div>
              <input
                id="stadium-input-seats"
                type="number"
                value={stadium.seats}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value) || 0);
                  saveStadiumConfig({ ...stadium, seats: val, capacity: stadium.terracing + stadium.grass + val + stadium.boxes });
                }}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-600 font-semibold">Executive Boxes (VIP)</span>
                <span className="text-[10px] text-slate-400">Ratio: {((stadium.boxes / (stadium.capacity || 1)) * 100).toFixed(0)}%</span>
              </div>
              <input
                id="stadium-input-boxes"
                type="number"
                value={stadium.boxes}
                onChange={(e) => {
                  const val = Math.max(0, parseInt(e.target.value) || 0);
                  saveStadiumConfig({ ...stadium, boxes: val, capacity: stadium.terracing + stadium.grass + stadium.seats + val });
                }}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-lg flex justify-between items-center font-bold text-slate-800 mt-1">
              <span>Ground Capacity</span>
              <span className="font-mono text-indigo-700">{stadium.capacity.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Current Target Estimator Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <Calculator className="w-4.5 h-4.5 text-indigo-600" />
              Target Calculator
            </h3>
            <button
              onClick={syncWithFinances}
              className="text-[10px] text-indigo-600 font-bold hover:underline"
            >
              Sync Members
            </button>
          </div>

          <div className="flex flex-col gap-4 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-600 font-semibold">Active Club Members</label>
                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                  Current
                </span>
              </div>
              <input
                id="stadium-input-members"
                type="number"
                value={members}
                onChange={(e) => setMembers(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1.5">League Status / Tier</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'rebuild', label: 'Rebuild (13x)', desc: 'Losing season' },
                  { id: 'mid', label: 'Mid-Table (15x)', desc: 'Moderate squad' },
                  { id: 'top3', label: 'Top 3 (17x)', desc: 'Winning season' },
                  { id: 'championship', label: 'Champ (20x)', desc: 'Elite division' },
                ].map(tier => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setLeagueTier(tier.id as any)}
                    className={`p-2 border rounded text-left transition duration-150 ${
                      leagueTier === tier.id
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-semibold shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span className="block font-bold text-[11px]">{tier.label}</span>
                    <span className="text-[9px] text-slate-400 block">{tier.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg">
              <span className="text-[10px] uppercase font-bold text-indigo-900 tracking-wider block">Recommended Capacity</span>
              <div className="text-xl font-extrabold text-indigo-950 font-mono mt-1">
                {recommendedCapacity.toLocaleString()} <span className="text-xs font-normal text-slate-500">Seats</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                Based on <strong className="text-slate-800">{members.toLocaleString()} members</strong> × <strong className="text-slate-800">{factor} seating coefficient</strong>.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Right Column: Dashboard & Graphs */}
      <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-6">
        
        {/* Toggle to Enable Growth Projections Option */}
        <div className="bg-indigo-950 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3">
            <div className="p-2.5 bg-indigo-900 border border-indigo-700/80 rounded-xl h-fit">
              <TrendingUp className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h4 className="font-display font-extrabold text-sm flex items-center gap-1.5 text-white">
                Member Growth & Seating Projections
                <span className="text-[9px] font-mono font-bold bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded uppercase">PRO</span>
              </h4>
              <p className="text-indigo-200 text-xs mt-0.5 max-w-lg">
                Model how your fan club and stadium requirements grow week-by-week depending on your PR staff hired and pitch-side performance.
              </p>
            </div>
          </div>
          
          <button
            id="toggle-growth-projections"
            onClick={() => setShowGrowth(!showGrowth)}
            className={`px-4 py-2 rounded-lg font-bold text-xs cursor-pointer transition duration-150 shrink-0 ${
              showGrowth 
                ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-md' 
                : 'bg-white hover:bg-slate-100 text-indigo-950 border border-slate-200'
            }`}
          >
            {showGrowth ? 'Hide Growth Options' : 'Show Growth Options'}
          </button>
        </div>

        {/* Dynamic Growth Panel */}
        {showGrowth && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-scaleUp">
            
            {/* PR Officers & Performance Growth Config Card */}
            <div className="md:col-span-5 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
              <h3 className="font-display font-bold text-sm text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Users className="w-4.5 h-4.5 text-indigo-600" />
                Growth Parameters
              </h3>

              <div className="flex flex-col gap-4 text-xs">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-600 font-semibold">PR Officers (Staff Hired)</span>
                    <span className="font-mono font-bold bg-slate-100 px-2.5 py-0.5 rounded text-slate-700">{projectPrOfficers} staff</span>
                  </div>
                  
                  {/* Staff count slider */}
                  <input
                    id="slider-growth-pr"
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={projectPrOfficers}
                    onChange={(e) => setProjectPrOfficers(parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono mt-1">
                    <span>0 (No bonus)</span>
                    <span>5 (Optimal)</span>
                    <span>10 (Max)</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>How PR Staff Boosts Fans</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Each PR Officer hired gives a <strong className="text-indigo-900">+12% bonus</strong> to weekly member growth (up to <strong className="text-indigo-900">120% max bonus</strong> at 10 PRs). 
                  </p>
                  <div className="border-t border-slate-200/60 pt-2 flex flex-col gap-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Base Weekly Growth:</span>
                      <span className="font-mono text-slate-700 font-bold">+{baseGrowthRate} fans</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">PR Staff Multiplier:</span>
                      <span className="font-mono text-emerald-600 font-bold">+{Math.round(prBonusPercentage * 100)}%</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Team Morale ({teamMorale}):</span>
                      <span className={`font-mono font-bold ${moraleBonus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {moraleBonus >= 0 ? '+' : ''}{Math.round(moraleBonus * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Sponsors Mood ({sponsorsMood}):</span>
                      <span className={`font-mono font-bold ${sponsorsBonus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {sponsorsBonus >= 0 ? '+' : ''}{Math.round(sponsorsBonus * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] border-t border-dashed border-slate-200 mt-1 pt-1 font-bold text-slate-800">
                      <span>Projected Growth Rate:</span>
                      <span className="font-mono text-indigo-600">+{weeklyGrowthRate} members/wk</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Growth Curves Projection Chart */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                  <TrendingUp className="w-4.5 h-4.5 text-indigo-600" />
                  Recommended Capacity Timeline (32 Weeks)
                </h3>
                <div className="h-52 w-full font-sans text-[10px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={growthChartData}
                      margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="week" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <ReferenceLine y={stadium.capacity} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: "Current Stadium Limit", position: 'top', fill: '#f43f5e', fontSize: 9 }} />
                      <Area type="monotone" dataKey="Recommended Capacity" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorCap)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 italic leading-snug mt-2">
                Plot showing optimal seating target curve over time. Where the indigo line crosses the dashed pink line indicates when you will start losing gate revenue due to undercapacity!
              </p>
            </div>

            {/* Stadium Expansion Growth Timeline Table */}
            <div className="col-span-12 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="font-display font-bold text-xs text-indigo-950 flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Growth Milestones & Projected Construction Cost Forecast
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="pb-2 text-left">Milestone Timeline</th>
                      <th className="pb-2 text-right">Projected Members</th>
                      <th className="pb-2 text-right">Recommended Capacity</th>
                      <th className="pb-2 text-right">Standings (60%)</th>
                      <th className="pb-2 text-right">Grass (30%)</th>
                      <th className="pb-2 text-right">Covered (8%)</th>
                      <th className="pb-2 text-right">Boxes (2%)</th>
                      <th className="pb-2 text-right font-bold text-emerald-700">Estimated Building Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
                    {[
                      { label: 'Today (Wk 0)', week: 0 },
                      { label: 'Mid-Season (Wk 8)', week: 8 },
                      { label: 'Season End (Wk 16)', week: 16 },
                      { label: 'Next Season Mid (Wk 24)', week: 24 },
                      { label: 'Two Seasons Out (Wk 32)', week: 32 },
                    ].map((milestone, idx) => {
                      const projMembers = members + Math.round(weeklyGrowthRate * milestone.week);
                      const projCap = Math.round(projMembers * factor);
                      
                      const tTerr = Math.round(projCap * terracingRatio);
                      const tGras = Math.round(projCap * grassRatio);
                      const tSeat = Math.round(projCap * seatsRatio);
                      const tBox = Math.round(projCap * boxesRatio);

                      // Calculate cost from current stadium specs
                      const dTerr = Math.max(0, tTerr - stadium.terracing);
                      const dGras = Math.max(0, tGras - stadium.grass);
                      const dSeat = Math.max(0, tSeat - stadium.seats);
                      const dBox = Math.max(0, tBox - stadium.boxes);

                      const projCost = (dTerr * terracingBuildCost) +
                                       (dGras * grassBuildCost) +
                                       (dSeat * seatsBuildCost) +
                                       (dBox * boxesBuildCost);

                      return (
                        <tr key={idx} className={milestone.week === 0 ? 'bg-slate-50 font-bold text-slate-900' : ''}>
                          <td className="py-2.5 font-sans font-semibold text-slate-700 text-left">{milestone.label}</td>
                          <td className="py-2.5 text-right">{projMembers.toLocaleString()}</td>
                          <td className="py-2.5 text-right font-bold text-slate-800">{projCap.toLocaleString()}</td>
                          <td className="py-2.5 text-right text-slate-500">{tTerr.toLocaleString()}</td>
                          <td className="py-2.5 text-right text-slate-500">{tGras.toLocaleString()}</td>
                          <td className="py-2.5 text-right text-slate-500">{tSeat.toLocaleString()}</td>
                          <td className="py-2.5 text-right text-slate-500">{tBox.toLocaleString()}</td>
                          <td className={`py-2.5 text-right font-bold ${projCost > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {projCost > 0 ? `£${projCost.toLocaleString()}` : '£0 (Fully Covered)'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Recommended Seating Breakdown & Cost Sheet */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-display font-bold text-sm text-slate-800 border-b border-slate-100 pb-3 mb-4 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4.5 h-4.5 text-emerald-600" />
              Expansion Cost & Optimal Seating Ratios
            </span>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              Wombat Optimal Distribution
            </span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="pb-2.5">Category</th>
                  <th className="pb-2.5 font-mono">Ratio</th>
                  <th className="pb-2.5 text-right">Current</th>
                  <th className="pb-2.5 text-right font-medium text-slate-800">Target</th>
                  <th className="pb-2.5 text-right text-indigo-600 font-bold">Build Needed</th>
                  <th className="pb-2.5 text-right">Unit Fee</th>
                  <th className="pb-2.5 text-right font-bold text-emerald-700">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 font-semibold text-slate-700">Terracing (Standing Room)</td>
                  <td className="py-2.5 font-mono text-slate-500">60%</td>
                  <td className="py-2.5 text-right font-mono">{stadium.terracing.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-mono font-semibold text-slate-800">{recTerracing.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-indigo-700">+{diffTerracing.toLocaleString()}</td>
                  <td className="py-2.5 text-right text-slate-400 font-mono">£{terracingBuildCost}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-700">£{costTerracing.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-slate-700">Grass Banks (Uncovered)</td>
                  <td className="py-2.5 font-mono text-slate-500">30%</td>
                  <td className="py-2.5 text-right font-mono">{stadium.grass.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-mono font-semibold text-slate-800">{recGrass.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-indigo-700">+{diffGrass.toLocaleString()}</td>
                  <td className="py-2.5 text-right text-slate-400 font-mono">£{grassBuildCost}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-700">£{costGrass.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-slate-700">Seating (Covered)</td>
                  <td className="py-2.5 font-mono text-slate-500">8%</td>
                  <td className="py-2.5 text-right font-mono">{stadium.seats.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-mono font-semibold text-slate-800">{recSeats.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-indigo-700">+{diffSeats.toLocaleString()}</td>
                  <td className="py-2.5 text-right text-slate-400 font-mono">£{seatsBuildCost}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-700">£{costSeats.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="py-2.5 font-semibold text-slate-700">Executive Boxes (VIP)</td>
                  <td className="py-2.5 font-mono text-slate-500">2%</td>
                  <td className="py-2.5 text-right font-mono">{stadium.boxes.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-mono font-semibold text-slate-800">{recBoxes.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-indigo-700">+{diffBoxes.toLocaleString()}</td>
                  <td className="py-2.5 text-right text-slate-400 font-mono">£{boxesBuildCost}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-700">£{costBoxes.toLocaleString()}</td>
                </tr>
                <tr className="font-bold border-t-2 border-slate-200 bg-slate-50">
                  <td className="py-3 pl-2 text-indigo-950">Total Combined Capacity</td>
                  <td className="py-3 font-mono text-indigo-950">100%</td>
                  <td className="py-3 text-right font-mono">{stadium.capacity.toLocaleString()}</td>
                  <td className="py-3 text-right font-mono text-slate-800">{recTotalCalculated.toLocaleString()}</td>
                  <td className="py-3 text-right font-mono text-indigo-700">
                    +{ (diffTerracing + diffGrass + diffSeats + diffBoxes).toLocaleString() }
                  </td>
                  <td className="py-3"></td>
                  <td className="py-3 pr-2 text-right font-mono text-emerald-700 text-sm">
                    £{totalBuildCost.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Seating Distribution Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h4 className="font-display font-bold text-xs text-slate-800 flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            Comparison Chart: Current Setup vs. Target Distribution
          </h4>
          <div className="h-60 w-full font-sans text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                <YAxis stroke="#64748b" tickLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Current" fill="#cbd5e1" name="Current Seats" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Optimal" fill="#4f46e5" name="Recommended Target" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Outcome Estimator Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Max Ticket Yield Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Max Match Ticket Revenue</span>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] text-slate-400">Current Setup:</span>
                <div className="text-sm font-bold font-mono text-slate-700">£{currentMaxRevenue.toLocaleString()}</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] text-indigo-600 font-medium">Optimal Setup:</span>
                <div className="text-base font-extrabold font-mono text-indigo-700">£{recommendedMaxRevenue.toLocaleString()}</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic mt-1 leading-snug">
              Yields are calculated using ideal gate prices: Terracing £15, Grass £21, Seats £35, Boxes £120. Standard sold-out matches.
            </p>
          </div>

          {/* Maintenance Fee Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weekly Ground Maintenance Fees</span>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[10px] text-slate-400">Current Setup:</span>
                <div className="text-sm font-bold font-mono text-slate-700">£{currentWeeklyMaint.toLocaleString()}/wk</div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] text-indigo-600 font-medium">Optimal Setup:</span>
                <div className="text-base font-extrabold font-mono text-indigo-700">£{recommendedWeeklyMaint.toLocaleString()}/wk</div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic mt-1 leading-snug">
              Running fees per seat: Terracing £0.10, Grass £0.20, Seats £0.50, Boxes £10.00. Unsold seats pay full running fees.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
