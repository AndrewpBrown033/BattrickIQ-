import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Bot, StopCircle, RefreshCw, ExternalLink, Search } from 'lucide-react';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  hydrateWatchlistFromCloud,
  syncWatchlistFromCloud,
  getDeadlineCountdown,
  type WatchEntry,
} from '../utils/transferWatchlist';
import { getCustomUser } from '../lib/customAuth';
import {
  enableBotBid,
  disableBotBid,
  setMaxBid,
  nextExpectedBid,
  parseTransferPanelFromHtml,
} from '../utils/bidBot';

const PLAYER_URL = (id: string) => `https://www.battrick.org/nl/playerdetails.asp?playerID=${id}`;

function extractPlayerId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const fromQuery = s.match(/[?&#]playerid=(\d{4,12})/i) || s.match(/playerid=(\d{4,12})/i);
  if (fromQuery) return fromQuery[1];
  if (/^\d{4,12}$/.test(s)) return s;
  const digits = s.match(/(\d{4,12})/);
  return digits ? digits[1] : null;
}

export default function TransferWatchPage() {
  const { requireAuth, username, password } = useBattrickAuth();
  const [list, setList] = useState<WatchEntry[]>(() => loadWatchlist());
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [addInput, setAddInput] = useState('');
  const [addNote, setAddNote] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [maxDraft, setMaxDraft] = useState<Record<string, string>>({});
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => setList(loadWatchlist()), []);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener('bt_transfer_watchlist_changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('bt_transfer_watchlist_changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const next = await hydrateWatchlistFromCloud();
        if (!cancelled) {
          setList(next);
          const u = getCustomUser();
          setSyncMsg(u?.uid ? 'Synced across your devices' : 'Local only — sign in to BattrickIQ to share');
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

  const handleSyncNow = async () => {
    setSyncing(true);
    const res = await syncWatchlistFromCloud();
    setList(res.list);
    setSyncMsg(res.error || (res.source === 'cloud' ? 'Synced across your devices' : 'Local only'));
    setSyncing(false);
  };

  const callBattrick = async (path: string, payload: Record<string, unknown>) => {
    if (!password || !username) {
      requireAuth();
      throw new Error('Sign in to Battrick first');
    }
    const token = localStorage.getItem('bt_sync_session') || '';
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, username, password, sessionToken: token }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.sessionToken) localStorage.setItem('bt_sync_session', data.sessionToken);
    if (res.status === 401 || data?.isAuthFailure) {
      requireAuth();
      throw new Error(data?.error || 'Battrick login failed');
    }
    return data;
  };

  const fetchPanel = async (playerId: string) => {
    const data = await callBattrick('/api/sync-battrick-step', {
      pageName: 'playerdetails.asp',
      pageUrl: PLAYER_URL(playerId),
      playerId,
    });
    const html = data.html || data.content || '';
    if (!html || html.length < 200) throw new Error(data?.error || 'No player page returned');
    const panel = parseTransferPanelFromHtml(html);
    if (!panel.playerId) panel.playerId = playerId;
    return panel;
  };

  const onLookUp = async () => {
    setLookupError(null);
    const playerId = extractPlayerId(addInput);
    if (!playerId) {
      setLookupError('Enter a player ID or full playerdetails URL');
      return;
    }
    setLookingUp(true);
    try {
      const panel = await fetchPanel(playerId);
      setPreview({ ...panel, playerId: panel.playerId || playerId, playerUrl: PLAYER_URL(playerId) });
    } catch (e: any) {
      setLookupError(e?.message || 'Lookup failed');
    } finally {
      setLookingUp(false);
    }
  };

  const onConfirmAdd = () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const id = String(preview.playerId);
      addToWatchlist({
        playerId: id,
        name: preview.name || `Player ${id}`,
        reason: addNote.trim() || 'Manual watch',
        lastAskingPrice: preview.askingPrice,
        lastCurrentBid: preview.currentBid,
        lastCost: preview.currentBid || preview.askingPrice || 0,
        lastDeadline: preview.deadline,
        playerUrl: preview.playerUrl || PLAYER_URL(id),
      });
      setSuccessMsg(`Watching ${preview.name || id}`);
      setAddInput('');
      setAddNote('');
      setPreview(null);
      reload();
    } catch (e: any) {
      setLookupError(e?.message || 'Could not add');
    } finally {
      setConfirming(false);
    }
  };

  const money = (n?: number | null) => (n != null && n > 0 ? `£${Number(n).toLocaleString()}` : '—');

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto px-1">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Eye className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-black text-slate-900">Transfer Watch</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Auction deadlines are treated as GMT, shown as Sydney end time with a live countdown.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSyncNow()}
          disabled={syncing}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {syncMsg && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-mono text-slate-700">
          {syncMsg}
        </div>
      )}
      {globalMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">{globalMsg}</div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {successMsg}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
        <h3 className="text-sm font-black text-slate-900">Add a player</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            ref={inputRef}
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void onLookUp();
              }
            }}
            placeholder="5705334 or playerdetails URL…"
            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2.5"
          />
          <button
            type="button"
            onClick={() => void onLookUp()}
            disabled={lookingUp || !addInput.trim()}
            className="text-sm font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Search className="w-4 h-4" />
            {lookingUp ? 'Looking up…' : 'Look up'}
          </button>
        </div>
        {lookupError && <div className="text-xs text-rose-800">{lookupError}</div>}
        {preview && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex flex-col gap-2">
            <div className="font-black text-slate-900">{preview.name || `Player ${preview.playerId}`}</div>
            <div className="text-[11px] font-mono text-slate-500">#{preview.playerId}</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>Asking {money(preview.askingPrice)}</div>
              <div>Bid {money(preview.currentBid)}</div>
              <div className="col-span-2">Deadline (GMT listing): {preview.deadline || '—'}</div>
            </div>
            <input
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
              placeholder="Note (optional)"
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onConfirmAdd}
                disabled={confirming}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 text-white"
              >
                Add to Watch
              </button>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3">
        {list.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-8">No players on watch yet.</div>
        )}
        {list.map((w, idx) => {
          const cd = getDeadlineCountdown(w.lastDeadline, nowMs);
          const next = nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice);
          return (
            <div key={w.playerId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900">
                    <span className="text-slate-400 font-mono mr-1">{idx + 1}.</span>
                    {w.name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    #{w.playerId}
                    {w.status === 'sold' ? ' · sold' : ''}
                  </div>
                  {w.reason && <div className="text-[11px] text-slate-600 mt-0.5">{w.reason}</div>}
                  {cd ? (
                    <div className="flex flex-col gap-0.5 text-[11px] mt-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5">
                      <div>
                        <span className="font-semibold text-slate-500">Ends (Sydney)</span>{' '}
                        <span className="font-mono font-bold text-slate-900">{cd.sydneyEndLabel}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Ends (GMT)</span>{' '}
                        <span className="font-mono">{cd.gmtEndLabel}</span>
                      </div>
                      {cd.ended ? (
                        <div className="font-semibold text-slate-500">Auction ended</div>
                      ) : (
                        <div
                          className={
                            'font-black tabular-nums text-sm ' +
                            (cd.msLeft <= 10 * 60 * 1000 ? 'text-amber-700' : 'text-indigo-700')
                          }
                        >
                          {cd.label}
                          <span className="font-semibold text-[10px] ml-1 opacity-80">remaining</span>
                        </div>
                      )}
                    </div>
                  ) : w.lastDeadline ? (
                    <div className="text-[11px] text-slate-500 mt-1">Deadline: {w.lastDeadline}</div>
                  ) : null}
                </div>
                <a
                  href={w.playerUrl || PLAYER_URL(w.playerId)}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 border px-2 py-1">
                  <div className="text-slate-400">Asking</div>
                  <div className="font-bold">{money(w.lastAskingPrice)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 border px-2 py-1">
                  <div className="text-slate-400">Current</div>
                  <div className="font-bold">{money(w.lastCurrentBid)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 border px-2 py-1">
                  <div className="text-slate-400">Next bid</div>
                  <div className="font-bold">{money(next)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 border px-2 py-1">
                  <div className="text-slate-400">Max</div>
                  <div className="font-bold">{money(w.maxBid)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <label className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5">
                  Max bid £
                  <input
                    value={maxDraft[w.playerId] ?? String(w.maxBid || '')}
                    onChange={(e) => setMaxDraft((d) => ({ ...d, [w.playerId]: e.target.value }))}
                    className="w-28 text-sm border rounded-lg px-2 py-1"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const max = Math.round(
                      Number(String(maxDraft[w.playerId] ?? w.maxBid ?? '').replace(/[^0-9]/g, '')) || 0
                    );
                    if (max < 1000) {
                      setGlobalMsg('Max bid at least £1,000');
                      return;
                    }
                    setMaxBid(w.playerId, max);
                    enableBotBid(w.playerId, max);
                    reload();
                  }}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white inline-flex items-center gap-1"
                >
                  <Bot className="w-3.5 h-3.5" /> Arm bot
                </button>
                {w.botEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      disableBotBid(w.playerId);
                      reload();
                    }}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-800 inline-flex items-center gap-1"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> Stop
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    removeFromWatchlist(w.playerId);
                    reload();
                  }}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg border text-slate-600 ml-auto"
                >
                  Remove
                </button>
              </div>
              {w.lastBotAction && (
                <div className="mt-2 text-[11px] text-slate-600 font-mono">{w.lastBotAction}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
