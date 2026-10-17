import React, { useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import { downloadPlayerStats, savePlayerStats } from '../utils/playerStatsDownload';

interface Props {
  playerIds: string[];
  label: string;
  className?: string;
}

/**
 * Downloads real career stats (OD, BT20, FC) from each player's Battrick page.
 * Battrick shows one format per page, so this makes 3 requests per player, spaced
 * by the server (~3s each) to stay polite to battrick.org.
 */
export default function PlayerStatsDownloadButton({ playerIds, label, className }: Props) {
  const { username, password, requireAuth } = useBattrickAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const cancelled = useRef(false);

  const run = async () => {
    if (!requireAuth('download player stats')) return;
    setBusy(true);
    setMsg(null);
    cancelled.current = false;
    let done = 0;
    const failures: string[] = [];
    for (const id of playerIds) {
      if (cancelled.current) break;
      setMsg({ text: `Downloading ${done + 1} of ${playerIds.length}…`, ok: true });
      try {
        const stats = await downloadPlayerStats(id, { username, password });
        savePlayerStats(id, stats);
        done++;
      } catch (e: any) {
        failures.push(e?.message || 'failed');
        // An unreachable server or bad login will fail every player — stop early.
        if (/unavailable|re-authenticate|No session|login/i.test(failures[failures.length - 1])) break;
      }
    }
    setBusy(false);
    setMsg(
      failures.length === 0
        ? { text: `Downloaded real stats for ${done} player${done === 1 ? '' : 's'}.`, ok: true }
        : { text: `Got ${done}/${playerIds.length}. ${failures[0]}`, ok: false }
    );
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ''}`}>
      <button
        type="button"
        onClick={run}
        disabled={busy || playerIds.length === 0}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {label}
      </button>
      {busy && (
        <button
          type="button"
          onClick={() => { cancelled.current = true; }}
          className="text-[11px] font-semibold text-slate-500 underline cursor-pointer"
        >
          Stop
        </button>
      )}
      {msg && (
        <span className={`text-[11px] font-medium ${msg.ok ? 'text-slate-500' : 'text-rose-600'}`}>{msg.text}</span>
      )}
    </div>
  );
}
