import React, { useEffect, useState } from 'react';
import { Trash2, Eraser } from 'lucide-react';
import { deleteScoutedSquad, listScoutedSquads, pruneScoutedSquads, type ScoutedSquadEntry } from '../utils/scoutedSquads';

/** View, delete and tidy the opponent squads saved from scouting (local + cloud). */
export default function SavedSquadsManager() {
  const [items, setItems] = useState<ScoutedSquadEntry[]>(() => listScoutedSquads());
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setItems(listScoutedSquads());
    window.addEventListener('storage', refresh);
    window.addEventListener('bt_opponent_squads_updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('bt_opponent_squads_updated', refresh);
    };
  }, []);

  const kb = Math.round(items.reduce((n, e) => n + e.bytes, 0) / 1024);
  const brokenCount = items.filter((i) => i.broken).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-left">
        <span className="text-xs font-bold text-slate-700">
          Saved opponent squads ({items.length}) <span className="font-mono font-medium text-slate-400">· {kb} KB</span>
        </span>
        <span className="text-[11px] text-slate-400">{open ? 'Hide' : 'Manage'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {items.length === 0 && <p className="text-[11px] text-slate-500">Nothing saved yet. Scout an opponent and it is saved here and to your account.</p>}
          {items.map((e) => (
            <div key={e.key} className="flex items-center justify-between gap-2 text-[12px] border border-slate-100 rounded-lg px-2.5 py-1.5">
              <div className="min-w-0">
                <span className="font-semibold text-slate-800 truncate">{e.teamName}</span>
                <span className="ml-2 text-slate-400">
                  {e.broken ? 'empty or unreadable' : `${e.playerCount} players`}
                  {e.updatedAt ? ` · ${new Date(e.updatedAt).toLocaleDateString()}` : ''}
                </span>
              </div>
              <button
                type="button"
                title="Delete from this device and your account"
                onClick={async () => { await deleteScoutedSquad(e); setItems(listScoutedSquads()); setMsg(`Deleted ${e.teamName}`); }}
                className="text-rose-600 hover:text-rose-800 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={async () => { const n = await pruneScoutedSquads(); setItems(listScoutedSquads()); setMsg(n ? `Cleaned up ${n} item${n === 1 ? '' : 's'}` : 'Nothing to clean up'); }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 underline cursor-pointer"
            >
              <Eraser className="w-3 h-3" /> Clean up{brokenCount ? ` (${brokenCount} broken)` : ''}
            </button>
            {msg && <span className="text-[11px] text-slate-500">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
