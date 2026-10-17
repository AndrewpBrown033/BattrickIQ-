import { SCOUT_ROSTER_PREFIX, deleteOpponentSquadFromFirestore, removeLegacySquadKeys } from './opponentSquadSync';

export interface ScoutedSquadEntry {
  key: string;
  teamName: string;
  teamId?: string;
  playerCount: number;
  updatedAt?: string;
  bytes: number;
  broken: boolean;
}

/** All scouted squads in the unified local cache (bt_scout_roster_*). */
export function listScoutedSquads(): ScoutedSquadEntry[] {
  const out: ScoutedSquadEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(SCOUT_ROSTER_PREFIX)) continue;
    const raw = localStorage.getItem(key) || '';
    const fallbackName = key.slice(SCOUT_ROSTER_PREFIX.length);
    try {
      const parsed = JSON.parse(raw);
      const players = Array.isArray(parsed) ? parsed : parsed?.players;
      out.push({
        key,
        teamName: (!Array.isArray(parsed) && parsed?.teamName) || fallbackName,
        teamId: !Array.isArray(parsed) ? parsed?.teamId || undefined : undefined,
        playerCount: Array.isArray(players) ? players.length : 0,
        updatedAt: !Array.isArray(parsed) ? parsed?.updatedAt : undefined,
        bytes: raw.length,
        broken: !Array.isArray(players) || players.length === 0,
      });
    } catch {
      out.push({ key, teamName: fallbackName, playerCount: 0, bytes: raw.length, broken: true });
    }
  }
  return out.sort((a, b) => a.teamName.localeCompare(b.teamName));
}

/** Delete one scouted squad locally and in the cloud. */
export async function deleteScoutedSquad(entry: ScoutedSquadEntry): Promise<void> {
  localStorage.removeItem(entry.key);
  window.dispatchEvent(new Event('storage'));
  // Fire and forget: Firestore queues the delete while offline and its promise would otherwise hang the UI.
  void deleteOpponentSquadFromFirestore(entry.teamName, entry.teamId);
}

/** Remove empty/corrupt entries and the dead legacy caches. Returns how many were removed. */
export async function pruneScoutedSquads(): Promise<number> {
  let removed = removeLegacySquadKeys();
  for (const e of listScoutedSquads().filter((x) => x.broken)) {
    await deleteScoutedSquad(e);
    removed++;
  }
  return removed;
}

export function totalScoutedBytes(): number {
  return listScoutedSquads().reduce((n, e) => n + e.bytes, 0);
}
