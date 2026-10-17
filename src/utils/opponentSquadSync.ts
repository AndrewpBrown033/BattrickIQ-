// Cloud persistence for scouted opponent squads, mirroring the local-first /
// best-effort-cloud-mirror pattern used for matches in matchArchive.ts.
//
// Each scouted opponent team's roster is mirrored to Firestore under
// `users_data/{uid}/opponentSquads/{squadId}` so that scouting work (plus
// any manual Batter/Bowler/Keeper role tags, via `roleManuallySet`) survives
// reloads and syncs across devices. localStorage remains the source of
// truth for rendering; Firestore is a best-effort mirror that never throws.

import { OpponentPlayer } from '../types';
import { db } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';
import { doc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';

export interface StoredOpponentSquad {
  squadId: string;
  teamId?: string;
  teamName: string;
  players: OpponentPlayer[];
  updatedAt?: string;
}

// Build a stable, Firestore-safe document id for a scouted team: prefer the
// numeric Battrick team id, falling back to a slugified team name.
export function getOpponentSquadId(teamId?: string, teamName?: string): string | null {
  const trimmedId = teamId?.trim();
  if (trimmedId) return `id_${trimmedId}`;
  const trimmedName = teamName?.trim();
  if (!trimmedName) return null;
  const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return slug ? `name_${slug}` : null;
}

// Mirror a scouted opponent squad to the cloud. Local-first: caller is
// expected to have already written the roster to localStorage before (or
// alongside) calling this - a cloud failure here never blocks the UI.
export async function saveOpponentSquadToFirestore(
  teamName: string,
  players: OpponentPlayer[],
  teamId?: string
): Promise<void> {
  const squadId = getOpponentSquadId(teamId, teamName);
  if (!squadId || !players || players.length === 0) return;
  try {
    const user = getCustomUser();
    if (!user || !user.uid || !db) return;
    const squadRef = doc(db, 'users_data', user.uid, 'opponentSquads', squadId);
    const payload: StoredOpponentSquad = {
      squadId,
      teamId: teamId?.trim() || undefined,
      teamName,
      players,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(squadRef, payload, { merge: true });
  } catch (cloudErr) {
    console.warn('Could not mirror opponent squad to cloud Firestore:', cloudErr);
  }
}

// One local cache format for scouted squads, read by Opponent Scout and written by both the
// scout screen and the cloud pull:  bt_scout_roster_<team name>  ->  { teamId, teamName, players, updatedAt }
export const SCOUT_ROSTER_PREFIX = 'bt_scout_roster_';
// Legacy cloud-pull keys: written (twice per squad, by id and by name) but never read by anything.
const LEGACY_SQUAD_PREFIX = 'bt_scout_squad_';

export function scoutRosterKey(teamName: string): string {
  return SCOUT_ROSTER_PREFIX + teamName;
}

/** Remove the dead duplicate `bt_scout_squad_*` caches. Returns how many keys were removed. */
export function removeLegacySquadKeys(): number {
  const dead: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LEGACY_SQUAD_PREFIX)) dead.push(k);
  }
  dead.forEach((k) => localStorage.removeItem(k));
  return dead.length;
}

// Pull every scouted opponent squad stored in the cloud into the unified local cache.
// A cloud copy only replaces the local one when it is newer, so an older cloud snapshot can
// never overwrite a scout you just did. Also drops the legacy duplicate keys.
export async function syncOpponentSquadsFromFirestore(): Promise<number> {
  try {
    removeLegacySquadKeys();
    const user = getCustomUser();
    if (!user || !user.uid || !db) return 0;
    const squadsCol = collection(db, 'users_data', user.uid, 'opponentSquads');
    const snap = await getDocs(squadsCol);
    if (snap.empty) return 0;

    let updatedCount = 0;
    snap.forEach((docSnap) => {
      const data = docSnap.data() as StoredOpponentSquad;
      if (!data || !data.teamName || !Array.isArray(data.players) || data.players.length === 0) return;
      const key = scoutRosterKey(data.teamName);
      try {
        const existingRaw = localStorage.getItem(key);
        const existing = existingRaw ? JSON.parse(existingRaw) : null;
        const localAt = existing && !Array.isArray(existing) ? Date.parse(existing.updatedAt || '') || 0 : 0;
        const cloudAt = Date.parse(data.updatedAt || '') || 0;
        if (!existing || cloudAt > localAt) {
          localStorage.setItem(
            key,
            JSON.stringify({ teamId: data.teamId, teamName: data.teamName, players: data.players, updatedAt: data.updatedAt })
          );
          updatedCount++;
        }
      } catch {
        // ignore unreadable local entry; leave it for the manager to prune
      }
    });

    if (updatedCount > 0) {
      window.dispatchEvent(new CustomEvent('bt_opponent_squads_updated', { detail: { count: updatedCount } }));
      window.dispatchEvent(new Event('storage'));
    }
    return updatedCount;
  } catch (err) {
    console.warn('Failed to sync opponent squads from Firestore:', err);
    return 0;
  }
}

/** Delete a scouted squad from the cloud mirror (best effort). */
export async function deleteOpponentSquadFromFirestore(teamName: string, teamId?: string): Promise<void> {
  try {
    const squadId = getOpponentSquadId(teamId, teamName);
    const user = getCustomUser();
    if (!squadId || !user || !user.uid || !db) return;
    await deleteDoc(doc(db, 'users_data', user.uid, 'opponentSquads', squadId));
  } catch (e) {
    console.warn('Could not delete opponent squad from cloud:', e);
  }
}
