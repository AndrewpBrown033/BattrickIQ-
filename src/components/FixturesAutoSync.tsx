import { useEffect, useRef } from 'react';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import { fixturesSyncIsFresh, syncDrawAndIncome } from '../utils/fixturesSync';

/**
 * Startup sync of the real Draw and its income (Club Diary). Runs once per page load, only when Battrick credentials are already
 * available (it never opens a login prompt), and is skipped when the Draw was refreshed in the last 15 minutes.
 */
export default function FixturesAutoSync() {
  const { username, password } = useBattrickAuth();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !username || !password) return;
    if (fixturesSyncIsFresh()) {
      started.current = true;
      return;
    }
    started.current = true;
    syncDrawAndIncome({ username, password }).catch((e) => {
      console.warn('[fixtures] startup sync failed:', e?.message || e);
    });
  }, [username, password]);

  return null;
}
