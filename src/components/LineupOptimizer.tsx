import React, { useState, useEffect } from 'react';
import { SKILL_LEVELS, LineupPlayer, BattrickPlayer } from '../types';
import { Users, Shield, Copy, Check, Info, ChevronDown, ChevronUp, RefreshCw, UserCheck } from 'lucide-react';

const DEFAULT_LINEUP: LineupPlayer[] = [
  { id: '1', name: 'A. Alistair', role: 'Batter', batting: 8, bowling: 0, keeping: 0, fielding: 5, stamina: 6, experience: 7, bowlingType: 'None', order: 1 },
  { id: '2', name: 'B. Bradman', role: 'Batter', batting: 9, bowling: 0, keeping: 0, fielding: 5, stamina: 7, experience: 8, bowlingType: 'None', order: 2 },
  { id: '3', name: 'C. Cowdrey', role: 'Batter', batting: 7, bowling: 0, keeping: 0, fielding: 5, stamina: 6, experience: 5, bowlingType: 'None', order: 3 },
  { id: '4', name: 'D. Dexter', role: 'Batter', batting: 11, bowling: 1, keeping: 0, fielding: 5, stamina: 8, experience: 7, bowlingType: 'None', order: 4 },
  { id: '5', name: 'E. Edrich', role: 'All-rounder', batting: 7, bowling: 12, keeping: 0, fielding: 5, stamina: 8, experience: 8, bowlingType: 'Fast', order: 5 },
  { id: '6', name: 'F. Flintoff', role: 'All-rounder', batting: 8, bowling: 14, keeping: 0, fielding: 5, stamina: 9, experience: 9, bowlingType: 'Fast Medium', order: 6 },
  { id: '7', name: 'G. Gilchrist', role: 'Keeper', batting: 5, bowling: 0, keeping: 9, fielding: 7, stamina: 7, experience: 5, bowlingType: 'None', order: 7 },
  { id: '8', name: 'H. Hadlee', role: 'Bowler', batting: 3, bowling: 15, keeping: 0, fielding: 5, stamina: 8, experience: 12, bowlingType: 'Fast', order: 8 },
  { id: '9', name: 'I. Imran', role: 'Bowler', batting: 5, bowling: 17, keeping: 0, fielding: 5, stamina: 11, experience: 13, bowlingType: 'Fast Medium', order: 9 },
  { id: '10', name: 'J. Johnston', role: 'Bowler', batting: 1, bowling: 12, keeping: 0, fielding: 5, stamina: 7, experience: 5, bowlingType: 'Spin', order: 10 },
  { id: '11', name: 'K. Kumble', role: 'Bowler', batting: 1, bowling: 14, keeping: 0, fielding: 5, stamina: 8, experience: 7, bowlingType: 'Spin', order: 11 },
];

const PRESET_STRATEGIES = [
  {
    name: 'Balanced Attack',
    desc: 'Standard squad with stable batting order and balanced spin/seam split.',
  },
  {
    name: 'Spin Dominance',
    desc: 'Perfect for dusty or cracked pitches. Stacks up to 3 high-quality spin options.',
  },
  {
    name: 'Green Top Blitzers',
    desc: 'Engineered for green pitches. Features seam & fast bowlers with high bowling skills.',
  },
  {
    name: 'Batting Powerhouse',
    desc: 'Extends batting depth up to spot 8. Great for flat pitches, sacrifices bowling depth.',
  },
];

// Helper function to dynamically generate a lineup XI based on a specific strategy and squad roster
function generateLineupForStrategy(strategyName: string, players: BattrickPlayer[]): LineupPlayer[] {
  if (!players || players.length === 0) {
    switch (strategyName) {
      case 'Balanced Attack':
        return DEFAULT_LINEUP;
      case 'Spin Dominance':
        return DEFAULT_LINEUP.map((p) => {
          if (['8', '9', '10', '11'].includes(p.id)) {
            return { ...p, bowlingType: 'Spin' as const, bowling: Math.min(20, p.bowling + 1) };
          }
          return p;
        });
      case 'Green Top Blitzers':
        return DEFAULT_LINEUP.map((p) => {
          if (['5', '6', '8', '9'].includes(p.id)) {
            return { ...p, bowlingType: 'Fast' as const, bowling: Math.min(20, p.bowling + 2) };
          }
          return p;
        });
      case 'Batting Powerhouse':
        return DEFAULT_LINEUP.map((p) => {
          if (p.order <= 5) return { ...p, batting: Math.min(20, p.batting + 2) };
          if (p.order <= 8) return { ...p, batting: Math.min(20, p.batting + 1), role: 'All-rounder' as const };
          return p;
        });
      default:
        return DEFAULT_LINEUP;
    }
  }

  // 1. Find Wicketkeeper (highest keeping, with batting as tie-breaker)
  const sortedKeepers = [...players].sort((a, b) => {
    if (b.skills.keeping !== a.skills.keeping) return b.skills.keeping - a.skills.keeping;
    return b.skills.batting - a.skills.batting;
  });
  const keeper = sortedKeepers[0];

  // 2. Other players pool
  const pool = players.filter(p => p.id !== keeper.id);

  let topBatters: BattrickPlayer[] = [];
  let chosenBowlers: BattrickPlayer[] = [];

  if (strategyName === 'Spin Dominance') {
    const spins = [...pool].filter(p => p.bowlingType === 'Spin').sort((a, b) => b.skills.bowling - a.skills.bowling);
    const others = [...pool].filter(p => p.bowlingType !== 'Spin').sort((a, b) => b.skills.bowling - a.skills.bowling);
    const allBowlersSorted = [...spins, ...others];
    chosenBowlers = allBowlersSorted.slice(0, 5);

    const bowlerIds = new Set(chosenBowlers.map(p => p.id));
    const remainingBatters = pool.filter(p => !bowlerIds.has(p.id)).sort((a, b) => b.skills.batting - a.skills.batting);
    topBatters = remainingBatters.slice(0, 5);
  } 
  else if (strategyName === 'Green Top Blitzers') {
    const seams = [...pool].filter(p => ['Fast', 'Fast Medium', 'Medium'].includes(p.bowlingType)).sort((a, b) => b.skills.bowling - a.skills.bowling);
    const others = [...pool].filter(p => !['Fast', 'Fast Medium', 'Medium'].includes(p.bowlingType)).sort((a, b) => b.skills.bowling - a.skills.bowling);
    const allBowlersSorted = [...seams, ...others];
    chosenBowlers = allBowlersSorted.slice(0, 5);

    const bowlerIds = new Set(chosenBowlers.map(p => p.id));
    const remainingBatters = pool.filter(p => !bowlerIds.has(p.id)).sort((a, b) => b.skills.batting - a.skills.batting);
    topBatters = remainingBatters.slice(0, 5);
  } 
  else if (strategyName === 'Batting Powerhouse') {
    const sortedByBatting = [...pool].sort((a, b) => b.skills.batting - a.skills.batting);
    topBatters = sortedByBatting.slice(0, 7);

    const batterIds = new Set(topBatters.map(p => p.id));
    const remainingBowlers = pool.filter(p => !batterIds.has(p.id)).sort((a, b) => b.skills.bowling - a.skills.bowling);
    chosenBowlers = remainingBowlers.slice(0, 3);
  } 
  else {
    // Balanced Attack
    const sortedByBatting = [...pool].sort((a, b) => b.skills.batting - a.skills.batting);
    topBatters = sortedByBatting.slice(0, 5);

    const batterIds = new Set(topBatters.map(p => p.id));
    const remainingBowlers = pool.filter(p => !batterIds.has(p.id)).sort((a, b) => b.skills.bowling - a.skills.bowling);
    chosenBowlers = remainingBowlers.slice(0, 5);
  }

  const newXI: LineupPlayer[] = [];

  // Positions 1-5
  for (let i = 0; i < 5; i++) {
    const p = topBatters[i] || pool[i];
    if (p) {
      newXI.push({
        id: (i + 1).toString(),
        name: p.name,
        role: 'Batter',
        batting: p.skills.batting,
        bowling: p.skills.bowling,
        keeping: p.skills.keeping,
        fielding: p.skills.fielding || 5,
        btRating: p.btRating,
        fielding: p.skills.fielding || 5,
        btRating: p.btRating,
        stamina: p.skills.stamina,
        experience: p.skills.experience,
        bowlingType: p.bowlingType,
        order: i + 1,
      });
    }
  }

  // Position 6
  const b1 = chosenBowlers[0];
  if (b1) {
    newXI.push({
      id: '6',
      name: b1.name,
      role: b1.skills.batting >= 6 ? 'All-rounder' : 'Bowler',
      batting: b1.skills.batting,
      bowling: b1.skills.bowling,
      keeping: b1.skills.keeping,
      fielding: b1.skills.fielding || 5,
      btRating: b1.btRating,
      stamina: b1.skills.stamina,
      experience: b1.skills.experience,
      bowlingType: b1.bowlingType,
      order: 6,
    });
  }

  // Position 7
  newXI.push({
    id: '7',
    name: keeper.name,
    role: 'Keeper',
    batting: keeper.skills.batting,
    bowling: keeper.skills.bowling,
    keeping: keeper.skills.keeping,
    fielding: keeper.skills.fielding || 5,
    btRating: keeper.btRating,
    stamina: keeper.skills.stamina,
    experience: keeper.skills.experience,
    bowlingType: keeper.bowlingType,
    order: 7,
  });

  // Positions 8-11
  if (strategyName === 'Batting Powerhouse') {
    const p6 = topBatters[5];
    if (p6 && newXI[5]) {
      newXI[5] = {
        id: '6',
        name: p6.name,
        role: 'Batter',
        batting: p6.skills.batting,
        bowling: p6.skills.bowling,
        keeping: p6.skills.keeping,
        fielding: p6.skills.fielding || 5,
        btRating: p6.btRating,
        stamina: p6.skills.stamina,
        experience: p6.skills.experience,
        bowlingType: p6.bowlingType,
        order: 6,
      };
    }
    const p8 = topBatters[6];
    if (p8) {
      newXI.push({
        id: '8',
        name: p8.name,
        role: 'Batter',
        batting: p8.skills.batting,
        bowling: p8.skills.bowling,
        keeping: p8.skills.keeping,
        fielding: p8.skills.fielding || 5,
        btRating: p8.btRating,
        stamina: p8.skills.stamina,
        experience: p8.skills.experience,
        bowlingType: p8.bowlingType,
        order: 8,
      });
    }
    for (let i = 0; i < 3; i++) {
      const b = chosenBowlers[i];
      if (b) {
        newXI.push({
          id: (i + 9).toString(),
          name: b.name,
          role: b.skills.batting >= 6 ? 'All-rounder' : 'Bowler',
          batting: b.skills.batting,
          bowling: b.skills.bowling,
          keeping: b.skills.keeping,
          fielding: b.skills.fielding || 5,
          btRating: b.btRating,
          stamina: b.skills.stamina,
          experience: b.skills.experience,
          bowlingType: b.bowlingType,
          order: i + 9,
        });
      }
    }
  } else {
    for (let i = 1; i < 5; i++) {
      const b = chosenBowlers[i];
      if (b) {
        newXI.push({
          id: (i + 7).toString(),
          name: b.name,
          role: b.skills.batting >= 6 ? 'All-rounder' : 'Bowler',
          batting: b.skills.batting,
          bowling: b.skills.bowling,
          keeping: b.skills.keeping,
          fielding: b.skills.fielding || 5,
          btRating: b.btRating,
          stamina: b.skills.stamina,
          experience: b.skills.experience,
          bowlingType: b.bowlingType,
          order: i + 7,
        });
      }
    }
  }

  // If there are fewer than 11 players parsed, pad with default lineup players
  while (newXI.length < 11) {
    const missingOrder = newXI.length + 1;
    const padPlayer = DEFAULT_LINEUP.find(p => p.order === missingOrder) || DEFAULT_LINEUP[newXI.length];
    newXI.push({
      ...padPlayer,
      id: missingOrder.toString(),
      order: missingOrder,
    });
  }

  const sortedXI = newXI.slice(0, 11).map((p, index) => ({
    ...p,
    id: (index + 1).toString(),
    order: index + 1,
  }));

  return sortedXI;
}

interface LineupOptimizerProps {
  setActiveTab?: (tab: 'sync' | 'squad' | 'lineup' | 'wage' | 'stadium' | 'coach' | 'rules' | 'admin') => void;
}

export default function LineupOptimizer({ setActiveTab }: LineupOptimizerProps) {
  const [lineup, setLineup] = useState<LineupPlayer[]>(() => {
    const saved = localStorage.getItem('bt_squad');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return generateLineupForStrategy('Balanced Attack', parsed);
        }
      } catch (e) {}
    }
    return []; // Empty by default if wiped/no squad
  });
  const [importedPlayers, setImportedPlayers] = useState<BattrickPlayer[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load imported players from localStorage
  const loadImportedSquad = () => {
    const saved = localStorage.getItem('bt_squad');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setImportedPlayers(parsed);
          if (lineup.length === 0) {
            setLineup(generateLineupForStrategy('Balanced Attack', parsed));
          }
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }
    setImportedPlayers([]);
    setLineup([]);
  };

  useEffect(() => {
    loadImportedSquad();
    
    // Listen to localStorage changes
    const handleStorageChange = () => {
      loadImportedSquad();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handlePlayerChange = (id: string, key: keyof LineupPlayer, value: any) => {
    setLineup((prev) =>
      prev.map((player) => {
        if (player.id !== id) return player;
        return { ...player, [key]: value };
      }).map((player) => {
        // If assigning keeper, ensure others are unset from keeper role
        if (key === 'role' && value === 'Keeper' && player.id !== id && player.role === 'Keeper') {
          return { ...player, role: 'Batter' };
        }
        return player;
      })
    );
  };

  const handleSkillChange = (id: string, skill: 'batting' | 'bowling' | 'keeping' | 'stamina' | 'experience', value: number) => {
    setLineup((prev) =>
      prev.map((player) => {
        if (player.id !== id) return player;
        return { ...player, [skill]: Math.min(20, Math.max(0, value)) };
      })
    );
  };

  const assignImportedPlayer = (slotId: string, importedPlayerId: string) => {
    const selected = importedPlayers.find(p => p.id === importedPlayerId);
    if (!selected) return;

    setLineup((prev) =>
      prev.map((p) => {
        if (p.id !== slotId) return p;
        return {
          ...p,
          name: selected.name,
          role: selected.role === 'Prospect' ? 'Batter' : selected.role as any,
          batting: selected.skills.batting,
          bowling: selected.skills.bowling,
          keeping: selected.skills.keeping,
          stamina: selected.skills.stamina,
          experience: selected.skills.experience,
          bowlingType: selected.bowlingType,
        };
      })
    );
  };

  // Auto-select Best XI from imported squad based on skills
  const autoOptimizeXI = () => {
    if (importedPlayers.length === 0) return;

    // 1. Sort by best values (highest keeping, with batting as tie-breaker)
    const keepers = [...importedPlayers].sort((a, b) => {
      if (b.skills.keeping !== a.skills.keeping) return b.skills.keeping - a.skills.keeping;
      return b.skills.batting - a.skills.batting;
    });
    const primaryKeeper = keepers[0];

    const batters = [...importedPlayers]
      .filter(p => p.id !== primaryKeeper.id)
      .sort((a, b) => b.skills.batting - a.skills.batting);

    const bowlers = [...importedPlayers]
      .filter(p => p.id !== primaryKeeper.id)
      .sort((a, b) => b.skills.bowling - a.skills.bowling);

    const newXI: LineupPlayer[] = [];

    // Top order (bests batsmen)
    for (let i = 0; i < 5; i++) {
      if (batters[i]) {
        newXI.push({
          id: (i + 1).toString(),
          name: batters[i].name,
          role: 'Batter',
          batting: batters[i].skills.batting,
          bowling: batters[i].skills.bowling,
          keeping: batters[i].skills.keeping,
          stamina: batters[i].skills.stamina,
          experience: batters[i].skills.experience,
          bowlingType: batters[i].bowlingType,
          order: i + 1,
        });
      }
    }

    // Wicketkeeper (Spot 7)
    const keeperSlot: LineupPlayer = {
      id: '7',
      name: primaryKeeper.name,
      role: 'Keeper',
      batting: primaryKeeper.skills.batting,
      bowling: primaryKeeper.skills.bowling,
      keeping: primaryKeeper.skills.keeping,
      stamina: primaryKeeper.skills.stamina,
      experience: primaryKeeper.skills.experience,
      bowlingType: primaryKeeper.bowlingType,
      order: 7,
    };

    // Bowlers (bottom order)
    const assignedIds = new Set(newXI.map(p => p.name));
    assignedIds.add(primaryKeeper.name);

    let bowlerIndex = 0;
    const bowlersList = bowlers.filter(b => !assignedIds.has(b.name));

    for (let i = 0; i < 5; i++) {
      const idx = i >= 2 ? i + 6 : i + 5; // spot 5, 6, 8, 9, 10, 11
      const spotNum = idx + 1;
      const bPlayer = bowlersList[bowlerIndex];
      if (bPlayer) {
        newXI.push({
          id: spotNum.toString(),
          name: bPlayer.name,
          role: bPlayer.skills.batting >= 6 ? 'All-rounder' : 'Bowler',
          batting: bPlayer.skills.batting,
          bowling: bPlayer.skills.bowling,
          keeping: bPlayer.skills.keeping,
          stamina: bPlayer.skills.stamina,
          experience: bPlayer.skills.experience,
          bowlingType: bPlayer.bowlingType,
          order: spotNum,
        });
        bowlerIndex++;
      }
    }

    // Add Keeper in spot 7
    newXI.splice(6, 0, keeperSlot);

    // Reorder 1 to 11
    const ordered = newXI.map((p, index) => ({
      ...p,
      id: (index + 1).toString(),
      order: index + 1,
    }));

    setLineup(ordered);
    setExpandedId(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const applyStrategy = (strategyName: string) => {
    const newXI = generateLineupForStrategy(strategyName, importedPlayers);
    setLineup(newXI);
    setExpandedId(null);
  };

  // Calculations for Battrick team ratings
  const calculateTeamRatings = () => {
    const b1 = lineup[0]?.batting || 0;
    const b2 = lineup[1]?.batting || 0;
    const b3 = lineup[2]?.batting || 0;
    const b4 = lineup[3]?.batting || 0;
    const b5 = lineup[4]?.batting || 0;
    const topOrderRaw = (b1 * 0.25) + (b2 * 0.25) + (b3 * 0.20) + (b4 * 0.18) + (b5 * 0.12);

    const b6 = lineup[5]?.batting || 0;
    const b7 = lineup[6]?.batting || 0;
    const b8 = lineup[7]?.batting || 0;
    const middleOrderRaw = (b5 * 0.35) + (b6 * 0.35) + (b7 * 0.20) + (b8 * 0.10);

    const b9 = lineup[8]?.batting || 0;
    const b10 = lineup[9]?.batting || 0;
    const b11 = lineup[10]?.batting || 0;
    const lowerOrderRaw = (b9 * 0.45) + (b10 * 0.35) + (b11 * 0.20);

    const seamBowlers = lineup.filter(p => ['Fast', 'Fast Medium', 'Medium'].includes(p.bowlingType));
    let seamBowlingRaw = 0;
    if (seamBowlers.length > 0) {
      const avgSeam = seamBowlers.reduce((acc, curr) => acc + curr.bowling, 0) / seamBowlers.length;
      seamBowlingRaw = avgSeam + (Math.min(3, seamBowlers.length) * 0.45);
    }

    const spinBowlers = lineup.filter(p => p.bowlingType === 'Spin');
    let spinBowlingRaw = 0;
    if (spinBowlers.length > 0) {
      const avgSpin = spinBowlers.reduce((acc, curr) => acc + curr.bowling, 0) / spinBowlers.length;
      spinBowlingRaw = avgSpin + (Math.min(2, spinBowlers.length) * 0.55);
    }

    const keeper = lineup.find(p => p.role === 'Keeper') || lineup[6];
    const keepingRaw = (keeper?.keeping || 0) + (keeper?.experience || 0) * 0.16;

    const avgExperience = lineup.reduce((acc, curr) => acc + curr.experience, 0) / 11;
    const avgFielding = lineup.reduce((acc, curr) => acc + (curr.fielding || 5), 0) / 11;
    const fieldingRaw = avgFielding + (avgExperience * 0.1);
    
    const estimatedTotalBTR = lineup.reduce((acc, curr) => acc + (curr.btRating || 0), 0);
    const avgStamina = lineup.reduce((acc, curr) => acc + curr.stamina, 0) / 11;

    const staminaMulti = 0.94 + (avgStamina / 20) * 0.12;

    return {
      topOrder: Math.min(20, Math.max(0, topOrderRaw * staminaMulti)),
      middleOrder: Math.min(20, Math.max(0, middleOrderRaw * staminaMulti)),
      lowerOrder: Math.min(20, Math.max(0, lowerOrderRaw * staminaMulti)),
      seamBowling: Math.min(20, Math.max(0, seamBowlingRaw * staminaMulti)),
      spinBowling: Math.min(20, Math.max(0, spinBowlingRaw * staminaMulti)),
      wicketKeeping: Math.min(20, Math.max(0, keepingRaw * staminaMulti)),
      fielding: Math.min(20, Math.max(0, fieldingRaw * staminaMulti)),
      estimatedBTR: estimatedTotalBTR,
      teamExperience: avgExperience,
    };
  };

  const ratings = calculateTeamRatings();

  const getBattrickRatingLabel = (score: number) => {
    const floorIndex = Math.floor(score);
    const clampedIndex = Math.min(20, Math.max(0, floorIndex));
    const label = SKILL_LEVELS[clampedIndex];
    const decimal = score - floorIndex;

    let sub = ' (medium)';
    if (decimal < 0.35) sub = ' (low)';
    else if (decimal >= 0.65) sub = ' (high)';

    return {
      full: `${label}${sub}`,
      color: clampedIndex >= 12 ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : clampedIndex >= 7 ? 'text-indigo-700 border-indigo-200 bg-indigo-50/50' : clampedIndex >= 4 ? 'text-amber-700 border-amber-200 bg-amber-50/50' : 'text-slate-600 border-slate-200 bg-slate-50',
    };
  };

  const copySquadToClipboard = () => {
    let text = `[BattrickIQ Team Lineup Strategy]\n`;
    lineup.forEach((p) => {
      text += `${p.order}. ${p.name} - ${p.role} (Bat: ${SKILL_LEVELS[p.batting]} | Bowl: ${p.bowlingType !== 'None' ? `${p.bowlingType} ${SKILL_LEVELS[p.bowling]}` : 'None'})\n`;
    });
    text += `\nEstimated Ratings:\n`;
    text += `- Top Order Batting: ${getBattrickRatingLabel(ratings.topOrder).full} (${ratings.topOrder.toFixed(1)})\n`;
    text += `- Middle Order Batting: ${getBattrickRatingLabel(ratings.middleOrder).full} (${ratings.middleOrder.toFixed(1)})\n`;
    text += `- Seam Bowling Rating: ${getBattrickRatingLabel(ratings.seamBowling).full} (${ratings.seamBowling.toFixed(1)})\n`;
    text += `- Spin Bowling Rating: ${getBattrickRatingLabel(ratings.spinBowling).full} (${ratings.spinBowling.toFixed(1)})\n`;
    text += `- Wicket Keeping: ${getBattrickRatingLabel(ratings.wicketKeeping).full} (${ratings.wicketKeeping.toFixed(1)})\n`;
    text += `- Fielding: ${getBattrickRatingLabel(ratings.fielding).full} (${ratings.fielding.toFixed(1)})\n`;
    text += `- Estimated Lineup BTR: ${ratings.estimatedBTR > 0 ? ratings.estimatedBTR.toLocaleString() : "N/A"}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (importedPlayers.length === 0 && lineup.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center text-center max-w-xl mx-auto my-8" id="lineup-empty-state">
        <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <Users className="w-7 h-7 text-indigo-500" />
        </div>
        <h3 className="font-display font-bold text-slate-800 text-sm">No Active Squad Loaded</h3>
        <p className="text-xs text-slate-500 leading-relaxed mt-2 max-w-md">
          To build your Best Match XI and calculate real-time team ratings, you need to sync your Battrick roster. Currently, there is no active squad found.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full max-w-xs">
          <button
            onClick={() => {
              if (setActiveTab) setActiveTab('sync');
            }}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition shadow-sm cursor-pointer"
          >
            Go to Cockpit & Sync
          </button>
          <button
            onClick={() => {
              setLineup(DEFAULT_LINEUP);
            }}
            className="w-full px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
          >
            Load Playground Demo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="lineup-optimizer-panel">
      {importedPlayers.length === 0 && (
        <div className="lg:col-span-12 bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-indigo-950 shadow-sm">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Viewing Simulated Demo Squad</span>
            <span className="leading-relaxed">You are currently looking at sandbox players. Go to the <strong className="text-indigo-900">My Squad & Cockpit</strong> tab and paste your real Battrick.org squad/nets to automatically select your absolute Best XI and calculate 100% accurate match ratings!</span>
          </div>
        </div>
      )}

      {/* Strategy Preset & Auto-optimisation Toolbar */}
      <div className="lg:col-span-12 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-display font-bold text-sm text-slate-800">Lineup Strategies</h3>
            <p className="text-[11px] text-slate-500">Apply tactical squad presets or link actual imported players</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {importedPlayers.length > 0 && (
            <button
              id="btn-auto-optimize-lineup"
              onClick={autoOptimizeXI}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-sm flex items-center gap-1.5 transition"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Auto-Select Best XI
            </button>
          )}

          {PRESET_STRATEGIES.map((strat) => (
            <button
              key={strat.name}
              id={`preset-btn-${strat.name.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => applyStrategy(strat.name)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-indigo-300 text-xs font-semibold text-slate-600 hover:text-indigo-700 transition"
            >
              {strat.name}
            </button>
          ))}
        </div>
      </div>

      {/* 11 Players List & Editor */}
      <div className="lg:col-span-7 flex flex-col gap-2.5">
        <h4 className="font-display font-semibold text-xs text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>Active Match XI</span>
          <span className="text-[10px] lowercase text-slate-400">Click a slot to customize or link imported player</span>
        </h4>

        <div className="flex flex-col gap-2 pr-1">
          {lineup.map((player) => {
            const isExpanded = expandedId === player.id;
            return (
              <div
                key={player.id}
                id={`player-row-${player.order}`}
                className={`border rounded-lg transition duration-150 shadow-sm ${
                  isExpanded
                    ? 'bg-indigo-50/20 border-indigo-300'
                    : 'bg-white border-slate-200 hover:border-indigo-100 hover:bg-slate-50/50'
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleExpand(player.id)}
                  className="p-3 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400 w-5 text-right font-bold"></span>
                      {player.order}
                    
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        {player.name}
                        {player.role === 'Keeper' && (
                            <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] rounded font-mono uppercase font-bold">
                              Keeper
                            </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{player.role}</span>
                        <span>•</span>
                        <span>
                          {player.bowlingType !== 'None' ? `${player.bowlingType} Bowler` : 'No Bowling'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Quick Stats Summary */}
                    <div className="hidden sm:flex items-center gap-3 font-mono text-[10px]">
                      <div>
                        <span className="text-slate-400 uppercase mr-1">bat:</span>
                        <span className="text-indigo-600 font-bold">{player.batting}</span>
                      </div>
                      {player.bowlingType !== 'None' && (
                        <div>
                          <span className="text-slate-400 uppercase mr-1">bwl:</span>
                          <span className="text-rose-600 font-bold">{player.bowling}</span>
                        </div>
                      )}
                      {player.role === 'Keeper' && (
                        <div>
                          <span className="text-slate-400 uppercase mr-1">kep:</span>
                          <span className="text-emerald-600 font-bold">{player.keeping}</span>
                        </div>
                      )}
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Skill Inputs */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-200 bg-slate-50/50 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name & Role */}
                    <div className="flex flex-col gap-3">
                      {importedPlayers.length > 0 && (
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Link Squad Player</label>
                          <select
                            onChange={(e) => assignImportedPlayer(player.id, e.target.value)}
                            defaultValue=""
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">-- Click to select and map --</option>
                            {importedPlayers.map(ip => (
                              <option key={ip.id} value={ip.id}>{ip.name} ({ip.role})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Custom Display Name</label>
                        <input
                          type="text"
                          id={`player-${player.order}-name`}
                          value={player.name}
                          onChange={(e) => handlePlayerChange(player.id, 'name', e.target.value)}
                          className="w-full px-2.5 py-1.5 mt-1 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:border-indigo-400 shadow-sm"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Tactical Role</label>
                        <select
                          id={`player-${player.order}-role`}
                          value={player.role}
                          onChange={(e) => handlePlayerChange(player.id, 'role', e.target.value as any)}
                          className="w-full px-2.5 py-1.5 mt-1 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:border-indigo-400 shadow-sm"
                        >
                          <option value="Batter">Pure Batter</option>
                          <option value="All-rounder">All-rounder</option>
                          <option value="Bowler">Pure Bowler</option>
                          <option value="Keeper">Wicket-Keeper</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 font-bold uppercase">Bowling Type</label>
                        <select
                          id={`player-${player.order}-bowling-type`}
                          value={player.bowlingType}
                          onChange={(e) => handlePlayerChange(player.id, 'bowlingType', e.target.value as any)}
                          className="w-full px-2.5 py-1.5 mt-1 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:border-indigo-400 shadow-sm"
                        >
                          <option value="None">None (Don't bowl)</option>
                          <option value="Fast">Fast</option>
                          <option value="Fast Medium">Fast Medium</option>
                          <option value="Medium">Medium</option>
                          <option value="Spin">Spin (Leggie/Offie)</option>
                        </select>
                      </div>
                    </div>

                    {/* Skill Settings */}
                    <div className="flex flex-col gap-3 font-mono">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-500 uppercase font-semibold">
                          <span>Batting Skill</span>
                          <span className="text-indigo-600 font-bold">{SKILL_LEVELS[player.batting]} ({player.batting})</span>
                        </div>
                        <input
                          type="range"
                          id={`player-${player.order}-skill-bat`}
                          min="0"
                          max="20"
                          value={player.batting}
                          onChange={(e) => handleSkillChange(player.id, 'batting', parseInt(e.target.value))}
                          className="w-full mt-1.5 h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-indigo-600"
                        />
                      </div>

                      {player.bowlingType !== 'None' && (
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-500 uppercase font-semibold">
                            <span>Bowling Skill</span>
                            <span className="text-rose-600 font-bold">{SKILL_LEVELS[player.bowling]} ({player.bowling})</span>
                          </div>
                          <input
                            type="range"
                            id={`player-${player.order}-skill-bwl`}
                            min="0"
                            max="20"
                            value={player.bowling}
                            onChange={(e) => handleSkillChange(player.id, 'bowling', parseInt(e.target.value))}
                            className="w-full mt-1.5 h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-rose-600"
                          />
                        </div>
                      )}

                      {player.role === 'Keeper' && (
                        <div>
                          <div className="flex justify-between text-[10px] text-slate-500 uppercase font-semibold">
                            <span>Keeping Skill</span>
                            <span className="text-emerald-600 font-bold">{SKILL_LEVELS[player.keeping]} ({player.keeping})</span>
                          </div>
                          <input
                            type="range"
                            id={`player-${player.order}-skill-keep`}
                            min="0"
                            max="20"
                            value={player.keeping}
                            onChange={(e) => handleSkillChange(player.id, 'keeping', parseInt(e.target.value))}
                            className="w-full mt-1.5 h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-emerald-600"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between text-[9px] text-slate-500 uppercase font-semibold">
                            <span>Stamina</span>
                            <span className="text-amber-600 font-bold">{player.stamina}</span>
                          </div>
                          <input
                            type="range"
                            id={`player-${player.order}-skill-stam`}
                            min="0"
                            max="20"
                            value={player.stamina}
                            onChange={(e) => handleSkillChange(player.id, 'stamina', parseInt(e.target.value))}
                            className="w-full mt-1 h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[9px] text-slate-500 uppercase font-semibold">
                            <span>Exp</span>
                            <span className="text-slate-800 font-bold">{player.experience}</span>
                          </div>
                          <input
                            type="range"
                            id={`player-${player.order}-skill-exp`}
                            min="0"
                            max="20"
                            value={player.experience}
                            onChange={(e) => handleSkillChange(player.id, 'experience', parseInt(e.target.value))}
                            className="w-full mt-1 h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-slate-400"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Team Ratings Output */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-600" />
              Battrick Team Match Ratings
            </h4>

            <button
              id="btn-copy-squad"
              onClick={copySquadToClipboard}
              className="flex items-center gap-1 text-[10px] text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/50 border border-indigo-200/50 px-2 py-1 rounded transition duration-150 font-semibold shadow-sm"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-indigo-600" />
                  Copy Strategy
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-3.5" id="computed-match-ratings">
            {/* Top Order Batting */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Top Order Batting</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Batsman positions 1 to 5 strength</div>
              </div>
              <div className={`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase ${getBattrickRatingLabel(ratings.topOrder).color}`}>
                {getBattrickRatingLabel(ratings.topOrder).full} <span className="text-[10px] opacity-75">({ratings.topOrder.toFixed(1)})</span>
              </div>
            </div>

            {/* Middle Order Batting */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Middle Order Batting</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Strength in middle order overs 15-40</div>
              </div>
              <div className={`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase ${getBattrickRatingLabel(ratings.middleOrder).color}`}>
                {getBattrickRatingLabel(ratings.middleOrder).full} <span className="text-[10px] opacity-75">({ratings.middleOrder.toFixed(1)})</span>
              </div>
            </div>

            {/* Lower Order Batting */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Lower Order Batting</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Tail-end resistance & run rate pushes</div>
              </div>
              <div className={`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase ${getBattrickRatingLabel(ratings.lowerOrder).color}`}>
                {getBattrickRatingLabel(ratings.lowerOrder).full} <span className="text-[10px] opacity-75">({ratings.lowerOrder.toFixed(1)})</span>
              </div>
            </div>

            {/* Seam Bowling */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Seam Bowling</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Fast / Fast-Medium delivery ratings</div>
              </div>
              <div className={`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase ${getBattrickRatingLabel(ratings.seamBowling).color}`}>
                {getBattrickRatingLabel(ratings.seamBowling).full} <span className="text-[10px] opacity-75">({ratings.seamBowling.toFixed(1)})</span>
              </div>
            </div>

            {/* Spin Bowling */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Spin Bowling</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Spin & variable crack flight ratings</div>
              </div>
              <div className={`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase ${ratings.spinBowling > 0 ? getBattrickRatingLabel(ratings.spinBowling).color : 'text-slate-550 border-slate-200'}`}>
                {ratings.spinBowling > 0 ? <>{getBattrickRatingLabel(ratings.spinBowling).full} <span className="text-[10px] opacity-75">({ratings.spinBowling.toFixed(1)})</span></> : 'none'}
              </div>
            </div>

            {/* Wicket Keeping */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Wicket Keeping</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Gloves accuracy & fielding strength</div>
              </div>
              <div className={`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase ${getBattrickRatingLabel(ratings.wicketKeeping).color}`}>
                {getBattrickRatingLabel(ratings.wicketKeeping).full} <span className="text-[10px] opacity-75">({ratings.wicketKeeping.toFixed(1)})</span>
              </div>
            </div>

            {/* Fielding */}
            <div className="p-3.5 rounded-lg bg-slate-50/50 border border-slate-100 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Fielding</div>
                <div className="text-[11px] text-slate-600 mt-0.5 font-medium">Ground fielding & catching ability</div>
              </div>
              <div className={`font-mono text-xs font-bold px-2.5 py-1 rounded border uppercase ${getBattrickRatingLabel(ratings.fielding).color}`}>
                {getBattrickRatingLabel(ratings.fielding).full} <span className="text-[10px] opacity-75">({ratings.fielding.toFixed(1)})</span>
              </div>
            </div>

            {/* Estimated Battrick Rating (BTR) Score */}
            <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-indigo-500 uppercase tracking-wider font-bold">Estimated Lineup BTR</div>
                <div className="text-[11px] text-indigo-700 mt-0.5 font-medium">Total Battrick Rating score for XI</div>
              </div>
              <div className="font-mono text-sm font-bold px-3 py-1.5 bg-white text-indigo-700 rounded border border-indigo-300 shadow-sm">
                {ratings.estimatedBTR > 0 ? ratings.estimatedBTR.toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Aggregate Averages info footer */}
          <div className="mt-2 pt-3 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Experience</div>
              <div className="font-mono text-xs font-semibold text-slate-700 mt-0.5">
                {ratings.teamExperience.toFixed(1)} ({SKILL_LEVELS[Math.round(ratings.teamExperience)]})
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Stamina</div>
              <div className="font-mono text-xs font-semibold text-slate-700 mt-0.5">
                {lineup.reduce((acc, curr) => acc + curr.stamina, 0) / 11 < 5.0 ? (
                  <span className="text-amber-600 font-semibold">Low (⚠️ Decay Risk)</span>
                ) : (
                  'Stable'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Commentary preview */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-slate-600 shadow-sm">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-indigo-800 font-bold">Tactic Tip: Battrick team ratings are heavily influenced by player fitness and confidence levels on matchday. Use this calculator as an optimized blueprint for planning your training and selecting the most competitive order.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
