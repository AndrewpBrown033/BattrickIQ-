/**
 * Suggest a match XI + batting order + bowling order from squad + next fixture.
 */
import type { BattrickPlayer, BattrickGame } from '../types';

export type LineupStrategy = string;
export type MatchFormat = 'FC' | 'OD' | 'BT20' | 'CUP' | 'OTHER';
export type LineupFormat = MatchFormat;

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
  strategy: string;
  effort: string;
  reason: string;
  xi: LineupSlot[];
  /** Bowling order — strongest first, top 5 only */
  bowlingOrder: LineupSlot[];
  match?: {
    opponent: string;
    type: string;
    date: string;
    venue?: string;
  };
}

const SEAM = new Set(['Fast', 'Fast Medium', 'Medium', 'Seam']);
export const LINEUP_CONTEXT_KEY = 'bt_suggested_lineup_context';

function skill(p: BattrickPlayer, key: keyof NonNullable<BattrickPlayer['skills']>): number {
  return Number(p.skills?.[key] ?? 0) || 0;
}

export function detectMatchFormat(type?: string): MatchFormat {
  const t = (type || '').toLowerCase();
  if (/\b(bt20|t20|twenty\s*20|twenty20)\b/.test(t)) return 'BT20';
  if (/\b(fc|first\s*class|test)\b/.test(t)) return 'FC';
  if (/\b(od|one\s*day|list\s*a|50)\b/.test(t)) return 'OD';
  if (/\b(cup|knockout|final)\b/.test(t)) return 'CUP';
  return 'OTHER';
}

export function strategyForFormat(format: MatchFormat): {
  strategy: string;
  effort: string;
  reason: string;
} {
  switch (format) {
    case 'BT20':
      return {
        strategy: 'Power + death bowling',
        effort: 'High intensity',
        reason: 'T20 — prioritize strikers and death bowling over pure grinders.',
      };
    case 'OD':
      return {
        strategy: 'Balanced middle + death',
        effort: 'Standard',
        reason: 'One-day — balanced XI; middle-order and death bowling matter.',
      };
    case 'FC':
      return {
        strategy: 'Top-order solidity + four seam',
        effort: 'Patient',
        reason: 'First-class — solid openers, all-round depth, seam attack.',
      };
    case 'CUP':
      return {
        strategy: 'Best available XI',
        effort: 'High',
        reason: 'Cup — field the strongest balanced side.',
      };
    default:
      return {
        strategy: 'Best available XI',
        effort: 'Standard',
        reason: 'Default balanced XI from current squad strength.',
      };
  }
}

export function suggestStartingXI(
  squad: BattrickPlayer[],
  match?: BattrickGame | null
): SuggestedLineup | null {
  if (!squad || squad.length < 11) {
    // still try with whatever we have if >= 1
    if (!squad?.length) return null;
  }

  const format = detectMatchFormat(match?.type);
  const { strategy, effort, reason } = strategyForFormat(format);
  const pool = squad.filter((p) => p && p.id);

  let chosenBowlers: BattrickPlayer[] = [];
  if (format === 'FC') {
    const spins = pool
      .filter((p) => (p.bowlingType || '').toLowerCase().includes('spin'))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'));
    const others = pool
      .filter((p) => !(p.bowlingType || '').toLowerCase().includes('spin'))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'));
    chosenBowlers = [...spins, ...others].slice(0, 5);
  } else if (format === 'BT20') {
    chosenBowlers = pool
      .filter(
        (p) =>
          SEAM.has(p.bowlingType || '') ||
          (p.bowlingType || '').toLowerCase().includes('spin')
      )
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'))
      .slice(0, 5);
  } else {
    const seams = pool
      .filter((p) => SEAM.has(p.bowlingType || ''))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'));
    const others = pool
      .filter((p) => !SEAM.has(p.bowlingType || ''))
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'));
    chosenBowlers = [...seams, ...others].slice(0, 5);
  }

  if (chosenBowlers.length < 3) {
    chosenBowlers = pool
      .sort((a, b) => skill(b, 'bowling') - skill(a, 'bowling'))
      .slice(0, 5);
  }

  const keepers = pool
    .filter((p) => skill(p, 'keeping') >= 5 || (p.role || '').toLowerCase().includes('keep'))
    .sort((a, b) => skill(b, 'keeping') - skill(a, 'keeping'));
  const keeper = keepers[0];

  const batters = pool
    .filter((p) => !chosenBowlers.find((b) => b.id === p.id) && p.id !== keeper?.id)
    .sort((a, b) => skill(b, 'batting') - skill(a, 'batting'));

  const xi: LineupSlot[] = [];
  const used = new Set<string>();
  const push = (order: number, p: BattrickPlayer) => {
    if (used.has(p.id)) return;
    used.add(p.id);
    xi.push({
      order,
      playerId: p.id,
      name: p.name,
      role: p.role || 'Player',
      batting: skill(p, 'batting'),
      bowling: skill(p, 'bowling'),
      keeping: skill(p, 'keeping'),
      bowlingType: p.bowlingType,
    });
  };

  batters.slice(0, 2).forEach((p, i) => push(i + 1, p));
  batters.slice(2, 5).forEach((p) => push(xi.length + 1, p));
  if (keeper) push(xi.length + 1, keeper);
  chosenBowlers.forEach((p) => push(xi.length + 1, p));

  const rest = pool
    .filter((p) => !used.has(p.id))
    .sort(
      (a, b) =>
        skill(b, 'batting') +
        skill(b, 'bowling') -
        (skill(a, 'batting') + skill(a, 'bowling'))
    );
  while (xi.length < 11 && rest.length) {
    push(xi.length + 1, rest.shift()!);
  }

  xi.sort((a, b) => a.order - b.order);
  const xiFinal = xi.slice(0, 11);

  const bowlingOrder = [...xiFinal]
    .filter((s) => {
      const type = (s.bowlingType || '').trim();
      return type && type.toLowerCase() !== 'none' && (s.bowling || 0) > 0;
    })
    .sort((a, b) => b.bowling - a.bowling || a.order - b.order)
    .slice(0, 5)
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

/** Alias used by NextMatchLineupCard */
export const suggestLineup = suggestStartingXI;

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
