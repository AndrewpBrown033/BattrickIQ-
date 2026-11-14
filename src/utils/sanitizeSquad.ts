/**
 * Makes the saved squad safe to use.
 *
 * The squad lives in localStorage ("bt_squad") and is written by several importers, older versions of the app and
 * the cloud sync, so the shape on disk is not guaranteed: players can lack `skills` or `nets`, numbers can arrive as
 * text ("7", "1,500"), and entries can be null. Roughly twenty screens read it directly, and one malformed player
 * used to take the whole Squad page down. This normalises it once, at the source.
 */
import type { BattrickPlayer } from '../types';

const SKILL_KEYS = ['batting', 'bowling', 'keeping', 'stamina', 'leadership', 'experience', 'concentration', 'consistency', 'fielding'] as const;
const NET_KEYS = ['batting', 'bowling', 'keeping', 'fielding', 'stamina'] as const;

/** "1,500", "£1,500", " 7 ", 7 -> number; anything unreadable -> fallback. */
export function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[£$€,\s]/g, ''));
    return v.trim() !== '' && Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function sanitizePlayer(raw: unknown, index = 0): BattrickPlayer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p: any = raw;

  const skills: any = {};
  const rs = p.skills && typeof p.skills === 'object' ? p.skills : {};
  for (const k of SKILL_KEYS) skills[k] = Math.max(0, Math.min(20, toNum(rs[k], 0)));

  const nets: any = {};
  const rn = p.nets && typeof p.nets === 'object' ? p.nets : {};
  for (const k of NET_KEYS) nets[k] = Math.max(0, toNum(rn[k], 0));

  const id = p.id != null && String(p.id) !== '' ? String(p.id) : p.playerId != null ? String(p.playerId) : `player-${index}`;
  return {
    ...p,
    id,
    name: typeof p.name === 'string' && p.name.trim() ? p.name : `Player ${id}`,
    age: toNum(p.age, 0),
    wage: toNum(p.wage, 0),
    btRating: toNum(p.btRating, 0),
    form: toNum(p.form, 0),
    fitness: toNum(p.fitness, 0),
    bowlingType: typeof p.bowlingType === 'string' ? p.bowlingType : 'None',
    skills,
    nets,
  } as BattrickPlayer;
}

export function sanitizeSquad(raw: unknown): BattrickPlayer[] {
  if (!Array.isArray(raw)) return [];
  const out: BattrickPlayer[] = [];
  raw.forEach((r, i) => {
    const p = sanitizePlayer(r, i);
    if (p) out.push(p);
  });
  return out;
}

/**
 * One-off repair of what is already saved. Rewrites "bt_squad" only if cleaning changed it, and returns whether it
 * did. Call it BEFORE main.tsx wraps localStorage.setItem, so the repair is not recorded as a manual edit that
 * could win over newer cloud data.
 */
export function repairStoredSquad(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): boolean {
  try {
    const raw = storage.getItem('bt_squad');
    if (!raw) return false;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false; // unreadable JSON: leave it for the sync to replace; the pages already cope with it
    }
    // Some versions stored { players: [...] }
    const list = Array.isArray(parsed) ? parsed : Array.isArray((parsed as any)?.players) ? (parsed as any).players : null;
    if (!list) return false;
    const cleaned = sanitizeSquad(list);
    const next = JSON.stringify(cleaned);
    if (next === raw) return false;
    storage.setItem('bt_squad', next);
    return true;
  } catch {
    return false;
  }
}
