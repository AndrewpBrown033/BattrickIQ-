import { OpponentPlayer } from './src/types';

export function buildStrongestXI(players: OpponentPlayer[]): OpponentPlayer[] {
  if (!players || players.length === 0) return [];

  const getBattingScore = (p: OpponentPlayer) => {
    let score = 0;
    if (p.batting > 0) score = p.batting + (p.concentration || 0) * 0.3;
    else score = (p.estimatedSkillLevel || 1) * 2;
    // Boost score if they are explicitly a Batter
    if (p.primaryRoleClassifier === 'Batter' || p.role === 'Batter') score += 5;
    return score + (p.btRating / 100000);
  };
  
  const getBowlingScore = (p: OpponentPlayer) => {
    let score = 0;
    if (p.bowling > 0) score = p.bowling + (p.consistency || 0) * 0.3;
    else score = (p.estimatedSkillLevel || 1) * 2;
    // Boost score if explicitly Bowler
    if (p.primaryRoleClassifier === 'Bowler' || p.role === 'Bowler') score += 5;
    return score + (p.btRating / 100000);
  };
  
  const getKeepingScore = (p: OpponentPlayer) => {
    let score = 0;
    if (p.keeping > 0) score = p.keeping + p.batting * 0.5;
    else score = (p.estimatedSkillLevel || 1) * 2;
    return score + (p.btRating / 100000);
  };

  const pool = [...players];
  const xi: OpponentPlayer[] = [];

  // 1. Find Wicketkeeper
  let wks = pool.filter(p => p.primaryRoleClassifier === 'Wicketkeeper' || p.role === 'Keeper');
  wks.sort((a, b) => getKeepingScore(b) - getKeepingScore(a));
  
  let keeper: OpponentPlayer | null = null;
  if (wks.length > 0) {
    keeper = wks[0];
  } else {
    pool.sort((a, b) => b.btRating - a.btRating);
    keeper = pool[0];
  }
  
  if (keeper) {
    xi.push(keeper);
    const idx = pool.findIndex(p => p.id === keeper!.id);
    if (idx > -1) pool.splice(idx, 1);
  }

  // 2. Find 4-5 Bowlers
  let bowlers = pool.filter(p => p.primaryRoleClassifier === 'Bowler' || p.primaryRoleClassifier === 'All-Rounder' || p.role === 'Bowler');
  bowlers.sort((a, b) => getBowlingScore(b) - getBowlingScore(a));
  
  const selectedBowlers = bowlers.slice(0, 4);
  for (const b of selectedBowlers) {
    xi.push(b);
    const idx = pool.findIndex(p => p.id === b.id);
    if (idx > -1) pool.splice(idx, 1);
  }

  // 3. Fill the rest
  pool.sort((a, b) => getBattingScore(b) - getBattingScore(a));
  const selectedBatters = pool.slice(0, 11 - xi.length);
  for (const b of selectedBatters) {
    xi.push(b);
    const idx = pool.findIndex(p => p.id === b.id);
    if (idx > -1) pool.splice(idx, 1);
  }

  // 4. Arrange XI by Batting Score (Openers to Tail)
  xi.sort((a, b) => getBattingScore(b) - getBattingScore(a));

  // 5. Append bench
  pool.sort((a, b) => b.btRating - a.btRating);

  return [...xi, ...pool];
}
