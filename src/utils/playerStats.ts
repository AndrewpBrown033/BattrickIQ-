import { BattrickPlayer } from '../types';

export interface FormatStats {
  formatName: 'First Class' | 'One Day' | 'BT20';
  shortCode: 'FC' | 'OD' | 'BT20';
  matches: number;
  inningsBatted: number;
  notOuts: number;
  runs: number;
  highScore: string;
  battingAverage: number;
  strikeRate: number;
  fifties: number;
  hundreds: number;
  oversBowled: number;
  wickets: number;
  bestBowling: string;
  bowlingAverage: number;
  economyRate: number;
  fiveWickets: number;
  catches: number;
  stumpings: number;
}

export interface ComprehensivePlayerStats {
  firstClass: FormatStats;
  oneDay: FormatStats;
  bt20: FormatStats;
  summary: {
    totalMatches: number;
    totalRuns: number;
    totalWickets: number;
    totalCatches: number;
    bestRoleHighlight: string;
  };
}

// Generate deterministic yet realistic Battrick career stats for any player based on age, skills & ID
export function getPlayerStats(player: BattrickPlayer): ComprehensivePlayerStats {
  if (player.stats) {
    return {
      firstClass: player.stats.firstClass || buildFormatStats(player, 'First Class', 'FC', 0.4),
      oneDay: player.stats.oneDay || buildFormatStats(player, 'One Day', 'OD', 0.35),
      bt20: player.stats.bt20 || buildFormatStats(player, 'BT20', 'BT20', 0.25),
      summary: computeSummary(
        player.stats.firstClass || buildFormatStats(player, 'First Class', 'FC', 0.4),
        player.stats.oneDay || buildFormatStats(player, 'One Day', 'OD', 0.35),
        player.stats.bt20 || buildFormatStats(player, 'BT20', 'BT20', 0.25)
      )
    };
  }

  const fc = buildFormatStats(player, 'First Class', 'FC', 0.4);
  const od = buildFormatStats(player, 'One Day', 'OD', 0.35);
  const t20 = buildFormatStats(player, 'BT20', 'BT20', 0.25);

  return {
    firstClass: fc,
    oneDay: od,
    bt20: t20,
    summary: computeSummary(fc, od, t20)
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildFormatStats(
  player: BattrickPlayer, 
  formatName: 'First Class' | 'One Day' | 'BT20',
  shortCode: 'FC' | 'OD' | 'BT20',
  weight: number
): FormatStats {
  const seed = hashString(player.id + shortCode);
  const pseudoRand = (mod: number) => (seed % mod);

  // Experience & age determine match count
  const seasonsPlayed = Math.max(1, player.age - 17);
  const baseMatchesPerSeason = shortCode === 'FC' ? 10 : shortCode === 'OD' ? 12 : 14;
  const matches = Math.round(seasonsPlayed * baseMatchesPerSeason * (0.6 + (pseudoRand(40) / 100)));

  const isBatter = player.role === 'Batter' || player.skills.batting >= player.skills.bowling;
  const isBowler = player.role === 'Bowler' || player.skills.bowling > player.skills.batting;
  const isKeeper = player.role === 'Keeper' || player.skills.keeping > 5;
  const isAllRounder = player.role === 'All-rounder' || (player.skills.batting >= 6 && player.skills.bowling >= 6);

  // Batting stats math
  const inningsBatted = Math.round(matches * (shortCode === 'FC' ? 1.6 : 0.85));
  const notOuts = Math.round(inningsBatted * (0.1 + (pseudoRand(15) / 100)));
  const dismissals = Math.max(1, inningsBatted - notOuts);

  let expectedAvg = 15;
  if (isBatter || isAllRounder) {
    expectedAvg = 22 + (player.skills.batting * 2.2) + (player.skills.concentration * 0.8);
  } else if (isKeeper) {
    expectedAvg = 18 + (player.skills.batting * 1.8);
  } else {
    expectedAvg = 8 + (player.skills.batting * 1.1);
  }
  expectedAvg = Number((expectedAvg * (0.9 + (pseudoRand(20) / 100))).toFixed(2));

  const runs = Math.round(dismissals * expectedAvg);
  const battingAverage = Number((runs / dismissals).toFixed(2));

  let strikeRate = shortCode === 'BT20' ? 125 + (player.skills.batting * 2) : shortCode === 'OD' ? 78 + (player.skills.batting * 1.5) : 48 + (player.skills.batting * 1.1);
  strikeRate = Number((strikeRate * (0.95 + (pseudoRand(10) / 100))).toFixed(1));

  let maxBatInnings = Math.min(runs, Math.round(expectedAvg * (2.2 + (pseudoRand(10) / 10))));
  if (shortCode === 'BT20') maxBatInnings = Math.min(135, maxBatInnings);
  const isNotOutHS = pseudoRand(2) === 1;
  const highScore = `${Math.max(12, maxBatInnings)}${isNotOutHS ? '*' : ''}`;

  const fifties = Math.round(inningsBatted * (expectedAvg > 35 ? 0.25 : expectedAvg > 20 ? 0.15 : 0.05));
  const hundreds = Math.round(fifties * (expectedAvg > 40 ? 0.35 : expectedAvg > 28 ? 0.2 : 0.05));

  // Bowling stats math
  let oversBowled = 0;
  let wickets = 0;
  let bestBowling = '0/0';
  let bowlingAverage = 0;
  let economyRate = 0;
  let fiveWickets = 0;

  if (isBowler || isAllRounder || player.skills.bowling >= 5) {
    const oversPerMatch = shortCode === 'FC' ? 24 : shortCode === 'OD' ? 8.5 : 3.8;
    oversBowled = Math.round(matches * oversPerMatch * (0.7 + (pseudoRand(30) / 100)));

    let expectedBowlAvg = 38 - (player.skills.bowling * 1.2) - (player.skills.consistency * 0.5);
    expectedBowlAvg = Math.max(12, Number((expectedBowlAvg * (0.9 + (pseudoRand(20) / 100))).toFixed(2)));

    let econ = shortCode === 'BT20' ? 7.2 - (player.skills.consistency * 0.15) : shortCode === 'OD' ? 4.8 - (player.skills.consistency * 0.1) : 3.2 - (player.skills.consistency * 0.08);
    econ = Math.max( shortCode === 'BT20' ? 5.2 : 2.5, Number((econ * (0.95 + (pseudoRand(10) / 100))).toFixed(2)));
    economyRate = econ;

    const runsConceded = Math.round(oversBowled * econ);
    wickets = Math.max(1, Math.round(runsConceded / expectedBowlAvg));
    bowlingAverage = Number((runsConceded / wickets).toFixed(2));

    const bestWkts = Math.min(shortCode === 'FC' ? 8 : 6, Math.max(2, Math.round(player.skills.bowling * 0.45 + (pseudoRand(3)))));
    const bestRuns = Math.round(bestWkts * (econ * 3.5 + pseudoRand(10)));
    bestBowling = `${bestWkts}/${bestRuns}`;

    fiveWickets = Math.round(matches * (player.skills.bowling > 10 ? 0.12 : 0.04));
  }

  // Fielding & Wicketkeeping stats
  let catches = Math.round(matches * (isKeeper ? 1.4 : isBatter ? 0.4 : 0.25));
  let stumpings = isKeeper ? Math.round(matches * 0.22) : 0;

  return {
    formatName,
    shortCode,
    matches,
    inningsBatted,
    notOuts,
    runs,
    highScore,
    battingAverage,
    strikeRate,
    fifties,
    hundreds,
    oversBowled,
    wickets,
    bestBowling,
    bowlingAverage,
    economyRate,
    fiveWickets,
    catches,
    stumpings
  };
}

function computeSummary(fc: FormatStats, od: FormatStats, t20: FormatStats) {
  const totalMatches = fc.matches + od.matches + t20.matches;
  const totalRuns = fc.runs + od.runs + t20.runs;
  const totalWickets = fc.wickets + od.wickets + t20.wickets;
  const totalCatches = fc.catches + od.catches + t20.catches + fc.stumpings + od.stumpings + t20.stumpings;

  let highlight = 'Versatile Team Contributor';
  if (totalRuns > 3000) highlight = 'Prolific Milestone Batter';
  else if (totalWickets > 150) highlight = 'Frontline Strike Bowler';
  else if (totalCatches > 80) highlight = 'Elite Safe-Hands Keeper';
  else if (totalRuns > 1500 && totalWickets > 75) highlight = 'Core All-Round Match Winner';

  return {
    totalMatches,
    totalRuns,
    totalWickets,
    totalCatches,
    bestRoleHighlight: highlight
  };
}
