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

/**
 * Parse FC / OD / BT20 career tables from a Battrick playerdetails.asp HTML page.
 */
export function parseCareerStatsFromPlayerHtml(html: string): {
  firstClass: FormatStats;
  oneDay: FormatStats;
  bt20: FormatStats;
  careerStats: BattrickPlayer['careerStats'];
} | null {
  if (!html || html.length < 200) return null;

  const fc = emptyFormat('First Class', 'FC');
  const od = emptyFormat('One Day', 'OD');
  const t20 = emptyFormat('BT20', 'BT20');

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

  const rowRe =
    /(First\s*Class|One\s*Day|Twenty\s*20|BT\s*20|T20|FC|OD|ODI)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(text)) !== null) {
    const label = m[1].toLowerCase().replace(/\s+/g, '');
    const matches = parseInt(m[2], 10) || 0;
    const innings = parseInt(m[3], 10) || 0;
    const notOuts = parseInt(m[4], 10) || 0;
    const runs = parseInt(m[5].replace(/,/g, ''), 10) || 0;
    const target =
      label.includes('first') || label === 'fc'
        ? fc
        : label.includes('one') || label === 'od' || label === 'odi'
          ? od
          : t20;
    target.matches = Math.max(target.matches, matches);
    target.inningsBatted = Math.max(target.inningsBatted, innings);
    target.notOuts = Math.max(target.notOuts, notOuts);
    target.runs = Math.max(target.runs, runs);
    const dismissals = Math.max(1, innings - notOuts);
    if (runs > 0) target.battingAverage = Number((runs / dismissals).toFixed(2));
  }

  const bowlRe =
    /(First\s*Class|One\s*Day|Twenty\s*20|BT\s*20|T20|FC|OD|ODI)[^\d]{0,40}([\d.]+)\s+overs?[^\d]{0,20}(\d+)\s+wickets?/gi;
  while ((m = bowlRe.exec(text)) !== null) {
    const label = m[1].toLowerCase().replace(/\s+/g, '');
    const overs = parseFloat(m[2]) || 0;
    const wickets = parseInt(m[3], 10) || 0;
    const target =
      label.includes('first') || label === 'fc'
        ? fc
        : label.includes('one') || label === 'od' || label === 'odi'
          ? od
          : t20;
    target.oversBowled = Math.max(target.oversBowled, overs);
    target.wickets = Math.max(target.wickets, wickets);
  }

  try {
    if (typeof DOMParser !== 'undefined' && html.includes('<')) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const rows = Array.from(doc.querySelectorAll('tr'));
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td, th')).map(
          (c) => (c.textContent || '').trim()
        );
        if (cells.length < 4) continue;
        const head = cells[0].toLowerCase();
        let target: FormatStats | null = null;
        if (/first\s*class|^fc$/.test(head)) target = fc;
        else if (/one\s*day|^od$|^odi$/.test(head)) target = od;
        else if (/twenty|bt\s*20|^t20$/.test(head)) target = t20;
        if (!target) continue;

        const nums = cells.slice(1).map((c) => parseFloat(c.replace(/,/g, '')) || 0);
        if (nums.length >= 4 && nums[0] > 0) {
          target.matches = Math.max(target.matches, Math.round(nums[0]));
          if (nums[1] > 0) target.inningsBatted = Math.max(target.inningsBatted, Math.round(nums[1]));
          if (nums.length > 3 && nums[3] > 0) target.runs = Math.max(target.runs, Math.round(nums[3]));
          if (nums.length > 2) target.notOuts = Math.max(target.notOuts, Math.round(nums[2]));
          if (nums.length > 5 && nums[5] > 0) target.battingAverage = nums[5];
          if (cells.length > 5 && cells[5] && /[\d*]/.test(cells[5])) {
            target.highScore = cells[5];
          }
        }
      }
    }
  } catch {
    // ignore
  }

  const has =
    fc.matches + od.matches + t20.matches + fc.runs + od.runs + t20.runs + fc.wickets + od.wickets + t20.wickets >
    0;
  if (!has) return null;

  return {
    firstClass: fc,
    oneDay: od,
    bt20: t20,
    careerStats: {
      matches: fc.matches + od.matches + t20.matches,
      runs: fc.runs + od.runs + t20.runs,
      overs: fc.oversBowled + od.oversBowled + t20.oversBowled,
      fc: { matches: fc.matches, runs: fc.runs, overs: fc.oversBowled },
      od: { matches: od.matches, runs: od.runs, overs: od.oversBowled },
      t20: { matches: t20.matches, runs: t20.runs, overs: t20.oversBowled },
    },
  };
}
