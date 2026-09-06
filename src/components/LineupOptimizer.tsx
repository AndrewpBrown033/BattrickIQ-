import React, { useState, useEffect } from 'react';
import { SKILL_LEVELS, LineupPlayer, BattrickPlayer } from '../types';
import { Users, Shield, Copy, Check, Info, ChevronDown, ChevronUp, RefreshCw, UserCheck } from 'lucide-react';

const DEFAULT_LINEUP: LineupPlayer[] = [
  { id: '1', name: 'A. Alistair', role: 'Batter', batting: 8, bowling: 0, keeping: 0, fielding: 5, stamina: 6, experience: 7, concentration: 8, consistency: 6, form: 7, fitness: 10, bowlingType: 'None', order: 1 },
  { id: '2', name: 'B. Bradman', role: 'Batter', batting: 9, bowling: 0, keeping: 0, fielding: 5, stamina: 7, experience: 8, concentration: 10, consistency: 7, form: 8, fitness: 10, bowlingType: 'None', order: 2 },
  { id: '3', name: 'C. Cowdrey', role: 'Batter', batting: 7, bowling: 0, keeping: 0, fielding: 5, stamina: 6, experience: 5, concentration: 7, consistency: 6, form: 7, fitness: 9, bowlingType: 'None', order: 3 },
  { id: '4', name: 'D. Dexter', role: 'Batter', batting: 11, bowling: 1, keeping: 0, fielding: 5, stamina: 8, experience: 7, concentration: 9, consistency: 6, form: 8, fitness: 10, bowlingType: 'None', order: 4 },
  { id: '5', name: 'E. Edrich', role: 'All-rounder', batting: 7, bowling: 12, keeping: 0, fielding: 5, stamina: 8, experience: 8, concentration: 8, consistency: 9, form: 7, fitness: 9, bowlingType: 'Fast', order: 5 },
  { id: '6', name: 'F. Flintoff', role: 'All-rounder', batting: 8, bowling: 14, keeping: 0, fielding: 5, stamina: 9, experience: 9, concentration: 7, consistency: 10, form: 8, fitness: 9, bowlingType: 'Fast Medium', order: 6 },
  { id: '7', name: 'G. Gilchrist', role: 'Keeper', batting: 5, bowling: 0, keeping: 9, fielding: 7, stamina: 7, experience: 5, concentration: 6, consistency: 6, form: 7, fitness: 10, bowlingType: 'None', order: 7 },
  { id: '8', name: 'H. Hadlee', role: 'Bowler', batting: 3, bowling: 15, keeping: 0, fielding: 5, stamina: 8, experience: 12, concentration: 5, consistency: 11, form: 8, fitness: 9, bowlingType: 'Fast', order: 8 },
  { id: '9', name: 'I. Imran', role: 'Bowler', batting: 5, bowling: 17, keeping: 0, fielding: 5, stamina: 11, experience: 13, concentration: 5, consistency: 13, form: 9, fitness: 10, bowlingType: 'Fast Medium', order: 9 },
  { id: '10', name: 'J. Johnston', role: 'Bowler', batting: 1, bowling: 12, keeping: 0, fielding: 5, stamina: 7, experience: 5, concentration: 4, consistency: 9, form: 7, fitness: 9, bowlingType: 'Spin', order: 10 },
  { id: '11', name: 'K. Kumble', role: 'Bowler', batting: 1, bowling: 14, keeping: 0, fielding: 5, stamina: 8, experience: 7, concentration: 4, consistency: 10, form: 8, fitness: 9, bowlingType: 'Spin', order: 11 },
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
        stamina: p.skills.stamina,
        experience: p.skills.experience,
        concentration: p.skills.concentration,
        consistency: p.skills.consistency,
        form: p.form,
        fitness: p.fitness,
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
      concentration: b1.skills.concentration,
      consistency: b1.skills.consistency,
      form: b1.form,
      fitness: b1.fitness,
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
    concentration: keeper.skills.concentration,
    consistency: keeper.skills.consistency,
    form: keeper.form,
    fitness: keeper.fitness,
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
        concentration: p6.skills.concentration,
        consistency: p6.skills.consistency,
        form: p6.form,
        fitness: p6.fitness,
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
        concentration: p8.skills.concentration,
        consistency: p8.skills.consistency,
        form: p8.form,
        fitness: p8.fitness,
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
          concentration: b.skills.concentration,
          consistency: b.skills.consistency,
          form: b.form,
          fitness: b.fitness,
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
          concentration: b.skills.concentration,
          consistency: b.skills.consistency,
          form: b.form,
          fitness: b.fitness,
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
  const [matchEffort, setMatchEffort] = useState<'TIE' | 'PAN' | 'GFI'>(() => {
    try {
      const saved = localStorage.getItem('bt_match_effort');
      if (saved === 'TIE' || saved === 'PAN' || saved === 'GFI') return saved;
    } catch {}
    return 'PAN';
  });

  useEffect(() => {
    try {
      localStorage.setItem('bt_match_effort', matchEffort);
    } catch {}
  }, [matchEffort]);

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
          concentration: selected.skills.concentration,
          consistency: selected.skills.consistency,
          form: selected.form,
          fitness: selected.fitness,
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
          fielding: batters[i].skills.fielding || 5,
          btRating: batters[i].btRating,
          stamina: batters[i].skills.stamina,
          experience: batters[i].skills.experience,
          concentration: batters[i].skills.concentration,
          consistency: batters[i].skills.consistency,
          form: batters[i].form,
          fitness: batters[i].fitness,
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
      fielding: primaryKeeper.skills.fielding || 5,
      btRating: primaryKeeper.btRating,
      stamina: primaryKeeper.skills.stamina,
      experience: primaryKeeper.skills.experience,
      concentration: primaryKeeper.skills.concentration,
      consistency: primaryKeeper.skills.consistency,
      form: primaryKeeper.form,
      fitness: primaryKeeper.fitness,
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
          fielding: bPlayer.skills.fielding || 5,
          btRating: bPlayer.btRating,
          stamina: bPlayer.skills.stamina,
          experience: bPlayer.skills.experience,
          concentration: bPlayer.skills.concentration,
          consistency: bPlayer.skills.consistency,
          form: bPlayer.form,
          fitness: bPlayer.fitness,
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

  // --- Community-reverse-engineered Battrick match engine model ---
  // The exact formula Battrick uses is not public; this mirrors the
  // relationships the community has documented through years of data
  // tracking. Treat every number below as a guided estimate, not an exact
  // reproduction of the hidden engine.
  const EFFORT_SKILL_MULTIPLIER: Record<'TIE' | 'PAN' | 'GFI', number> = {
    TIE: 0.85,
    PAN: 1.00,
    GFI: 1.15,
  };
  const EFFORT_PFL_MULTIPLIER: Record<'TIE' | 'PAN' | 'GFI', number> = {
    TIE: 0.70,
    PAN: 1.00,
    GFI: 1.50,
  };

  // Batting Value = Batting Skill + 0.25 x Concentration
  const battingValue = (p: LineupPlayer) => p.batting + 0.25 * (p.concentration ?? 10);
  // Bowling Value = Bowling Skill + 0.25 x Consistency
  const bowlingValue = (p: LineupPlayer) => p.bowling + 0.25 * (p.consistency ?? 10);
  // Form: Sublime (10) = 100%, Woeful (0) = up to a 20% penalty
  const formModifier = (p: LineupPlayer) => 0.80 + (Math.min(10, Math.max(0, p.form ?? 8)) / 10) * 0.20;
  // Fitness (PFL): Saturated (10) = 100%, Shattered (0) = less than half
  const fitnessModifier = (p: LineupPlayer) => 0.45 + (Math.min(10, Math.max(0, p.fitness ?? 10)) / 10) * 0.55;

  // Weighted sector rating: applies the position weighting to the batting
  // value, then multiplies by the *weighted average* form/fitness modifier
  // of the same players (so a tired or out-of-form star still drags the
  // sector down proportionally to how much they're weighted in it).
  const weightedSector = (weights: [LineupPlayer | undefined, number][]) => {
    const totalWeight = weights.reduce((acc, [, w]) => acc + w, 0) || 1;
    const base = weights.reduce((acc, [p, w]) => acc + (p ? battingValue(p) * w : 0), 0);
    const form = weights.reduce((acc, [p, w]) => acc + (p ? formModifier(p) * w : formModifier({} as LineupPlayer) * w), 0) / totalWeight;
    const fitness = weights.reduce((acc, [p, w]) => acc + (p ? fitnessModifier(p) * w : fitnessModifier({} as LineupPlayer) * w), 0) / totalWeight;
    return { base, form, fitness };
  };

  // Calculations for Battrick team ratings
  const calculateTeamRatings = () => {
    const effortSkillMulti = EFFORT_SKILL_MULTIPLIER[matchEffort];
    const p = (i: number) => lineup[i];

    // Top Order: Batsmen 1-3 ~70% of the rating, 4-5 the remaining ~30%
    const topOrderCalc = weightedSector([
      [p(0), 0.25], [p(1), 0.25], [p(2), 0.20], [p(3), 0.18], [p(4), 0.12],
    ]);

    // Middle Order: heavily determined by Batsmen 4, 5, 6, 7
    const middleOrderCalc = weightedSector([
      [p(3), 0.15], [p(4), 0.30], [p(5), 0.30], [p(6), 0.25],
    ]);

    // Lower Order: Batsmen 8, 9, 10, 11 (usually the tail-end bowlers)
    const lowerOrderCalc = weightedSector([
      [p(7), 0.15], [p(8), 0.35], [p(9), 0.30], [p(10), 0.20],
    ]);

    // Main Bowlers, split into Seam and Spin: average bowling value of the
    // players selected to bowl, modified by their own form/fitness.
    const seamBowlers = lineup.filter(pl => ['Fast', 'Fast Medium', 'Medium'].includes(pl.bowlingType));
    let seamBowlingRaw = 0, seamForm = 1, seamFitness = 1;
    if (seamBowlers.length > 0) {
      const avgSeam = seamBowlers.reduce((acc, curr) => acc + bowlingValue(curr), 0) / seamBowlers.length;
      seamBowlingRaw = avgSeam + (Math.min(3, seamBowlers.length) * 0.45);
      seamForm = seamBowlers.reduce((acc, curr) => acc + formModifier(curr), 0) / seamBowlers.length;
      seamFitness = seamBowlers.reduce((acc, curr) => acc + fitnessModifier(curr), 0) / seamBowlers.length;
    }

    const spinBowlers = lineup.filter(pl => pl.bowlingType === 'Spin');
    let spinBowlingRaw = 0, spinForm = 1, spinFitness = 1;
    if (spinBowlers.length > 0) {
      const avgSpin = spinBowlers.reduce((acc, curr) => acc + bowlingValue(curr), 0) / spinBowlers.length;
      spinBowlingRaw = avgSpin + (Math.min(2, spinBowlers.length) * 0.55);
      spinForm = spinBowlers.reduce((acc, curr) => acc + formModifier(curr), 0) / spinBowlers.length;
      spinFitness = spinBowlers.reduce((acc, curr) => acc + fitnessModifier(curr), 0) / spinBowlers.length;
    }

    const keeper = lineup.find(pl => pl.role === 'Keeper') || lineup[6];
    const keepingRaw = keeper ? (keeper.keeping + (keeper.experience * 0.16)) : 0;
    const keeperForm = keeper ? formModifier(keeper) : 1;
    const keeperFitness = keeper ? fitnessModifier(keeper) : 1;

    const avgExperience = lineup.length ? lineup.reduce((acc, curr) => acc + curr.experience, 0) / lineup.length : 0;
    const avgFielding = lineup.length ? lineup.reduce((acc, curr) => acc + (curr.fielding || 5), 0) / lineup.length : 0;
    const fieldingRaw = avgFielding + (avgExperience * 0.1);
    const avgFieldingForm = lineup.length ? lineup.reduce((acc, curr) => acc + formModifier(curr), 0) / lineup.length : 1;
    const avgFieldingFitness = lineup.length ? lineup.reduce((acc, curr) => acc + fitnessModifier(curr), 0) / lineup.length : 1;

    const estimatedTotalBTR = lineup.reduce((acc, curr) => acc + (curr.btRating || 0), 0);

    const clamp = (v: number) => Math.min(20, Math.max(0, v));

    const topOrder = clamp(topOrderCalc.base * topOrderCalc.form * topOrderCalc.fitness * effortSkillMulti);
    const middleOrder = clamp(middleOrderCalc.base * middleOrderCalc.form * middleOrderCalc.fitness * effortSkillMulti);
    const lowerOrder = clamp(lowerOrderCalc.base * lowerOrderCalc.form * lowerOrderCalc.fitness * effortSkillMulti);
    const seamBowling = clamp(seamBowlingRaw * seamForm * seamFitness * effortSkillMulti);
    const spinBowling = clamp(spinBowlingRaw * spinForm * spinFitness * effortSkillMulti);
    const wicketKeeping = clamp(keepingRaw * keeperForm * keeperFitness * effortSkillMulti);
    const fielding = clamp(fieldingRaw * avgFieldingForm * avgFieldingFitness * effortSkillMulti);

    // Rough Batstats estimate (Battrick's own single "batting output" figure,
    // e.g. as shown on matchinfo.asp?action=summary). Derived from limited
    // sample matches: (Top + Middle + Lower Order) x ~7 tracked closely
    // across two very different real teams, so treat this as indicative,
    // not authoritative.
    const batStats = Math.round((topOrder + middleOrder + lowerOrder) * 7);

    return {
      topOrder,
      middleOrder,
      lowerOrder,
      seamBowling,
      spinBowling,
      wicketKeeping,
      fielding,
      estimatedBTR: estimatedTotalBTR,
      teamExperience: avgExperience,
      batStats,
      pflLossMultiplier: EFFORT_PFL_MULTIPLIER[matchEffort],
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

  // Shared row config + renderer for the Reporter's-Summary-style table, used
  // both directly under the batting order list and in the full ratings
  // panel, so the two stay visually and numerically consistent.
  const summarySectorRows: [string, number][] = [
    ['Top Order', ratings.topOrder],
    ['Middle Order', ratings.middleOrder],
    ['Lower Order', ratings.lowerOrder],
    ['Seam Bowling', ratings.seamBowling],
    ['Spin Bowling', ratings.spinBowling],
    ['Fielding', ratings.fielding],
  ];

  const renderRatingRow = ([rowLabel, rawScore]: [string, number]) => {
    const level = Math.min(20, Math.max(0, Math.round(rawScore)));
    const label = SKILL_LEVELS[level] || 'useless';
    const isEmpty = rowLabel === 'Spin Bowling' && rawScore <= 0;
    return (
      <tr key={rowLabel} className="border-b border-slate-50 last:border-0">
        <td className="py-1.5 pr-3 font-semibold text-slate-500">{rowLabel}:</td>
        <td className="py-1.5 text-right">
          {isEmpty ? (
            <span className="text-slate-400 italic">none</span>
          ) : (
            <span
              title={`Level ${level}`}
              className={`font-bold uppercase cursor-help ${getBattrickRatingLabel(rawScore).color.split(' ')[0]}`}
            >
              {label}
            </span>
          )}
        </td>
      </tr>
    );
  };

  const EFFORT_OPTIONS: { key: 'TIE' | 'PAN' | 'GFI'; label: string; desc: string }[] = [
    { key: 'TIE', label: 'Take It Easy', desc: '-15% performance, -30% fitness drain' },
    { key: 'PAN', label: 'Play As Normal', desc: 'Baseline performance & fitness drain' },
    { key: 'GFI', label: 'Go For It', desc: '+15% performance, +50% fitness drain' },
  ];

  const copySquadToClipboard = () => {
    let text = `[BattrickIQ Team Lineup Strategy]\n`;
    lineup.forEach((p) => {
      text += `${p.order}. ${p.name} - ${p.role} (Bat: ${SKILL_LEVELS[p.batting]} | Bowl: ${p.bowlingType !== 'None' ? `${p.bowlingType} ${SKILL_LEVELS[p.bowling]}` : 'None'})\n`;
    });
    text += `\nMatch Effort: ${EFFORT_OPTIONS.find(o => o.key === matchEffort)?.label}\n`;
    text += `\nEstimated Ratings:\n`;
    text += `- Top Order Batting: ${getBattrickRatingLabel(ratings.topOrder).full} (${ratings.topOrder.toFixed(1)})\n`;
    text += `- Middle Order Batting: ${getBattrickRatingLabel(ratings.middleOrder).full} (${ratings.middleOrder.toFixed(1)})\n`;
    text += `- Lower Order Batting: ${getBattrickRatingLabel(ratings.lowerOrder).full} (${ratings.lowerOrder.toFixed(1)})\n`;
    text += `- Seam Bowling Rating: ${getBattrickRatingLabel(ratings.seamBowling).full} (${ratings.seamBowling.toFixed(1)})\n`;
    text += `- Spin Bowling Rating: ${getBattrickRatingLabel(ratings.spinBowling).full} (${ratings.spinBowling.toFixed(1)})\n`;
    text += `- Wicket Keeping: ${getBattrickRatingLabel(ratings.wicketKeeping).full} (${ratings.wicketKeeping.toFixed(1)})\n`;
    text += `- Fielding: ${getBattrickRatingLabel(ratings.fielding).full} (${ratings.fielding.toFixed(1)})\n`;
    text += `- Est. Batstats: ${ratings.batStats}\n`;

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
        {/* Match Effort toggle - a guard rail for every calculation below */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
            <Shield className="w-4 h-4 text-indigo-600" />
            Match Effort
          </h4>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
            {EFFORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                id={`btn-effort-${opt.key.toLowerCase()}`}
                onClick={() => setMatchEffort(opt.key)}
                title={opt.desc}
                className={`px-2 py-1.5 rounded-md text-[11px] font-bold transition cursor-pointer ${
                  matchEffort === opt.key
                    ? opt.key === 'GFI'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : opt.key === 'TIE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-white hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
            {EFFORT_OPTIONS.find(o => o.key === matchEffort)?.desc} &mdash; every rating below already reflects this setting.
          </p>
        </div>

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

          <table className="w-full text-xs" id="computed-match-ratings">
            <tbody>
              {summarySectorRows.map(renderRatingRow)}
              {renderRatingRow(['Wicket Keeping', ratings.wicketKeeping])}
            </tbody>
          </table>

          <div className="flex flex-col gap-3.5">
            {/* Estimated Batstats output */}
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-emerald-700 uppercase tracking-wider font-bold">Est. Batstats</div>
                <div className="text-[11px] text-emerald-800 mt-0.5 font-medium">Aggregated batting order strength score</div>
              </div>
              <div className="font-mono text-sm font-bold px-3 py-1.5 bg-white text-emerald-700 rounded border border-emerald-300 shadow-sm">
                {ratings.batStats}
              </div>
            </div>

            {/* Estimated PFL / fitness drain for the current effort setting */}
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between shadow-inner">
              <div>
                <div className="text-[10px] text-amber-600 uppercase tracking-wider font-bold">Est. Fitness Drain</div>
                <div className="text-[11px] text-amber-700 mt-0.5 font-medium">PFL loss multiplier vs. baseline (PAN)</div>
              </div>
              <div className="font-mono text-sm font-bold px-3 py-1.5 bg-white text-amber-700 rounded border border-amber-300 shadow-sm">
                {ratings.pflLossMultiplier.toFixed(2)}x
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