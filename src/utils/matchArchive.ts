import { 
  ParsedBattrickMatch, 
  MatchInnings, 
  MatchBatterStat, 
  MatchBowlerStat, 
  MatchSummaryRatings, 
  BatstatDecomposition, 
  BattrickGame, 
  PitchType, 
  WeatherType,
  SKILL_LEVELS,
  getSkillLabel
} from '../types';
import { parseBattrickFullMatch, parseRatingTextToScore } from '../parser';
import { db } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';
import { doc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';

export function getSkillLabelFromNumber(value: number): string {
  const rounded = Math.round(value);
  const clamped = Math.max(0, Math.min(rounded, SKILL_LEVELS.length - 1));
  const name = SKILL_LEVELS[clamped] || 'mediocre';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export const MATCH_STORAGE_KEY = 'bt_played_matches_store';

export interface PredictedPlayerRole {
  name: string;
  battingOrderModal: number; // Most frequent position #1..#11
  battingOrderRange: [number, number];
  matchesPlayed: number;
  totalRuns: number;
  averageRuns: number;
  highestScore: number;
  strikeRate: number;
  fours: number;
  sixes: number;
  inningsCount: number;
  notOuts: number;
  estimatedBattingGrade: string;
  estimatedBattingScore: number;
  // Bowling
  isBowler: boolean;
  bowlingOrderModal?: number;
  oversPerMatch: number;
  wickets: number;
  economy: number;
  bowlingType: 'Seam' | 'Spin' | 'Unknown';
  isFifthBowlerRisk: boolean;
  estimatedBowlingGrade: string;
  estimatedBowlingScore: number;
  role: 'Opener' | 'Top Order' | 'Middle Order' | 'Wicket Keeper / All-rounder' | 'Tail' | 'Strike Bowler' | 'Change Bowler' | 'Part-timer';
}

export interface PredictedTeamLineup {
  teamName: string;
  sampleMatchesCount: number;
  matchFormat: string;
  predictedBattingOrder: PredictedPlayerRole[];
  predictedBowlingOrder: PredictedPlayerRole[];
  fifthBowlerRiskSummary: {
    bowlerName: string;
    avgEconomy: number;
    riskLevel: 'High' | 'Medium' | 'Low';
    analysis: string;
  };
  predictedRatings: {
    topOrder: { text: string; score: number };
    middleOrder: { text: string; score: number };
    lowerOrder: { text: string; score: number };
    seamBowling: { text: string; score: number };
    spinBowling: { text: string; score: number };
    fielding: { text: string; score: number };
    estimatedBatstats: number;
  };
  tacticalRecommendations: string[];
}

export interface MatchQueueItem {
  matchId: string;
  opponent?: string;
  homeTeam?: string;
  awayTeam?: string;
  date?: string;
  type?: string;
  status: 'pending' | 'fetching' | 'success' | 'error';
  error?: string;
  matchData?: ParsedBattrickMatch;
}

// -------------------------------------------------------------
// Storage Operations (Local + Cloud Firestore)
// -------------------------------------------------------------

export function getStoredMatches(): Record<string, ParsedBattrickMatch> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(MATCH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (e) {
    console.error('Error reading stored matches from localStorage:', e);
  }
  return {};
}

export function getStoredMatchesList(): ParsedBattrickMatch[] {
  const map = getStoredMatches();
  return Object.values(map).sort((a, b) => {
    // Sort descending by match date or ID
    return parseInt(b.matchId, 10) - parseInt(a.matchId, 10);
  });
}

export function getStoredMatchById(matchId: string): ParsedBattrickMatch | null {
  if (!matchId) return null;
  const map = getStoredMatches();
  return map[matchId] || null;
}

export async function saveStoredMatch(match: ParsedBattrickMatch): Promise<void> {
  if (!match || !match.matchId) return;

  const currentMap = getStoredMatches();
  currentMap[match.matchId] = match;

  try {
    localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(currentMap));
    window.dispatchEvent(new CustomEvent('bt_matches_updated', { detail: { matchId: match.matchId } }));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Failed to save match to localStorage:', e);
  }

  // Cloud Firestore Persistence
  try {
    const user = getCustomUser();
    if (user && user.uid && db) {
      const matchRef = doc(db, 'users_data', user.uid, 'matches', match.matchId);
      await setDoc(matchRef, {
        ...match,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
  } catch (cloudErr) {
    console.warn('Could not mirror match to cloud Firestore:', cloudErr);
  }
}

export async function saveMultipleStoredMatches(matches: ParsedBattrickMatch[]): Promise<void> {
  if (!matches || matches.length === 0) return;

  const currentMap = getStoredMatches();
  matches.forEach(m => {
    if (m && m.matchId) {
      currentMap[m.matchId] = m;
    }
  });

  try {
    localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(currentMap));
    window.dispatchEvent(new CustomEvent('bt_matches_updated', { detail: { count: matches.length } }));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Failed to save matches map to localStorage:', e);
  }

  // Cloud Firestore Persistence
  try {
    const user = getCustomUser();
    if (user && user.uid && db) {
      for (const m of matches) {
        if (!m || !m.matchId) continue;
        const matchRef = doc(db, 'users_data', user.uid, 'matches', m.matchId);
        await setDoc(matchRef, {
          ...m,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }
  } catch (cloudErr) {
    console.warn('Could not mirror matches batch to cloud Firestore:', cloudErr);
  }
}

export async function deleteStoredMatch(matchId: string): Promise<void> {
  const currentMap = getStoredMatches();
  delete currentMap[matchId];

  try {
    localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(currentMap));
    window.dispatchEvent(new CustomEvent('bt_matches_updated', { detail: { matchId, deleted: true } }));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Failed to delete match from localStorage:', e);
  }

  try {
    const user = getCustomUser();
    if (user && user.uid && db) {
      const matchRef = doc(db, 'users_data', user.uid, 'matches', matchId);
      await deleteDoc(matchRef);
    }
  } catch (cloudErr) {
    console.warn('Could not delete match from Firestore:', cloudErr);
  }
}

export async function clearAllStoredMatches(): Promise<void> {
  try {
    localStorage.removeItem(MATCH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('bt_matches_updated', { detail: { cleared: true } }));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {
    console.error('Failed to clear matches:', e);
  }
}

// -------------------------------------------------------------
// Match Retrieval & Parsing Engine
// -------------------------------------------------------------

export async function fetchAndStoreSingleMatch(
  matchId: string, 
  credentials?: { username?: string; password?: string; sessionToken?: string }
): Promise<ParsedBattrickMatch> {
  const targetId = matchId.trim();
  if (!targetId) {
    throw new Error('Valid Match ID is required.');
  }

  const username = credentials?.username || localStorage.getItem('bt_direct_user') || '';
  const password = credentials?.password || localStorage.getItem('bt_direct_pass') || '';
  const sessionToken = credentials?.sessionToken || localStorage.getItem('bt_sync_session') || '';

  const res = await fetch('/api/sync-battrick-match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      matchId: targetId,
      username,
      password,
      sessionToken
    })
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || `Failed to fetch match #${targetId} (HTTP ${res.status})`);
  }

  if (data.sessionToken) {
    localStorage.setItem('bt_sync_session', data.sessionToken);
  }

  const combinedHtml = `${data.matchHtml || ''}\n${data.summaryHtml || ''}`;
  const parsed = parseBattrickFullMatch(combinedHtml, targetId);

  await saveStoredMatch(parsed);
  return parsed;
}

// -------------------------------------------------------------
// Lineup & Skills Prediction Engine
// -------------------------------------------------------------

/**
 * Reverse-engineers team batting order, bowling allocations, 5th bowler vulnerabilities,
 * and skill levels based on all stored matches for a specific team.
 */
export function predictTeamLineupAndSkills(
  targetTeamName: string, 
  matchFormat?: string,
  allMatches?: ParsedBattrickMatch[]
): PredictedTeamLineup | null {
  const matches = allMatches || getStoredMatchesList();
  if (!matches || matches.length === 0) return null;

  const cleanTarget = targetTeamName.trim().toLowerCase();
  
  // Filter matches involving target team (and optionally matching format)
  const teamMatches = matches.filter(m => {
    const isHome = m.homeTeam && m.homeTeam.toLowerCase().includes(cleanTarget);
    const isAway = m.awayTeam && m.awayTeam.toLowerCase().includes(cleanTarget);
    if (!isHome && !isAway) return false;
    
    if (matchFormat && matchFormat !== 'All') {
      const targetFmt = matchFormat.toLowerCase().replace(/[\s-_]/g, '');
      const matchFmt = (m.matchType || '').toLowerCase().replace(/[\s-_]/g, '');
      if (!matchFmt.includes(targetFmt) && !targetFmt.includes(matchFmt)) {
        return false;
      }
    }
    return true;
  });

  if (teamMatches.length === 0) return null;

  // Player aggregation dictionaries
  const playerStatsMap: Record<string, {
    name: string;
    battingPositions: number[];
    runs: number[];
    strikeRates: number[];
    foursTotal: number;
    sixesTotal: number;
    dismissals: string[];
    inningsCount: number;
    bowlingOvers: number[];
    bowlingRuns: number[];
    bowlingWickets: number[];
    bowlingPositions: number[];
    isSpinCount: number;
    isSeamCount: number;
  }> = {};

  // Sector ratings aggregates
  const sectorSums = {
    topOrder: [] as number[],
    middleOrder: [] as number[],
    lowerOrder: [] as number[],
    seamBowling: [] as number[],
    spinBowling: [] as number[],
    fielding: [] as number[],
    batstats: [] as number[]
  };

  for (const match of teamMatches) {
    const isHome = match.homeTeam.toLowerCase().includes(cleanTarget);
    const ratings = isHome ? match.homeRatings : match.awayRatings;

    if (ratings) {
      if (ratings.topOrderScore) sectorSums.topOrder.push(ratings.topOrderScore);
      if (ratings.middleOrderScore) sectorSums.middleOrder.push(ratings.middleOrderScore);
      if (ratings.lowerOrderScore) sectorSums.lowerOrder.push(ratings.lowerOrderScore);
      if (ratings.seamBowlingScore) sectorSums.seamBowling.push(ratings.seamBowlingScore);
      if (ratings.spinBowlingScore) sectorSums.spinBowling.push(ratings.spinBowlingScore);
      if (ratings.fieldingScore) sectorSums.fielding.push(ratings.fieldingScore);
      if (ratings.batstat) sectorSums.batstats.push(ratings.batstat);
    }

    // Process Innings for Batters and Bowlers
    for (const inn of match.innings) {
      const isInnForTarget = inn.teamName.toLowerCase().includes(cleanTarget);
      
      // If this is the target team batting:
      if (isInnForTarget && inn.batters) {
        inn.batters.forEach((b, idx) => {
          const pName = b.name.trim();
          if (!pName) return;
          if (!playerStatsMap[pName]) {
            playerStatsMap[pName] = {
              name: pName,
              battingPositions: [],
              runs: [],
              strikeRates: [],
              foursTotal: 0,
              sixesTotal: 0,
              dismissals: [],
              inningsCount: 0,
              bowlingOvers: [],
              bowlingRuns: [],
              bowlingWickets: [],
              bowlingPositions: [],
              isSpinCount: 0,
              isSeamCount: 0
            };
          }
          const rec = playerStatsMap[pName];
          rec.battingPositions.push(b.order || (idx + 1));
          rec.runs.push(b.runs);
          rec.strikeRates.push(b.strikeRate);
          rec.foursTotal += (b.fours || 0);
          rec.sixesTotal += (b.sixes || 0);
          rec.dismissals.push(b.dismissal);
          rec.inningsCount++;
        });
      }

      // If this is the opposition batting, then target team is BOWLING:
      if (!isInnForTarget && inn.bowlers) {
        inn.bowlers.forEach((bw, bIdx) => {
          const bName = bw.name.trim();
          if (!bName) return;
          if (!playerStatsMap[bName]) {
            playerStatsMap[bName] = {
              name: bName,
              battingPositions: [],
              runs: [],
              strikeRates: [],
              foursTotal: 0,
              sixesTotal: 0,
              dismissals: [],
              inningsCount: 0,
              bowlingOvers: [],
              bowlingRuns: [],
              bowlingWickets: [],
              bowlingPositions: [],
              isSpinCount: 0,
              isSeamCount: 0
            };
          }
          const rec = playerStatsMap[bName];
          rec.bowlingPositions.push(bw.order || (bIdx + 1));
          rec.bowlingOvers.push(bw.overs);
          rec.bowlingRuns.push(bw.runs);
          rec.bowlingWickets.push(bw.wickets);
          if (bw.isSpin) rec.isSpinCount++;
          if (bw.isSeam) rec.isSeamCount++;
        });
      }
    }
  }

  // Calculate Average Ratings
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  
  const avgTopOrder = avg(sectorSums.topOrder) || 12;
  const avgMiddleOrder = avg(sectorSums.middleOrder) || 10;
  const avgLowerOrder = avg(sectorSums.lowerOrder) || 4;
  const avgSeam = avg(sectorSums.seamBowling) || 10;
  const avgSpin = avg(sectorSums.spinBowling) || 6;
  const avgFielding = avg(sectorSums.fielding) || 9;
  const avgBatstat = sectorSums.batstats.length > 0 
    ? Math.round(avg(sectorSums.batstats)) 
    : Math.round((avgTopOrder + avgMiddleOrder + avgLowerOrder) * 7);

  // Build Player Role Predictions
  const playerRoles: PredictedPlayerRole[] = Object.values(playerStatsMap).map(p => {
    // Mode of batting positions
    const posCounts: Record<number, number> = {};
    p.battingPositions.forEach(pos => {
      posCounts[pos] = (posCounts[pos] || 0) + 1;
    });
    let modalBatPos = 11;
    let maxBatCount = -1;
    Object.entries(posCounts).forEach(([posStr, count]) => {
      if (count > maxBatCount) {
        maxBatCount = count;
        modalBatPos = parseInt(posStr, 10);
      }
    });

    const minPos = p.battingPositions.length > 0 ? Math.min(...p.battingPositions) : 11;
    const maxPos = p.battingPositions.length > 0 ? Math.max(...p.battingPositions) : 11;

    const totRuns = p.runs.reduce((a, b) => a + b, 0);
    const avgRuns = p.inningsCount > 0 ? parseFloat((totRuns / p.inningsCount).toFixed(1)) : 0;
    const highRun = p.runs.length > 0 ? Math.max(...p.runs) : 0;
    const avgSr = p.strikeRates.length > 0 ? parseFloat(avg(p.strikeRates).toFixed(1)) : 0;
    const notOutCount = p.dismissals.filter(d => d.toLowerCase().includes('not out')).length;

    // Bowling metrics
    const hasBowled = p.bowlingOvers.length > 0;
    const totOvers = p.bowlingOvers.reduce((a, b) => a + b, 0);
    const totBowlRuns = p.bowlingRuns.reduce((a, b) => a + b, 0);
    const totWickets = p.bowlingWickets.reduce((a, b) => a + b, 0);
    const avgOvers = teamMatches.length > 0 ? parseFloat((totOvers / teamMatches.length).toFixed(1)) : 0;
    const bowlEcon = totOvers > 0 ? parseFloat((totBowlRuns / totOvers).toFixed(2)) : 0;

    // Bowling position mode
    const bowlPosCounts: Record<number, number> = {};
    p.bowlingPositions.forEach(bPos => {
      bowlPosCounts[bPos] = (bowlPosCounts[bPos] || 0) + 1;
    });
    let modalBowlPos = 5;
    let maxBowlCount = -1;
    Object.entries(bowlPosCounts).forEach(([posStr, count]) => {
      if (count > maxBowlCount) {
        maxBowlCount = count;
        modalBowlPos = parseInt(posStr, 10);
      }
    });

    const bowlingType: 'Seam' | 'Spin' | 'Unknown' = 
      p.isSpinCount > p.isSeamCount ? 'Spin' : (p.isSeamCount > 0 ? 'Seam' : 'Unknown');

    // Estimate skill levels derived from position and sector score
    let estBatScore = modalBatPos <= 3 
      ? avgTopOrder 
      : (modalBatPos <= 6 ? avgMiddleOrder : avgLowerOrder);
    
    // Adjust slightly for individual run scoring efficiency
    if (avgRuns > 45) estBatScore += 0.8;
    else if (avgRuns < 10 && modalBatPos <= 6) estBatScore -= 0.6;
    estBatScore = Math.max(1, Math.min(20, parseFloat(estBatScore.toFixed(1))));
    const estBatGrade = getSkillLabelFromNumber(Math.round(estBatScore));

    let estBowlScore = 3;
    if (hasBowled) {
      estBowlScore = bowlingType === 'Spin' ? avgSpin : avgSeam;
      if (bowlEcon > 6.5) estBowlScore -= 1.2;
      else if (bowlEcon < 3.8) estBowlScore += 1.0;
      if (totWickets / (teamMatches.length || 1) >= 2) estBowlScore += 0.8;
    }
    estBowlScore = Math.max(1, Math.min(20, parseFloat(estBowlScore.toFixed(1))));
    const estBowlGrade = hasBowled ? getSkillLabelFromNumber(Math.round(estBowlScore)) : 'Abysmal';

    // 5th Bowler Risk Flag
    const isFifthBowlerRisk = hasBowled && (modalBowlPos >= 5 || avgOvers <= 6) && (bowlEcon >= 5.2 || estBowlScore <= 8);

    // Role classification
    let role: PredictedPlayerRole['role'] = 'Middle Order';
    if (modalBatPos <= 2) role = 'Opener';
    else if (modalBatPos === 3) role = 'Top Order';
    else if (modalBatPos >= 7 && hasBowled) role = modalBowlPos <= 2 ? 'Strike Bowler' : 'Change Bowler';
    else if (modalBatPos >= 7) role = 'Tail';
    else if (hasBowled && modalBowlPos <= 4) role = 'Wicket Keeper / All-rounder';

    return {
      name: p.name,
      battingOrderModal: modalBatPos,
      battingOrderRange: [minPos, maxPos],
      matchesPlayed: p.inningsCount || p.bowlingOvers.length,
      totalRuns: totRuns,
      averageRuns: avgRuns,
      highestScore: highRun,
      strikeRate: avgSr,
      fours: p.foursTotal,
      sixes: p.sixesTotal,
      inningsCount: p.inningsCount,
      notOuts: notOutCount,
      estimatedBattingGrade: estBatGrade,
      estimatedBattingScore: estBatScore,
      isBowler: hasBowled,
      bowlingOrderModal: hasBowled ? modalBowlPos : undefined,
      oversPerMatch: avgOvers,
      wickets: totWickets,
      economy: bowlEcon,
      bowlingType,
      isFifthBowlerRisk,
      estimatedBowlingGrade: estBowlGrade,
      estimatedBowlingScore: estBowlScore,
      role
    };
  });

  // Sort Predicted Batting Order: #1 to #11
  const predictedBattingOrder = [...playerRoles]
    .sort((a, b) => a.battingOrderModal - b.battingOrderModal)
    .slice(0, 11);

  // If less than 11 players recorded, pad with typical structure
  while (predictedBattingOrder.length < 11) {
    const nextPos = predictedBattingOrder.length + 1;
    predictedBattingOrder.push({
      name: `Player #${nextPos}`,
      battingOrderModal: nextPos,
      battingOrderRange: [nextPos, nextPos],
      matchesPlayed: 1,
      totalRuns: 0,
      averageRuns: 0,
      highestScore: 0,
      strikeRate: 50,
      fours: 0,
      sixes: 0,
      inningsCount: 0,
      notOuts: 0,
      estimatedBattingGrade: nextPos <= 3 ? 'Strong' : (nextPos <= 6 ? 'Competent' : 'Feeble'),
      estimatedBattingScore: nextPos <= 3 ? 8 : (nextPos <= 6 ? 6 : 3),
      isBowler: nextPos >= 7,
      oversPerMatch: nextPos >= 7 ? 10 : 0,
      wickets: 0,
      economy: 4.5,
      bowlingType: 'Seam',
      isFifthBowlerRisk: nextPos === 5,
      estimatedBowlingGrade: nextPos >= 7 ? 'Strong' : 'Abysmal',
      estimatedBowlingScore: nextPos >= 7 ? 8 : 1,
      role: nextPos >= 7 ? 'Strike Bowler' : 'Middle Order'
    });
  }

  // Identify Bowling Attack
  const predictedBowlingOrder = [...playerRoles]
    .filter(p => p.isBowler)
    .sort((a, b) => (a.bowlingOrderModal || 99) - (b.bowlingOrderModal || 99));

  // Find 5th Bowler Vulnerability
  const fifthBowler = predictedBowlingOrder.find(p => p.isFifthBowlerRisk) || 
                      predictedBowlingOrder[predictedBowlingOrder.length - 1] || 
                      predictedBattingOrder[4];

  const fifthBowlerSummary = {
    bowlerName: fifthBowler?.name || '5th Bowler / All-rounder',
    avgEconomy: fifthBowler?.economy || 5.6,
    riskLevel: (fifthBowler?.economy > 5.5 ? 'High' : (fifthBowler?.economy > 4.5 ? 'Medium' : 'Low')) as 'High' | 'Medium' | 'Low',
    analysis: `Attacking ${fifthBowler?.name || 'the 5th bowler'} provides high run-scoring potential. Past matches show this slot concedes higher economy (${fifthBowler?.economy || 5.6} RPO) with low penetration.`
  };

  // Tactical Recommendations
  const tacticalRecommendations: string[] = [
    `Target 5th bowler (${fifthBowlerSummary.bowlerName}) with aggressive batting orders in middle overs.`,
    `Top Order rating averages ${getSkillLabelFromNumber(Math.round(avgTopOrder))} (${avgTopOrder.toFixed(1)}) — deploy your best opening seamers to take early wickets.`,
    `Lower order collapses after position #${predictedBattingOrder[6]?.name ? '7 (' + predictedBattingOrder[6].name + ')' : '7'} with an average lower order rating of ${getSkillLabelFromNumber(Math.round(avgLowerOrder))}.`
  ];

  return {
    teamName: targetTeamName,
    sampleMatchesCount: teamMatches.length,
    matchFormat: matchFormat || 'All Formats',
    predictedBattingOrder,
    predictedBowlingOrder,
    fifthBowlerRiskSummary: fifthBowlerSummary,
    predictedRatings: {
      topOrder: { text: getSkillLabelFromNumber(Math.round(avgTopOrder)), score: avgTopOrder },
      middleOrder: { text: getSkillLabelFromNumber(Math.round(avgMiddleOrder)), score: avgMiddleOrder },
      lowerOrder: { text: getSkillLabelFromNumber(Math.round(avgLowerOrder)), score: avgLowerOrder },
      seamBowling: { text: getSkillLabelFromNumber(Math.round(avgSeam)), score: avgSeam },
      spinBowling: { text: getSkillLabelFromNumber(Math.round(avgSpin)), score: avgSpin },
      fielding: { text: getSkillLabelFromNumber(Math.round(avgFielding)), score: avgFielding },
      estimatedBatstats: avgBatstat
    },
    tacticalRecommendations
  };
}
