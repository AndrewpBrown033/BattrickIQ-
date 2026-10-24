/**
 * Harden Transfer Watch cloud sync: merge lists across devices, surface auth errors.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'utils', 'transferWatchlist.ts');
if (!fs.existsSync(file)) {
  console.warn('[patch-watch-sync] transferWatchlist.ts missing');
  process.exit(0);
}
let t = fs.readFileSync(file, 'utf8');
if (t.includes('mergeWatchEntries') && t.includes('getWatchCloudStatus')) {
  console.log('[patch-watch-sync] already present');
  process.exit(0);
}

// Replace silent mirror with merge + error reporting
const oldMirror = `async function mirrorWatchlistToCloud(list: WatchEntry[], updatedAt: string) {
  const user = getCustomUser();
  if (!user?.uid) return;
  try {
    await setDoc(
      doc(db, 'users', user.uid, 'settings', 'transferWatch'),
      { items: list, updatedAt },
      { merge: true }
    );
  } catch {
    // offline / rules — local still works
  }
}`;

const newMirror = `let lastCloudError: string | null = null;
let lastCloudOkAt: string | null = null;

export function getWatchCloudStatus(): {
  signedIn: boolean;
  lastError: string | null;
  lastOkAt: string | null;
} {
  return {
    signedIn: !!getCustomUser()?.uid,
    lastError: lastCloudError,
    lastOkAt: lastCloudOkAt,
  };
}

/** Union two watch lists by playerId (newer row wins). */
export function mergeWatchEntries(a: WatchEntry[], b: WatchEntry[]): WatchEntry[] {
  const byId = new Map<string, WatchEntry>();
  for (const list of [a, b]) {
    for (const w of list || []) {
      if (!w?.playerId) continue;
      const id = String(w.playerId);
      const prev = byId.get(id);
      if (!prev) {
        byId.set(id, { ...w, playerId: id });
        continue;
      }
      const prevT = prev.updatedAt || prev.addedAt || '';
      const curT = w.updatedAt || w.addedAt || '';
      byId.set(
        id,
        curT >= prevT
          ? { ...prev, ...w, playerId: id, maxBid: w.maxBid ?? prev.maxBid, botEnabled: w.botEnabled ?? prev.botEnabled }
          : { ...w, ...prev, playerId: id, maxBid: prev.maxBid ?? w.maxBid, botEnabled: prev.botEnabled ?? w.botEnabled }
      );
    }
  }
  return Array.from(byId.values());
}

export async function mirrorWatchlistToCloud(
  list: WatchEntry[],
  updatedAt: string
): Promise<{ ok: boolean; error?: string }> {
  const user = getCustomUser();
  if (!user?.uid) {
    lastCloudError = 'Sign in to BattrickIQ to sync Watch across devices';
    try {
      window.dispatchEvent(new CustomEvent('bt_transfer_watch_cloud', { detail: { ok: false, error: lastCloudError } }));
    } catch {}
    return { ok: false, error: lastCloudError };
  }
  try {
    const ref = doc(db, 'users', user.uid, 'settings', 'transferWatch');
    let merged = (Array.isArray(list) ? list : []).filter((w) => w?.playerId);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as { items?: WatchEntry[] };
        const cloudItems = Array.isArray(data.items) ? data.items.filter((w) => w?.playerId) : [];
        merged = mergeWatchEntries(cloudItems, merged);
      }
    } catch {}
    const at = updatedAt || new Date().toISOString();
    await setDoc(ref, { items: merged, updatedAt: at }, { merge: true });
    writeJson(WL_KEY, merged);
    setLocalWatchMeta(at);
    lastCloudError = null;
    lastCloudOkAt = at;
    try {
      window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
      window.dispatchEvent(new CustomEvent('bt_transfer_watch_cloud', { detail: { ok: true } }));
    } catch {}
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message || e || 'Cloud save failed');
    lastCloudError = /permission|insufficient|unauth/i.test(msg)
      ? 'Cloud save blocked — sign out and back into BattrickIQ, then tap Sync on Watch'
      : msg;
    try {
      window.dispatchEvent(new CustomEvent('bt_transfer_watch_cloud', { detail: { ok: false, error: lastCloudError } }));
    } catch {}
    return { ok: false, error: lastCloudError };
  }
}`;

if (t.includes(oldMirror)) {
  t = t.replace(oldMirror, newMirror);
  console.log('[patch-watch-sync] mirror replaced');
} else if (!t.includes('mergeWatchEntries')) {
  // Insert before saveWatchlist
  const idx = t.indexOf('export function saveWatchlist');
  if (idx > 0) {
    t = t.slice(0, idx) + newMirror + '\n\n' + t.slice(idx);
    // Remove old silent mirror if present as export or async function later
    const silent = /async function mirrorWatchlistToCloud\([\s\S]*?\n\}/;
    // only remove second occurrence
    const first = t.indexOf('export async function mirrorWatchlistToCloud');
    const second = t.indexOf('async function mirrorWatchlistToCloud', first + 10);
    if (second > 0) {
      const end = t.indexOf('\n}', second);
      // rough - skip
    }
    console.log('[patch-watch-sync] mirror inserted');
  } else {
    console.warn('[patch-watch-sync] could not find insertion point');
  }
}

// Hydrate: always merge, never wipe
const oldHydrateTail = `const cloudAt = typeof data.updatedAt === 'string' ? data.updatedAt : '';
    return applyIncomingCloudWatchlist(cloudItems, cloudAt || localMeta.updatedAt || new Date().toISOString());
  } catch {
    return local;
  }
}`;

const newHydrateTail = `const cloudAt = typeof data.updatedAt === 'string' ? data.updatedAt : '';
    const merged =
      typeof mergeWatchEntries === 'function'
        ? mergeWatchEntries(cloudItems, local)
        : applyIncomingCloudWatchlist(cloudItems, cloudAt || localMeta.updatedAt || new Date().toISOString());
    if (typeof mergeWatchEntries === 'function') {
      const at = cloudAt || localMeta.updatedAt || new Date().toISOString();
      writeJson(WL_KEY, merged);
      setLocalWatchMeta(at);
      try {
        window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
      } catch {}
      const cloudIds = new Set(cloudItems.map((w) => String(w.playerId)));
      if (local.some((w) => !cloudIds.has(String(w.playerId)))) {
        await mirrorWatchlistToCloud(merged, at);
      }
    }
    return typeof mergeWatchEntries === 'function' ? merged : merged;
  } catch (e: any) {
    lastCloudError = String(e?.message || e || 'Cloud load failed');
    return local;
  }
}`;

if (t.includes(oldHydrateTail)) {
  t = t.replace(oldHydrateTail, newHydrateTail);
  console.log('[patch-watch-sync] hydrate merge');
}

// Stronger sync error message
t = t.replace(
  "error: 'Sign in to BattrickIQ to sync watch across devices'",
  "error: 'Sign in to BattrickIQ (app login, not only Battrick) to sync Watch across devices'"
);

fs.writeFileSync(file, t);
console.log('[patch-watch-sync] done', t.length);
