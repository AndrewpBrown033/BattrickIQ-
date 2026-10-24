import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Bot, StopCircle, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  hydrateWatchlistFromCloud,
  syncWatchlistFromCloud,
  type WatchEntry,
} from '../utils/transferWatchlist';
import { getCustomUser } from '../lib/customAuth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  enableBotBid,
  disableBotBid,
  setMaxBid,
  nextExpectedBid,
  parseTransferPanelFromHtml,
  planBotBid,
  updateWatchAfterBotTick,
} from '../utils/bidBot';
import { navigateTo } from '../lib/navigation';

const POLL_MS = 60_000;

export default function TransferWatchPage() {
  const { requireAuth, username, password } = useBattrickAuth();
  const [list, setList] = useState<WatchEntry[]>(() => loadWatchlist());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [maxDraft, setMaxDraft] = useState<Record<string, string>>({});
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef<Set<string>>(new Set());

  const reload = useCallback(() => setList(loadWatchlist()), []);

  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener('bt_transfer_watchlist_changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('bt_transfer_watchlist_changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [reload]);

  // Pull shared watchlist when this page opens
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

  // Live updates while Watch is open
  useEffect(() => {
    const u = getCustomUser();
    if (!u?.uid) return;
    const ref = doc(db, 'users', u.uid, 'settings', 'transferWatch');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as { items?: WatchEntry[]; updatedAt?: string };
        const items = data.items;
        if (!Array.isArray(items)) return;
        try {
          localStorage.setItem('bt_transfer_watchlist', JSON.stringify(items));
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
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMsg(null);
    const res = await syncWatchlistFromCloud();
    setList(res.list);
    setSyncMsg(res.error || (res.source === 'cloud' ? 'Synced across your devices' : 'Local only'));
    setSyncing(false);
  };

  const callBattrick = async (path: string, payload: Record<string, unknown>) => {
    if (!password || !username) {
      requireAuth();
      throw new Error('Battrick session expired — sign in again (bot paused until you do)');
    }
    const attempt = async (token: string) => {
      const ctl = new AbortController();
      const timer = window.setTimeout(() => ctl.abort(), 40_000);
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, username, password, sessionToken: token }),
          signal: ctl.signal,
        });
        let data: any = {};
        try {
          data = await res.json();
        } catch {
          data = { error: `Server returned HTTP ${res.status}` };
        }
        return { res, data };
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          throw new Error('Battrick took too long to answer (timed out) — will retry next check');
        }
        throw e;
      } finally {
        window.clearTimeout(timer);
      }
    };
    let { res, data } = await attempt(localStorage.getItem('bt_sync_session') || '');
    if (res.status === 401 || data?.isAuthFailure) {
      try {
        localStorage.removeItem('bt_sync_session');
      } catch {}
      ({ res, data } = await attempt(''));
      if (res.status === 401 || data?.isAuthFailure) {
        requireAuth();
        throw new Error(`${data?.error || 'Battrick login failed'} — re-enter your password (bot paused)`);
      }
    }
    if (data.sessionToken) localStorage.setItem('bt_sync_session', data.sessionToken);
    return data;
  };

  const fetchPanel = async (playerId: string) => {
    const data = await callBattrick('/api/sync-battrick-step', {
      step: 'playerdetails',
      playerId,
    });
    const html = data.html || data.content || '';
    return parseTransferPanelFromHtml(html);
  };

  const runBotTick = async (entry: WatchEntry) => {
    if (!entry.botEnabled || !entry.maxBid) return;
    if (inFlight.current.has(entry.playerId)) return;
    inFlight.current.add(entry.playerId);
    setBusyId(entry.playerId);
    try {
      const panel = await fetchPanel(entry.playerId);
      const plan = planBotBid(entry, panel);
      if (plan.action === 'bid' && plan.bidValue) {
        await callBattrick('/api/place-bid', {
          playerId: entry.playerId,
          bidValue: plan.bidValue,
        });
        updateWatchAfterBotTick(entry.playerId, { ...plan, placed: true });
      } else {
        updateWatchAfterBotTick(entry.playerId, plan);
      }
      reload();
    } catch (e: any) {
      updateWatchAfterBotTick(entry.playerId, {
        action: 'error',
        message: e?.message || 'Bot tick failed',
      });
      setGlobalMsg(e?.message || 'Bot tick failed');
      reload();
    } finally {
      inFlight.current.delete(entry.playerId);
      setBusyId(null);
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      const current = loadWatchlist();
      for (const w of current) {
        if (w.botEnabled && w.maxBid && w.status === 'listed') {
          void runBotTick(w);
        }
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, password]);

  const onAddById = async () => {
    const raw = addInput.trim();
    if (!raw) return;
    setAdding(true);
    setGlobalMsg(null);
    try {
      const idMatch = raw.match(/(\d{5,})/);
      const playerId = idMatch ? idMatch[1] : raw;
      const panel = await fetchPanel(playerId);
      addToWatchlist({
        playerId,
        name: panel.name || `Player ${playerId}`,
        reason: 'Manual watch',
        lastAskingPrice: panel.askingPrice,
        lastCurrentBid: panel.currentBid,
        lastCost: panel.currentBid || panel.askingPrice || 0,
        lastDeadline: panel.deadline,
        playerUrl: panel.playerUrl,
      });
      setAddInput('');
      reload();
    } catch (e: any) {
      setGlobalMsg(e?.message || 'Could not add player');
    } finally {
      setAdding(false);
    }
  };

  const onRemove = (playerId: string) => {
    removeFromWatchlist(playerId);
    reload();
  };

  const onArmBot = (w: WatchEntry) => {
    const draft = maxDraft[w.playerId] ?? String(w.maxBid || w.lastCost || '');
    const max = Math.round(Number(String(draft).replace(/[^0-9]/g, '')) || 0);
    if (max < 1000) {
      setGlobalMsg('Set a max bid of at least £1,000');
      return;
    }
    setMaxBid(w.playerId, max);
    enableBotBid(w.playerId, max);
    reload();
    void runBotTick({ ...w, botEnabled: true, maxBid: max });
  };

  const onDisarm = (playerId: string) => {
    disableBotBid(playerId);
    reload();
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Eye className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-black text-slate-900">Transfer Watch</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Watched players and optional bot bidder. Shared across your devices when signed in.
            Next expected bid: max(asking, current + £1,000, current × 1.02).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleSyncNow()}
          disabled={syncing}
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {syncMsg && (
        <div
          className={`rounded-xl border px-3 py-2 text-[11px] font-mono ${
            syncMsg.includes('Local only') ||
            syncMsg.includes('unavailable') ||
            syncMsg.includes('paused')
              ? 'border-slate-200 bg-slate-50 text-slate-600'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {syncMsg}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>You are responsible for bids the bot places.</strong> Keep this app open while the
          bot is armed. Battrick may extend deadlines in the last 3 minutes. Use at your own risk.
        </div>
      </div>

      {globalMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          {globalMsg}
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onAddById();
        }}
      >
        <input
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          placeholder="Player ID or playerdetails URL"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2"
        />
        <button
          type="submit"
          disabled={adding}
          className="text-xs font-bold px-3 py-2 rounded-lg bg-amber-600 text-white disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Watch'}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {list.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">
            No watched players yet. Add from Estimator or by player ID above.
          </p>
        )}
        {list.map((w) => {
          const expected = nextExpectedBid({
            askingPrice: w.lastAskingPrice,
            currentBid: w.lastCurrentBid,
          });
          return (
            <div
              key={w.playerId}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{w.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    #{w.playerId}
                    {w.lastDeadline ? ` · ${w.lastDeadline}` : ''}
                    {w.status === 'sold' ? ' · sold/delisted' : ''}
                  </div>
                  {w.reason && <div className="text-[11px] text-slate-600 mt-0.5">{w.reason}</div>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {w.playerUrl && (
                    <a
                      href={w.playerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(w.playerId)}
                    className="text-[11px] font-mono text-rose-600 px-2 py-1 rounded-lg border border-rose-100"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                <span>Cost £{(w.lastCost || 0).toLocaleString()}</span>
                {expected != null && <span>Next bid ~£{expected.toLocaleString()}</span>}
                {w.bidHintText && <span>{w.bidHintText}</span>}
                {w.botStatus && <span className="text-amber-800">Bot: {w.botStatus}</span>}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                <input
                  value={maxDraft[w.playerId] ?? (w.maxBid != null ? String(w.maxBid) : '')}
                  onChange={(e) =>
                    setMaxDraft((prev) => ({ ...prev, [w.playerId]: e.target.value }))
                  }
                  placeholder="Max bid £"
                  className="w-28 text-xs border border-slate-200 rounded-lg px-2 py-1.5 font-mono"
                />
                {w.botEnabled ? (
                  <button
                    type="button"
                    onClick={() => onDisarm(w.playerId)}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-rose-600 text-white"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    Stop bot
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onArmBot(w)}
                    disabled={busyId === w.playerId}
                    className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-600 text-white disabled:opacity-50"
                  >
                    <Bot className="w-3.5 h-3.5" />
                    {busyId === w.playerId ? 'Working…' : 'Arm bot'}
                  </button>
                )}
                {w.lastBotAction && (
                  <span className="text-[11px] text-slate-600">{w.lastBotAction}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
