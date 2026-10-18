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

export function getCurrentBattrickDate(): { season: number; week: number } {
  // Season 69, Week 1 started on Monday, July 27, 2026 (UTC)
  const anchorDate = Date.UTC(2026, 6, 27); // Month is 0-indexed, so 6 is July
  const now = Date.now();
  
  const daysSinceAnchor = Math.floor((now - anchorDate) / (1000 * 60 * 60 * 24));
  const weeksSinceAnchor = Math.floor(daysSinceAnchor / 7);
  
  const season = 69 + Math.floor(weeksSinceAnchor / 16);
  const week = ((weeksSinceAnchor % 16) + 16) % 16 + 1;
  
  return { season, week };
}

// Converts date string (e.g. "11/09/2026" or "11/09/2026 00:30" or "2026-09-11") to a millisecond timestamp
export function parseGameDateToTimestamp(dateStr?: string, timeStr?: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  let d = dateStr.trim();
  let time = timeStr?.trim() || '';

  // Handle embedded time in dateStr like "11/09/2026 00:30"
  if (d.includes(' ')) {
    const parts = d.split(/\s+/);
    d = parts[0];
    if (!time && parts[1]) time = parts[1];
  }

  // Handle standard Battrick DD/MM/YYYY
  if (d.includes('/')) {
    const parts = d.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      let hours = 0;
      let minutes = 0;
      if (time && time.includes(':')) {
        const tParts = time.split(':');
        hours = parseInt(tParts[0], 10) || 0;
        minutes = parseInt(tParts[1], 10) || 0;
      }
      const dt = new Date(year, month, day, hours, minutes, 0, 0);
      return isNaN(dt.getTime()) ? null : dt.getTime();
    }
  }

  const parsed = Date.parse(`${d} ${time}`.trim());
  return isNaN(parsed) ? null : parsed;
}

// Checks if a fixture takes place from today (start of day) forward 7 days in advance
export function isGameInNext7Days(dateStr?: string, timeStr?: string): boolean {
  const gameTs = parseGameDateToTimestamp(dateStr, timeStr);
  if (!gameTs) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  // 7 full days forward (inclusive of day 7 through 23:59:59)
  const endOf7Days = startOfToday + (7 * 24 * 60 * 60 * 1000) + (24 * 60 * 60 * 1000 - 1);

  return gameTs >= startOfToday && gameTs <= endOf7Days;
}

export function getNext7DaysDateRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000));
  
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const label = `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
  return { start, end, label };
}

/** Absolute Battrick week number for a dd/mm/yyyy date (weeks tick over on the same anchor the app uses everywhere). */
export function getBattrickWeekIndex(dateStr?: string): number | null {
  const m = (dateStr || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  const t = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const anchor = Date.UTC(2026, 6, 27);
  const days = Math.floor((t + 12 * 3600 * 1000 - anchor) / 86_400_000);
  return Math.floor(days / 7);
}

export function getBattrickDateForString(dateStr: string): { season: number; week: number } | null {
  if (!dateStr) return null;
  let parsedDate = NaN;
  
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
       parsedDate = Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  } else {
    parsedDate = Date.parse(dateStr);
  }

  if (isNaN(parsedDate)) return null;

  const anchorDate = Date.UTC(2026, 6, 27);
  // Add 12 hours to safely put it in the middle of the day before division
  const daysSinceAnchor = Math.floor((parsedDate + (12*60*60*1000) - anchorDate) / (1000 * 60 * 60 * 24));
  const weeksSinceAnchor = Math.floor(daysSinceAnchor / 7);
  
  const season = 69 + Math.floor(weeksSinceAnchor / 16);
  const week = ((weeksSinceAnchor % 16) + 16) % 16 + 1;
  
  return { season, week };
}

// Start a player's history with ONE real entry: what we know right now. Earlier weeks are
// unknown, so we no longer invent them (the old version fabricated 16 weeks of skills, BTR,
// form and "Training Pop" notes, which polluted pop detection and reports). Real history
// accumulates as you sync: mergePlayerAndTrackHistory appends an entry whenever something changes.
export function generateRealisticHistory(player: BattrickPlayer): PlayerHistoryEntry[] {
  const { season, week } = getCurrentBattrickDate();
  return [
    {
      season,
      week,
      btRating: player.btRating,
      wage: player.wage,
      form: player.form,
      fitness: player.fitness,
      skills: { ...player.skills },
      note: 'Current Status',
    },
  ];
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
    history: existingHistory,
    // Downloaded career stats live only on the player-details pages, never on squad.asp,
    // so a squad resync must carry them over.
    ...(existingPlayer.stats ? { stats: existingPlayer.stats } : {}),
    ...(existingPlayer.careerStats && !newPlayer.careerStats ? { careerStats: existingPlayer.careerStats } : {}),
    // Respect a manual role tag the user set on this player — never let a
    // resync from parsed Battrick data silently overwrite it.
    ...(existingPlayer.roleManuallySet
      ? { role: existingPlayer.role, roleManuallySet: true }
      : {}),
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

/**
 * One-time cleanup: earlier versions invented 16 weeks of history (fake skill pops, BTR, form).
 * Keep only each player's most recent entry so pop detection and reports use real data only.
 */
export function resetSyntheticHistoryOnce(): void {
  try {
    if (localStorage.getItem('bt_history_reset_v1')) return;
    const raw = localStorage.getItem('bt_squad');
    if (raw) {
      const squad = JSON.parse(raw);
      if (Array.isArray(squad)) {
        const cleaned = squad.map((p: any) =>
          Array.isArray(p?.history) && p.history.length > 1 ? { ...p, history: p.history.slice(-1) } : p
        );
        localStorage.setItem('bt_squad', JSON.stringify(cleaned));
      }
    }
    localStorage.setItem('bt_history_reset_v1', '1');
  } catch {
    // best effort
  }
}
