import { useEffect, useState } from 'react';
import type { BattrickGame } from '../types';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import {
  enrichFixtureTeamIds,
  countFixturesMissingOpponentId,
} from '../utils/matchInfoTeamIds';

/**
 * When Scout mounts, backfill missing fixture opponent team IDs
 * from matchinfo.asp so Scout can auto-fill teamID.
 */
export default function FixtureTeamIdEnrich() {
  const { username, password } = useBattrickAuth();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!username || !password) return;
    let cancelled = false;
    try {
      const raw = localStorage.getItem('bt_fixtures');
      if (!raw) return;
      const fixtures = JSON.parse(raw) as BattrickGame[];
      if (!Array.isArray(fixtures) || !fixtures.length) return;
      const missing = countFixturesMissingOpponentId(fixtures);
      if (missing === 0) return;

      setMsg(`Resolving opponent team IDs (${missing})…`);
      (async () => {
        try {
          await enrichFixtureTeamIds(
            fixtures,
            { username, password },
            {
              maxLookups: 15,
              onProgress: (m) => {
                if (!cancelled) setMsg(m);
              },
            }
          );
        } finally {
          if (!cancelled) setMsg(null);
        }
      })();
    } catch {
      // ignore
    }
    return () => {
      cancelled = true;
    };
  }, [username, password]);

  if (!msg) return null;
  return (
    <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 mb-2">
      {msg}
    </p>
  );
}
