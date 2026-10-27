/**
 * Format-aware Starting XI suggestion for Manager desk → Lineup.
 */
import type { BattrickPlayer, BattrickGame } from '../types';

export type LineupStrategy =
  | 'Balanced Attack'
  | 'Batting Powerhouse'
  | 'Green Top Blitzers'
  | 'Spin Dominance';

export type MatchFormat = 'FC' | 'OD' | 'BT20' | 'CUP' | 'OTHER';

export interface LineupSlot {
  order: number;
  playerId: string;
  name: string;
  role: string;
  batting: number;
  bowling: number;
  keeping: number;
  bowlingType?: string;
}

export interface SuggestedLineup {
  format: MatchFormat;
  strategy: LineupStrategy;
  effort: 'TIE' | 'PAN' | 'GFI';
  reason: string;
  xi: LineupSlot[];
  /** Bowling order derived from the XI — strongest bowling first */
  bowlingOrder: LineupSlot[];
  match?: {
    opponent: string;
    type: string;
    date: string;
    venue?: string;
  };
}

const SEAM = new Set(['Fast', 'Fast Medium', 'Medium', 'Seam']);

export function detectMatchFormat(type?: string): MatchFormat {
  const t = (type || '').toLowerCase();
  if (/\b(bt20|t20|twenty\s*20|twenty20)\b/.test(t)) return 'BT20';
  if (/\b(fc|first\s*class|test)\b/.test(t)) return 'FC';
  if (/\b(od|odi|one\s*day|50\s*over)\b/.test(t)) return 'OD';
  if (/\b(cup|knockout|playoff|final)\b/.test(t)) return 'CUP';
  return 'OTHER';
}

export function strategyForFormat(format: MatchFormat): {
  strategy: LineupStrategy;
  effort: 'TIE' | 'PAN' | 'GFI';
  reason: string;
} {
  switch (format) {
    case 'BT20':
      return {
        strategy: 'Batting Powerhouse',
        effort: 'GFI',
        reason: 'Short format — prioritise batting depth and strike; bowl with intensity.',
      };
    case 'FC':
      return {
        strategy: 'Balanced Attack',
        effort: 'PAN',
        reason: 'Long format — balance bat and bowl; protect fitness over four days.',
      };
    case 'OD':
      return {
        strategy: 'Balanced Attack',
        effort: 'PAN',
        reason: 'One-day — balanced XI; middle-order and death bowling matter.',
      };
    case 'CUP':
      return {
        strategy: 'Green Top Blitzers',
        effort: 'GFI',
        reason: 'Knockout — seam attack and full effort; one loss ends the run.',
      };
    default:
      return {
        strategy: 'Balanced Attack',
        effort: 'PAN',
        reason: 'Default balanced XI until format is clearer.',
      };
  }
}

function skill(p: BattrickPlayer, key: keyof NonNullable<BattrickPlayer['skills']>): number {
  return p.skills?.[key] ?? 0;
}

/**
 * Pick 11 players using the same strategy family as LineupOptimizer.
 */
export function suggestStartingXI(
  squad: BattrickPlayer[],
  match?: BattrickGame | null
): SuggestedLineup | null {
  if (!squad || squad.length < 11) return null;

  const format = detectMatchFormat(match?.type);
  const { strategy, effort, reason } = strategyForFormat(format);

  const sortedKeepers = [...squad].sort((a, b) => {
    const kd = skill(b, 'keeping') - skill(a, 'keeping');
    if (kd) return kd;
    return skill(b, 'batting') - skill(a, 'batting');
  });
  const keeper = sortedKeepers[0];
  const pool = squad.filter((p) => p.id !== keeper.id);

  let topBatters: BattrickPlayer[] = [];
  let chosenBowlers: BattrickPlayer[] = [];

  if (strategy === 'Spin Dominance') {
    const spins = pool
      .filter((p) => (p.bowlingType || '').toLowerCase().includes('spin'))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'));
    const others = pool
      .filter((p) => !(p.bowlingType || '').toLowerCase().includes('spin'))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'));
    chosenBowlers = [...spins, ...others].slice(0, 5);
    const ids = new Set(chosenBowlers.map((p) => p.id));
    topBatters = pool
      .filter((p) => !ids.has(p.id))
      .sort((a, b) => skill(b, 'batting') - skill(a, 'batting'))
      .slice(0, 5);
  } else if (strategy === 'Green Top Blitzers') {
    const seams = pool
      .filter((p) => SEAM.has(p.bowlingType || ''))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'));
    const others = pool
      .filter((p) => !SEAM.has(p.bowlingType || ''))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'));
    chosenBowlers = [...seams, ...others].slice(0, 5);
    const ids = new Set(chosenBowlers.map((p) => p.id));
    topBatters = pool
      .filter((p) => !ids.has(p.id))
      .sort((a, b) => skill(b, 'batting') - skill(a, 'batting'))
      .slice(0, 5);
  } else if (strategy === 'Batting Powerhouse') {
    topBatters = [...pool]
      .sort((a, b) => skill(b, 'batting') - skill(a, 'batting'))
      .slice(0, 7);
    const ids = new Set(topBatters.map((p) => p.id));
    chosenBowlers = pool
      .filter((p) => !ids.has(p.id))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'))
      .slice(0, 3);
  } else {
    topBatters = [...pool]
      .sort((a, b) => skill(b, 'batting') - skill(a, 'batting'))
      .slice(0, 5);
    const ids = new Set(topBatters.map((p) => p.id));
    chosenBowlers = pool
      .filter((p) => !ids.has(p.id))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'))
      .slice(0, 5);
  }

  const xi: LineupSlot[] = [];
  const push = (order: number, p: BattrickPlayer, roleHint?: string) => {
    xi.push({
      order,
      playerId: p.id,
      name: p.name,
      role: roleHint || p.role || 'Player',
      batting: skill(p, 'batting'),
      bowling: skill(p, 'bowling'),
      keeping: skill(p, 'keeping'),
      bowlingType: p.bowlingType,
    });
  };

  const batCount = 5;
  for (let i = 0; i < batCount && i < topBatters.length; i++) {
    push(i + 1, topBatters[i], 'Batter');
  }

  if (chosenBowlers[0]) {
    const b = chosenBowlers[0];
    push(6, b, skill(b, 'batting') >= 6 ? 'All-rounder' : 'Bowler');
  }

  push(7, keeper, 'Keeper');

  if (strategy === 'Batting Powerhouse') {
    if (topBatters[5]) push(8, topBatters[5], 'Batter');
    if (topBatters[6]) push(9, topBatters[6], 'Batter');
    if (chosenBowlers[1]) push(10, chosenBowlers[1], 'Bowler');
    if (chosenBowlers[2]) push(11, chosenBowlers[2], 'Bowler');
  } else {
    for (let i = 1; i < chosenBowlers.length && xi.length < 11; i++) {
      push(xi.length + 1, chosenBowlers[i], 'Bowler');
    }
  }

  const used = new Set(xi.map((s) => s.playerId));
  const rest = squad
    .filter((p) => !used.has(p.id))
    .sort(
      (a, b) =>
        skill(b, 'batting') +
        skill(b, 'bowling') -
        (skill(a, 'batting') + skill(a, 'bowling'))
    );
  while (xi.length < 11 && rest.length) {
    const p = rest.shift()!;
    push(xi.length + 1, p);
  }

  xi.sort((a, b) => a.order - b.order);
  const xiFinal = xi.slice(0, 11);

  const bowlingOrder = [...xiFinal]
    .filter((s) => {
      const type = (s.bowlingType || '').trim();
      return type && type.toLowerCase() !== 'none' && (s.bowling || 0) > 0;
    })
    .sort((a, b) => b.bowling - a.bowling || a.order - b.order)
    .map((s, i) => ({ ...s, order: i + 1 }));

  return {
    format,
    strategy,
    effort,
    reason,
    xi: xiFinal,
    bowlingOrder,
    match: match
      ? {
          opponent: match.opponent || 'TBD',
          type: match.type || 'Match',
          date: match.date || '',
          venue: match.venue,
        }
      : undefined,
  };
}

export const LINEUP_CONTEXT_KEY = 'bt_lineup_match_context';

export function saveLineupContext(suggestion: SuggestedLineup): void {
  try {
    localStorage.setItem(LINEUP_CONTEXT_KEY, JSON.stringify(suggestion));
    localStorage.setItem('bt_match_effort', suggestion.effort);
    localStorage.setItem('bt_lineup_strategy', suggestion.strategy);
  } catch {}
}

export function loadLineupContext(): SuggestedLineup | null {
  try {
    const raw = localStorage.getItem(LINEUP_CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SuggestedLineup;
  } catch {
    return null;
  }
}

export function clearLineupContext(): void {
  try {
    localStorage.removeItem(LINEUP_CONTEXT_KEY);
  } catch {}
}
