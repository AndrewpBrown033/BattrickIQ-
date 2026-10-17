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
  /** True when at least one format has real match data from Battrick */
  hasRealData: boolean;
  /** True when values were synthesised (should stay false after this change) */
  isEstimated: boolean;
}

function emptyFormat(
  formatName: 'First Class' | 'One Day' | 'BT20',
  shortCode: 'FC' | 'OD' | 'BT20'
): FormatStats {
  return {
    formatName,
    shortCode,
    matches: 0,
    inningsBatted: 0,
    notOuts: 0,
    runs: 0,
    highScore: '0',
    battingAverage: 0,
    strikeRate: 0,
    fifties: 0,
    hundreds: 0,
    oversBowled: 0,
    wickets: 0,
    bestBowling: '0/0',
    bowlingAverage: 0,
    economyRate: 0,
    fiveWickets: 0,
    catches: 0,
    stumpings: 0,
  };
}

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function mergeFormat(base: FormatStats, raw: any | undefined | null): FormatStats {
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    matches: num(raw.matches) || base.matches,
    inningsBatted: num(raw.inningsBatted ?? raw.innings) || base.inningsBatted,
    notOuts: num(raw.notOuts) || base.notOuts,
    runs: num(raw.runs) || base.runs,
    highScore: raw.highScore != null ? String(raw.highScore) : base.highScore,
    battingAverage: num(raw.battingAverage ?? raw.batAvg) || base.battingAverage,
    strikeRate: num(raw.strikeRate) || base.strikeRate,
    fifties: num(raw.fifties) || base.fifties,
    hundreds: num(raw.hundreds) || base.hundreds,
    oversBowled: num(raw.oversBowled ?? raw.overs) || base.oversBowled,
    wickets: num(raw.wickets) || base.wickets,
    bestBowling: raw.bestBowling != null ? String(raw.bestBowling) : base.bestBowling,
    bowlingAverage: num(raw.bowlingAverage ?? raw.bowlAvg) || base.bowlingAverage,
    economyRate: num(raw.economyRate ?? raw.economy) || base.economyRate,
    fiveWickets: num(raw.fiveWickets) || base.fiveWickets,
    catches: num(raw.catches) || base.catches,
    stumpings: num(raw.stumpings) || base.stumpings,
  };
}

function fromCareerStats(player: BattrickPlayer): {
  fc: FormatStats;
  od: FormatStats;
  t20: FormatStats;
  has: boolean;
} {
  const fc = emptyFormat('First Class', 'FC');
  const od = emptyFormat('One Day', 'OD');
  const t20 = emptyFormat('BT20', 'BT20');
  const cs = player.careerStats;
  if (!cs) return { fc, od, t20, has: false };

  if (cs.fc) {
    fc.matches = num(cs.fc.matches);
    fc.runs = num(cs.fc.runs);
    fc.oversBowled = num(cs.fc.overs);
  }
  if (cs.od) {
    od.matches = num(cs.od.matches);
    od.runs = num(cs.od.runs);
    od.oversBowled = num(cs.od.overs);
  }
  if (cs.t20) {
    t20.matches = num(cs.t20.matches);
    t20.runs = num(cs.t20.runs);
    t20.oversBowled = num(cs.t20.overs);
  }

  if (!fc.matches && !od.matches && !t20.matches && num(cs.matches) > 0) {
    od.matches = num(cs.matches);
    od.runs = num(cs.runs);
    od.oversBowled = num(cs.overs);
  }

  if (player.battingAverage) {
    for (const f of [fc, od, t20]) {
      if (f.matches > 0 && !f.battingAverage) f.battingAverage = num(player.battingAverage);
    }
  }
  if (player.bowlingAverage) {
    for (const f of [fc, od, t20]) {
      if (f.matches > 0 && !f.bowlingAverage) f.bowlingAverage = num(player.bowlingAverage);
    }
  }

  const has = fc.matches + od.matches + t20.matches + fc.runs + od.runs + t20.runs > 0;
  return { fc, od, t20, has };
}

function computeSummary(fc: FormatStats, od: FormatStats, t20: FormatStats) {
  const totalMatches = fc.matches + od.matches + t20.matches;
  const totalRuns = fc.runs + od.runs + t20.runs;
  const totalWickets = fc.wickets + od.wickets + t20.wickets;
  const totalCatches =
    fc.catches + od.catches + t20.catches + fc.stumpings + od.stumpings + t20.stumpings;

  let highlight = 'No career data yet';
  if (totalMatches > 0) {
    highlight = 'From Battrick career tables';
    if (totalRuns > totalWickets * 20) highlight = 'Batting-focused career (synced)';
    else if (totalWickets > totalRuns / 15) highlight = 'Bowling-focused career (synced)';
  }

  return {
    totalMatches,
    totalRuns,
    totalWickets,
    totalCatches,
    bestRoleHighlight: highlight,
  };
}

/**
 * Career statistics for the player inspector.
 * Uses ONLY real data from Battrick (player.stats or player.careerStats).
 * Never invents match totals from skill/age hashes.
 */
export function getPlayerStats(player: BattrickPlayer): ComprehensivePlayerStats {
  let fc = emptyFormat('First Class', 'FC');
  let od = emptyFormat('One Day', 'OD');
  let t20 = emptyFormat('BT20', 'BT20');
  let hasRealData = false;

  if (player.stats && typeof player.stats === 'object') {
    const s = player.stats as any;
    fc = mergeFormat(fc, s.firstClass || s.fc || s.FC);
    od = mergeFormat(od, s.oneDay || s.od || s.OD || s.odi);
    t20 = mergeFormat(t20, s.bt20 || s.t20 || s.BT20 || s.T20);
    hasRealData =
      fc.matches + od.matches + t20.matches + fc.runs + od.runs + t20.runs + fc.wickets + od.wickets + t20.wickets >
      0;
  }

  if (!hasRealData) {
    const mapped = fromCareerStats(player);
    fc = mapped.fc;
    od = mapped.od;
    t20 = mapped.t20;
    hasRealData = mapped.has;
  }

  return {
    firstClass: fc,
    oneDay: od,
    bt20: t20,
    summary: computeSummary(fc, od, t20),
    hasRealData,
    isEstimated: false,
  };
}

/** Battrick `statview` ids on playerdetails.asp for the formats the app tracks. */
export const STATVIEW_TO_FORMAT: Record<number, 'firstClass' | 'oneDay' | 'bt20'> = {
  1: 'oneDay',
  8: 'bt20',
  2: 'firstClass',
};

function cellNum(text: string | null | undefined): number {
  const t = (text || '').replace(/[,\s*]/g, '');
  if (!t || t === '-') return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse ONE playerdetails.asp page (a single `statview` tab: OD, BT20 or FC).
 * The page holds two `table.playerstats` tables (Batting, Bowling), each with a
 * "Season" and a "Career" row. Career rows are used.
 *   Batting: M I R n.o. Ave SR HS C st 50s 100s
 *   Bowling: O M R W Ave SR Econ Best 5wi
 * Returns null if the page has no stats tables (e.g. the login page).
 */
export function parsePlayerStatsPage(html: string): {
  statview: number | null;
  stats: FormatStats;
} | null {
  if (!html || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table.playerstats'));
  if (tables.length === 0) return null;

  const selectedId = doc.querySelector('.stats-table ul.tabs li.selected')?.getAttribute('id') || '';
  const statview = /^tab(\d+)$/.test(selectedId) ? parseInt(selectedId.slice(3), 10) : null;
  const tabLabel = (doc.querySelector('.stats-table ul.tabs li.selected a')?.textContent || '').trim().toUpperCase();
  const fmt: FormatStats =
    tabLabel === 'FC' ? emptyFormat('First Class', 'FC')
    : tabLabel === 'BT20' ? emptyFormat('BT20', 'BT20')
    : emptyFormat('One Day', 'OD');

  const careerCells = (table: Element): string[] | null => {
    for (const row of Array.from(table.querySelectorAll('tr'))) {
      const th = row.querySelector('th');
      if (th && /^career$/i.test((th.textContent || '').trim())) {
        return Array.from(row.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
      }
    }
    return null;
  };

  for (const table of tables) {
    const heading = (table.querySelector('th')?.textContent || '').trim().toLowerCase();
    const c = careerCells(table);
    if (!c) continue;
    if (heading === 'batting' && c.length >= 11) {
      fmt.matches = cellNum(c[0]);
      fmt.inningsBatted = cellNum(c[1]);
      fmt.runs = cellNum(c[2]);
      fmt.notOuts = cellNum(c[3]);
      fmt.battingAverage = cellNum(c[4]);
      fmt.strikeRate = cellNum(c[5]);
      fmt.highScore = c[6] || '0';
      fmt.catches = cellNum(c[7]);
      fmt.stumpings = cellNum(c[8]);
      fmt.fifties = cellNum(c[9]);
      fmt.hundreds = cellNum(c[10]);
    } else if (heading === 'bowling' && c.length >= 9) {
      fmt.oversBowled = cellNum(c[0]);
      fmt.wickets = cellNum(c[3]);
      fmt.bowlingAverage = cellNum(c[4]);
      fmt.economyRate = cellNum(c[6]);
      fmt.bestBowling = c[7] && c[7] !== '-' ? c[7] : '0/0';
      fmt.fiveWickets = cellNum(c[8]);
    }
  }
  return { statview, stats: fmt };
}
