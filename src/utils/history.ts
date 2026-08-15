import { BattrickPlayer, SKILL_LEVELS, getSkillLabel } from '../types';

export interface PlayerHistoryEntry {
  season: number;
  week: number;
  btRating: number;
  wage: number;
  form: number;
  fitness: number;
  skills: {
    batting: number;
    bowling: number;
    keeping: number;
    stamina: number;
    concentration: number;
    consistency: number;
    fielding: number;
    leadership: number;
    experience: number;
  };
  note?: string;
}

// Generate beautiful, realistic, historical weekly logs for a player going back 15 weeks
export function generateRealisticHistory(player: BattrickPlayer): PlayerHistoryEntry[] {
  const history: PlayerHistoryEntry[] = [];
  
  // Let's assume current week is Season 65, Week 10
  const currentSeason = 65;
  const currentWeek = 10;
  
  // Copy current skills to start reverse simulation
  const tempSkills = { ...player.skills };
  let currentBtr = player.btRating;
  let currentWage = player.wage;
  
  // Decide which skill to simulate pops for based on player role and nets
  const primarySkill = player.role === 'Batter' ? 'batting' : 
                       player.role === 'Bowler' ? 'bowling' : 
                       player.role === 'Keeper' ? 'keeping' : 'batting';
  
  // Secondary skill
  const secondarySkill = primarySkill === 'batting' ? 'concentration' : 'consistency';
  
  // Work backwards for 15 weeks
  for (let step = 0; step < 16; step++) {
    // Calculate season and week
    let w = currentWeek - step;
    let s = currentSeason;
    if (w <= 0) {
      w = 16 + w; // Battrick has 16 weeks per season
      s = currentSeason - 1;
    }
    
    // Simulate training pops working backward
    let note: string | undefined = undefined;
    
    // 17-21 year olds pop fast (every 4-6 weeks), 22-25 pop slower (7-10 weeks), older pop rarely
    const popRate = player.age <= 21 ? 5 : player.age <= 25 ? 8 : 12;
    
    // Check for simulated primary skill pop
    if (step > 0 && step % popRate === 0) {
      const key = primarySkill as keyof typeof tempSkills;
      if (tempSkills[key] > 2) {
        tempSkills[key] = tempSkills[key] - 1;
        note = `Training Pop: ${key.toUpperCase()} upgraded to ${getSkillLabel(key, tempSkills[key] + 1)}!`;
      }
    }
    
    // Check for simulated stamina / fielding pop
    if (step > 0 && step % (popRate * 2) === 2) {
      const key = Math.random() > 0.5 ? 'stamina' : 'fielding';
      if (tempSkills[key] > 2) {
        tempSkills[key] = tempSkills[key] - 1;
        note = `Training Pop: ${key.toUpperCase()} upgraded to ${getSkillLabel(key, tempSkills[key] + 1)}!`;
      }
    }
    
    // Check for simulated secondary skill pop
    if (step > 0 && step % (popRate * 2) === 5) {
      const key = secondarySkill as keyof typeof tempSkills;
      if (tempSkills[key] > 2) {
        tempSkills[key] = tempSkills[key] - 1;
        note = `Training Pop: ${key.toUpperCase()} upgraded to ${getSkillLabel(key, tempSkills[key] + 1)}!`;
      }
    }
    
    // Wage resets at season rollover (Week 1 of each season)
    if (s < currentSeason && w === 16 && step > 0) {
      // Younger players' wage grows faster, older players' stays constant or decays
      const growthFactor = player.age <= 22 ? 1.15 : player.age <= 27 ? 1.05 : 0.95;
      currentWage = Math.round((currentWage / growthFactor) / 100) * 100;
    }
    
    // Btr changes slightly every week, with a pop on skill upgrades
    let weeklyBtrChange = Math.round((Math.random() * 200 + 100)); // standard weekly growth
    if (note) {
      weeklyBtrChange += Math.round(1500 + Math.random() * 800); // bonus BTR on pops
    }
    
    if (step > 0) {
      currentBtr = Math.max(1000, currentBtr - weeklyBtrChange);
    }
    
    // Form and fitness fluctuate week by week
    const simForm = Math.max(3, Math.min(10, Math.round(player.form + (Math.sin(step) * 2))));
    const simFitness = Math.max(4, Math.min(10, Math.round(player.fitness + (Math.cos(step) * 1.5))));
    
    // Save record
    history.push({
      season: s,
      week: w,
      btRating: currentBtr,
      wage: currentWage,
      form: simForm,
      fitness: simFitness,
      skills: { ...tempSkills },
      note: step === 0 ? 'Current Status' : note
    });
  }
  
  // Return in chronological order (oldest to newest)
  return history.reverse();
}

// Check and update player history when a new paste import occurs
export function mergePlayerAndTrackHistory(
  existingPlayer: BattrickPlayer, 
  newPlayer: BattrickPlayer,
  currentSeason: number = 65,
  currentWeek: number = 10
): BattrickPlayer {
  // Ensure existing history exists
  let existingHistory = existingPlayer.history ? [...existingPlayer.history] : [];
  if (existingHistory.length === 0) {
    existingHistory = generateRealisticHistory(existingPlayer);
  }
  
  // Check if anything changed compared to the last history point
  const lastEntry = existingHistory[existingHistory.length - 1];
  
  const skillsChanged = 
    newPlayer.skills.batting !== lastEntry?.skills.batting ||
    newPlayer.skills.bowling !== lastEntry?.skills.bowling ||
    newPlayer.skills.keeping !== lastEntry?.skills.keeping ||
    newPlayer.skills.stamina !== lastEntry?.skills.stamina ||
    newPlayer.skills.concentration !== lastEntry?.skills.concentration ||
    newPlayer.skills.consistency !== lastEntry?.skills.consistency ||
    newPlayer.skills.fielding !== lastEntry?.skills.fielding;
    
  const ratingChanged = newPlayer.btRating !== lastEntry?.btRating;
  const wageChanged = newPlayer.wage !== lastEntry?.wage;
  
  const isNewWeek = lastEntry ? (lastEntry.season !== currentSeason || lastEntry.week !== currentWeek) : true;
  
  if (skillsChanged || ratingChanged || wageChanged || isNewWeek) {
    let note = '';
    if (skillsChanged) {
      const changedSkills: string[] = [];
      if (newPlayer.skills.batting > (lastEntry?.skills.batting || 0)) changedSkills.push(`BATTING (${getSkillLabel('batting', newPlayer.skills.batting)})`);
      if (newPlayer.skills.bowling > (lastEntry?.skills.bowling || 0)) changedSkills.push(`BOWLING (${getSkillLabel('bowling', newPlayer.skills.bowling)})`);
      if (newPlayer.skills.keeping > (lastEntry?.skills.keeping || 0)) changedSkills.push(`KEEPING (${getSkillLabel('keeping', newPlayer.skills.keeping)})`);
      if (newPlayer.skills.stamina > (lastEntry?.skills.stamina || 0)) changedSkills.push(`STAMINA (${getSkillLabel('stamina', newPlayer.skills.stamina)})`);
      if (newPlayer.skills.concentration > (lastEntry?.skills.concentration || 0)) changedSkills.push(`CONCENTRATION (${getSkillLabel('concentration', newPlayer.skills.concentration)})`);
      if (newPlayer.skills.consistency > (lastEntry?.skills.consistency || 0)) changedSkills.push(`CONSISTENCY (${getSkillLabel('consistency', newPlayer.skills.consistency)})`);
      if (newPlayer.skills.fielding > (lastEntry?.skills.fielding || 0)) changedSkills.push(`FIELDING (${getSkillLabel('fielding', newPlayer.skills.fielding)})`);
      
      if (changedSkills.length > 0) {
        note = `Weekly Training Pop: ${changedSkills.join(', ')}`;
      } else {
        note = 'Skill update detected';
      }
    } else if (ratingChanged) {
      const diff = newPlayer.btRating - lastEntry.btRating;
      note = `BTR change: ${diff > 0 ? '+' : ''}${diff.toLocaleString()}`;
    } else {
      note = 'Weekly snapshot';
    }
    
    // Add new history entry
    const newEntry: PlayerHistoryEntry = {
      season: currentSeason,
      week: currentWeek,
      btRating: newPlayer.btRating,
      wage: newPlayer.wage,
      form: newPlayer.form,
      fitness: newPlayer.fitness,
      skills: { ...newPlayer.skills },
      note
    };
    
    // If it's the exact same week, replace the last entry to prevent duplicates, otherwise append
    if (lastEntry && lastEntry.season === currentSeason && lastEntry.week === currentWeek) {
      existingHistory[existingHistory.length - 1] = newEntry;
    } else {
      existingHistory.push(newEntry);
    }
  }
  
  return {
    ...newPlayer,
    nets: existingPlayer.nets,
    history: existingHistory
  };
}

export interface WeeklyChanges {
  btRatingDiff: number;
  wageDiff: number;
  formDiff: number;
  fitnessDiff: number;
  skillPops: { skill: string; from: number; to: number }[];
  isPositive: boolean;
  isNegative: boolean;
}

export function getWeeklyChanges(player: BattrickPlayer): WeeklyChanges | null {
  if (!player.history || player.history.length < 2) return null;
  const current = player.history[player.history.length - 1];
  const previous = player.history[player.history.length - 2];

  const skillPops: { skill: string; from: number; to: number }[] = [];
  const skillsList = [
    { key: 'batting', label: 'Batting' },
    { key: 'bowling', label: 'Bowling' },
    { key: 'keeping', label: 'Wicket Keeping' },
    { key: 'stamina', label: 'Stamina' },
    { key: 'concentration', label: 'Concentration' },
    { key: 'consistency', label: 'Consistency' },
    { key: 'fielding', label: 'Fielding' },
    { key: 'leadership', label: 'Leadership' },
    { key: 'experience', label: 'Experience' },
  ] as const;

  for (const sk of skillsList) {
    const curVal = current.skills[sk.key as keyof typeof current.skills] || 0;
    const prevVal = previous.skills[sk.key as keyof typeof previous.skills] || 0;
    if (curVal !== prevVal) {
      skillPops.push({ skill: sk.label, from: prevVal, to: curVal });
    }
  }

  const btRatingDiff = current.btRating - previous.btRating;
  const wageDiff = current.wage - previous.wage;
  const formDiff = (current.form || 0) - (previous.form || 0);
  const fitnessDiff = (current.fitness || 0) - (previous.fitness || 0);

  const isPositive = btRatingDiff > 0 || wageDiff > 0 || formDiff > 0 || fitnessDiff > 0 || skillPops.some(p => p.to > p.from);
  const isNegative = btRatingDiff < 0 || wageDiff < 0 || formDiff < 0 || fitnessDiff < 0 || skillPops.some(p => p.to < p.from);

  return {
    btRatingDiff,
    wageDiff,
    formDiff,
    fitnessDiff,
    skillPops,
    isPositive,
    isNegative,
  };
}
