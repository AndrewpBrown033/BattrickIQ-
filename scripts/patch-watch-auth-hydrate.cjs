/** Re-wire TransferWatchPage cloud hydrate + onSnapshot after auth is ready. */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'TransferWatchPage.tsx');
if (!fs.existsSync(file)) {
  console.warn('[patch-watch-auth-hydrate] TransferWatchPage missing');
  process.exit(0);
}
let t = fs.readFileSync(file, 'utf8');
if (t.includes('onCustomAuthStateChanged') && t.includes('Live listener re-attaches')) {
  console.log('[patch-watch-auth-hydrate] already applied');
  process.exit(0);
}

if (!t.includes('onCustomAuthStateChanged')) {
  t = t.replace(
    "import { getCustomUser } from '../lib/customAuth';",
    "import { getCustomUser, onCustomAuthStateChanged } from '../lib/customAuth';"
  );
}
if (!t.includes('applyIncomingCloudWatchlist')) {
  t = t.replace(
    "  hydrateWatchlistFromCloud,\n  syncWatchlistFromCloud,\n  type WatchEntry,\n} from '../utils/transferWatchlist';",
    "  hydrateWatchlistFromCloud,\n  syncWatchlistFromCloud,\n  applyIncomingCloudWatchlist,\n  getWatchCloudStatus,\n  type WatchEntry,\n} from '../utils/transferWatchlist';"
  );
}

const oldBlock = `  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const next = await hydrateWatchlistFromCloud();
        if (!cancelled) {
          setList(next);
          const u = getCustomUser();
          setSyncMsg(
            u?.uid ? 'Synced across your devices' : 'Local only — sign in to BattrickIQ to share'
          );
        }
      } catch {
        if (!cancelled) setSyncMsg('Cloud sync unavailable — using this device only');
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const u = getCustomUser();
    if (!u?.uid) return;
    const ref = doc(db, 'users', u.uid, 'settings', 'transferWatch');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as { items?: WatchEntry[]; updatedAt?: string };
        if (!Array.isArray(data.items)) return;
        try {
          localStorage.setItem('bt_transfer_watchlist', JSON.stringify(data.items));
          const at = data.updatedAt || new Date().toISOString();
          localStorage.setItem('bt_transfer_watchlist_meta', JSON.stringify({ updatedAt: at }));
          window.dispatchEvent(new Event('bt_transfer_watchlist_changed'));
          setSyncMsg('Synced across your devices');
        } catch {
          // ignore
        }
      },
      () => setSyncMsg('Live sync paused')
    );
    return () => unsub();
  }, []);`;

const newBlock = `  // Wait for BattrickIQ auth — hydrate + live listener only when session is ready
  useEffect(() => {
    let cancelled = false;
    const unsubAuth = onCustomAuthStateChanged((user) => {
      if (cancelled) return;
      if (!user?.uid) {
        setSyncMsg('Local only — sign in to BattrickIQ (same account on every device)');
        setSyncing(false);
        return;
      }
      setSyncing(true);
      hydrateWatchlistFromCloud()
        .then((next) => {
          if (cancelled) return;
          setList(next);
          const st = getWatchCloudStatus();
          if (st.lastError) setSyncMsg(st.lastError);
          else setSyncMsg('Cloud sync OK · ' + next.length + ' player' + (next.length === 1 ? '' : 's'));
        })
        .catch((e) => {
          if (!cancelled) setSyncMsg(String(e?.message || e || 'Cloud hydrate failed'));
        })
        .finally(() => {
          if (!cancelled) setSyncing(false);
        });
    });
    return () => {
      cancelled = true;
      unsubAuth();
    };
  }, []);

  // Live listener re-attaches whenever auth user changes
  useEffect(() => {
    let unsubSnap;
    const unsubAuth = onCustomAuthStateChanged((user) => {
      if (unsubSnap) {
        unsubSnap();
        unsubSnap = undefined;
      }
      if (!user?.uid) return;
      const ref = doc(db, 'users', user.uid, 'settings', 'transferWatch');
      unsubSnap = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (!Array.isArray(data.items)) return;
          const merged = applyIncomingCloudWatchlist(
            data.items,
            data.updatedAt || new Date().toISOString()
          );
          setList(merged);
          setSyncMsg('Live sync · ' + merged.length + ' player' + (merged.length === 1 ? '' : 's'));
        },
        (err) => setSyncMsg('Live sync error: ' + (err && err.message ? err.message : 'paused'))
      );
    });
    return () => {
      unsubAuth();
      if (unsubSnap) unsubSnap();
    };
  }, []);`;

if (t.includes(oldBlock)) {
  t = t.replace(oldBlock, newBlock);
  console.log('[patch-watch-auth-hydrate] replaced hydrate effects');
} else {
  console.warn('[patch-watch-auth-hydrate] old block not found — page may already differ');
}

fs.writeFileSync(file, t);
console.log('[patch-watch-auth-hydrate] done', t.length);
