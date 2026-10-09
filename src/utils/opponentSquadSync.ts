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
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';

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

// Pull every scouted opponent squad the user has stored in the cloud and
// merge each into localStorage (keyed the same way OpponentScout/GameDetailView
// already read: bt_scout_squad_<teamId> and bt_scout_squad_<teamName lowercased>).
// Only writes a key when the cloud copy differs from what's cached locally,
// and dispatches the same events the rest of the app listens for.
export async function syncOpponentSquadsFromFirestore(): Promise<number> {
  try {
    const user = getCustomUser();
    if (!user || !user.uid || !db) return 0;
    const squadsCol = collection(db, 'users_data', user.uid, 'opponentSquads');
    const snap = await getDocs(squadsCol);
    if (snap.empty) return 0;

    let updatedCount = 0;
    snap.forEach(docSnap => {
      const data = docSnap.data() as StoredOpponentSquad;
      if (!data || !Array.isArray(data.players) || data.players.length === 0) return;

      const keys: string[] = [];
      if (data.teamId) keys.push(`bt_scout_squad_${data.teamId}`);
      if (data.teamName) keys.push(`bt_scout_squad_${data.teamName.trim().toLowerCase()}`);

      keys.forEach(key => {
        try {
          const existingRaw = localStorage.getItem(key);
          const existing = existingRaw ? JSON.parse(existingRaw) : null;
          if (!existing || JSON.stringify(existing) !== JSON.stringify(data.players)) {
            localStorage.setItem(key, JSON.stringify(data.players));
            updatedCount++;
          }
        } catch {
          localStorage.setItem(key, JSON.stringify(data.players));
          updatedCount++;
        }
      });
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
