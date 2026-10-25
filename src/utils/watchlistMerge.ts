/**
 * Pure merge logic for the Transfer Watch list (no Firebase / DOM imports so it can be unit-tested).
 *
 * Why this exists: the watch list lives on every device (localStorage) and in one Firestore doc.
 * Devices edit it independently, so the merge has to be
 *   - commutative / idempotent (any order, any number of times gives the same list),
 *   - removal-aware (a plain union resurrects deleted players -> tombstones),
 *   - careful with deliberate user settings (arming the bot, max bid) vs automatic price refreshes,
 *     otherwise a background price refresh on a stale device overwrites "bot armed" from another one.
 */
import type { WatchEntry } from './transferWatchlist';

/** playerId -> ISO time it was removed. */
export type Tombstones = Record<string, string>;

export interface WatchState {
  items: WatchEntry[];
  removed: Tombstones;
}

/** Fields the user sets on purpose. They have their own timestamp (`intentAt`). */
export const INTENT_FIELDS = ['botEnabled', 'maxBid', 'acknowledged'] as const;

/** Tombstones older than this are dropped (every active device has long since seen them). */
export const TOMBSTONE_TTL_MS = 45 * 24 * 3600 * 1000;

type Entry = WatchEntry & { intentAt?: string };

const t = (s?: string) => s || '';

/** When this version of the entry was last touched. */
function entryTime(w: Entry): string {
  return t(w.updatedAt) || t(w.addedAt);
}

/** Stable JSON (sorted keys) so equal data always compares equal and ties break the same way everywhere. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return (
      '{' +
      Object.keys(o)
        .filter((k) => o[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stableStringify(o[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(v) ?? 'null';
}

function pickNewer(a: Entry, b: Entry): Entry {
  const ta = entryTime(a);
  const tb = entryTime(b);
  if (ta !== tb) return ta > tb ? a : b;
  // Same timestamp: break the tie on content so merge(a,b) === merge(b,a).
  return stableStringify(a) >= stableStringify(b) ? a : b;
}

/** Merge two versions of one player. Newest edit wins; the user's own settings follow their own clock. */
export function mergeEntry(a: Entry, b: Entry): Entry {
  const base = pickNewer(a, b);
  const other = base === a ? b : a;
  const out: Entry = { ...other, ...base };

  const ia = t(a.intentAt);
  const ib = t(b.intentAt);
  if (ia !== ib) {
    const winner = ia > ib ? a : b;
    for (const f of INTENT_FIELDS) {
      (out as any)[f] = (winner as any)[f];
    }
    out.intentAt = ia > ib ? ia : ib;
  }
  // Keep the NEWEST addedAt: tombstones are compared against the most recent (re-)add of the player.
  out.addedAt = t(a.addedAt) >= t(b.addedAt) ? a.addedAt || b.addedAt : b.addedAt || a.addedAt;
  // Drop keys that ended up undefined so equality checks stay clean.
  for (const k of Object.keys(out)) {
    if ((out as any)[k] === undefined) delete (out as any)[k];
  }
  return out;
}

function pruneTombstones(removed: Tombstones, nowMs: number): Tombstones {
  const out: Tombstones = {};
  for (const [id, at] of Object.entries(removed || {})) {
    const ms = Date.parse(at);
    if (!Number.isFinite(ms)) continue;
    if (nowMs - ms > TOMBSTONE_TTL_MS) continue;
    out[id] = at;
  }
  return out;
}

export function sortEntries(items: WatchEntry[]): WatchEntry[] {
  return [...items].sort((x, y) => {
    const d = entryTime(y).localeCompare(entryTime(x));
    return d !== 0 ? d : String(x.playerId).localeCompare(String(y.playerId));
  });
}

/**
 * Merge two complete states (e.g. cloud + this device).
 * An entry is dropped if a tombstone is at least as new as the entry's `addedAt`; re-adding a player
 * later sets a newer `addedAt`, which beats the tombstone. Automatic refreshes only bump `updatedAt`,
 * never `addedAt`, so a stale device refreshing prices can't bring a removed player back.
 */
export function mergeWatchState(a: WatchState, b: WatchState, nowMs: number = Date.now()): WatchState {
  const byId = new Map<string, Entry>();
  for (const src of [a, b]) {
    for (const w of src?.items || []) {
      if (!w?.playerId) continue;
      const id = String(w.playerId);
      const prev = byId.get(id);
      byId.set(id, prev ? mergeEntry(prev, { ...w, playerId: id }) : { ...w, playerId: id });
    }
  }

  const removed: Tombstones = {};
  for (const src of [a, b]) {
    for (const [id, at] of Object.entries(src?.removed || {})) {
      if (!removed[id] || at > removed[id]) removed[id] = at;
    }
  }

  const items: WatchEntry[] = [];
  for (const [id, w] of byId) {
    const tomb = removed[id];
    if (tomb && tomb >= t(w.addedAt)) continue; // removed after it was (last) added
    items.push(w);
    if (tomb) delete removed[id]; // re-added after removal: tombstone is spent
  }

  return { items: sortEntries(items), removed: pruneTombstones(removed, nowMs) };
}

/** Same data? (order-insensitive for items) */
export function sameState(a: WatchState, b: WatchState): boolean {
  const norm = (s: WatchState) =>
    stableStringify({
      items: [...(s.items || [])]
        .map((w) => ({ ...w, playerId: String(w.playerId) }))
        .sort((x, y) => x.playerId.localeCompare(y.playerId)),
      removed: s.removed || {},
    });
  return norm(a) === norm(b);
}

function intentSignature(w: Entry): string {
  return stableStringify(INTENT_FIELDS.map((f) => (w as any)[f] ?? null));
}

function contentSignature(w: Entry): string {
  const { updatedAt: _u, intentAt: _i, ...rest } = w as any;
  return stableStringify(rest);
}

/**
 * Called whenever this device saves its list. Compares against what was stored before and
 *   - stamps `updatedAt` on entries whose content really changed (so edits always win a merge),
 *   - stamps `intentAt` when bot arm / max bid / acknowledged changed,
 *   - records tombstones for players that were removed.
 * Callers (bot ticks, +/- buttons, refresh) don't have to remember to bump timestamps themselves.
 */
export function stampLocalChanges(
  prev: WatchState,
  nextItems: WatchEntry[],
  nowIso: string
): WatchState {
  const prevById = new Map<string, Entry>();
  for (const w of prev.items || []) prevById.set(String(w.playerId), w);

  const items: WatchEntry[] = [];
  const seen = new Set<string>();
  for (const w of nextItems || []) {
    if (!w?.playerId) continue;
    const id = String(w.playerId);
    seen.add(id);
    const before = prevById.get(id);
    const e: Entry = { ...w, playerId: id };
    if (!before) {
      e.updatedAt = e.updatedAt || nowIso;
      if (e.botEnabled !== undefined || e.maxBid !== undefined) e.intentAt = e.intentAt || nowIso;
    } else {
      if (contentSignature(e) !== contentSignature(before)) e.updatedAt = nowIso;
      else e.updatedAt = before.updatedAt || e.updatedAt || nowIso;
      if (intentSignature(e) !== intentSignature(before)) e.intentAt = nowIso;
      else if (before.intentAt) e.intentAt = before.intentAt;
    }
    items.push(e);
  }

  const removed: Tombstones = { ...(prev.removed || {}) };
  for (const id of prevById.keys()) {
    if (!seen.has(id)) removed[id] = nowIso;
  }
  // A player that is back in the list after a removal (re-added) no longer needs its tombstone.
  for (const w of items) {
    const tomb = removed[w.playerId];
    if (tomb && t(w.addedAt) > tomb) delete removed[w.playerId];
  }

  return { items: sortEntries(items), removed: pruneTombstones(removed, Date.parse(nowIso) || Date.now()) };
}
