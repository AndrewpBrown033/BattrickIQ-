import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Bot,
  StopCircle,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Search,
  UserPlus,
  Check,
  X,
  Link2,
} from 'lucide-react';
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

const POLL_MS = 60_000;
const PLAYER_URL = (id: string) =>
  `https://www.battrick.org/nl/playerdetails.asp?playerID=${id}`;

/** Accept raw ID (e.g. 5705334) or full playerdetails URL. */
function extractPlayerId(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const fromQuery = s.match(/[?&#]playerid=(\d{4,12})/i) || s.match(/playerid=(\d{4,12})/i);
  if (fromQuery) return fromQuery[1];
  if (/^\d{4,12}$/.test(s)) return s;
  const digits = s.match(/(\d{4,12})/);
  return digits ? digits[1] : null;
}

type PanelPreview = ReturnType<typeof parseTransferPanelFromHtml> & {
  playerId: string;
  playerUrl: string;
};

export default function TransferWatchPage() {
  const { requireAuth, username, password } = useBattrickAuth();
  const [list, setList] = useState<WatchEntry[]>(() => loadWatchlist());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [addInput, setAddInput] = useState('');
  const [addNote, setAddNote] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<PanelPreview | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [maxDraft, setMaxDraft] = useState<Record<string, string>>({});
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const inFlight = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(() => setList(loadWatchlist()), []);

  const detectedId = useMemo(() => extractPlayerId(addInput), [addInput]);
  const alreadyWatching = useMemo(() => {
    if (!detectedId) return null;
    return list.find((w) => w.playerId === detectedId) || null;
  }, [detectedId, list]);

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
      throw new Error('Sign in to Battrick first (top bar) so we can look players up');
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
          throw new Error('Battrick took too long — try again');
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
        throw new Error(`${data?.error || 'Battrick login failed'} — re-enter your password`);
      }
    }
    if (data.sessionToken) localStorage.setItem('bt_sync_session', data.sessionToken);
    return data;
  };

  const fetchPanel = async (playerId: string) => {
    const pageUrl = PLAYER_URL(playerId);
    const data = await callBattrick('/api/sync-battrick-step', {
      pageName: 'playerdetails.asp',
      pageUrl,
      playerId,
    });
    if (data?.error && !data?.html && !data?.content) {
      throw new Error(String(data.error));
    }
    const html = data.html || data.content || '';
    if (!html || html.length < 200) {
      throw new Error(
        data?.error ||
          'No player page returned — sign in to Battrick (top bar), then try again with the ID or full URL'
      );
    }
    const lower = html.toLowerCase();
    if (
      lower.includes('name="password"') &&
      lower.includes('name="username"') &&
      !lower.includes('playerdetails')
    ) {
      requireAuth();
      throw new Error('Battrick session expired — sign in again, then Look up');
    }
    const panel = parseTransferPanelFromHtml(html);
    if (!panel.playerId) panel.playerId = playerId;
    return panel;
  };

  const runBotTick = async (entry: WatchEntry) => {
    if (!entry.botEnabled || !entry.maxBid) return;
    if (inFlight.current.has(entry.playerId)) return;
    inFlight.current.add(entry.playerId);
    setBusyId(entry.playerId);
    try {
      const panel = await fetchPanel(entry.playerId);
      const plan = planBotBid(entry, panel);
      if (plan.action === 'bid_placed' && plan.nextBid != null) {
        await callBattrick('/api/battrick-place-bid', {
          playerId: entry.playerId,
          bidValue: plan.nextBid,
        });
        updateWatchAfterBotTick(entry.playerId, {
          botStatus: 'bidding',
          lastBotAction: `Bid £${Number(plan.nextBid).toLocaleString()} placed`,
          expectedBid: plan.nextBid,
          lastCurrentBid: plan.currentBid,
          lastCost: plan.nextBid,
        });
      } else {
        const status =
          plan.action === 'already_leading'
            ? 'leading'
            : plan.action === 'not_listed'
              ? 'sold'
              : plan.action === 'at_max' || plan.action === 'outbid_over_max'
                ? 'maxed'
                : 'idle';
        updateWatchAfterBotTick(entry.playerId, {
          botStatus: status as WatchEntry['botStatus'],
          lastBotAction: plan.message || 'Checked',
          lastCurrentBid: plan.currentBid,
          expectedBid: plan.nextBid,
        });
      }
      reload();
    } catch (e: any) {
      updateWatchAfterBotTick(entry.playerId, {
        botStatus: 'error',
        lastBotAction: e?.message || 'Bot tick failed',
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
      for (const w of loadWatchlist()) {
        if (w.botEnabled && w.maxBid && w.status === 'listed') void runBotTick(w);
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, password]);

  const clearPreview = () => {
    setPreview(null);
    setLookupError(null);
  };

  const onLookUp = async () => {
    setLookupError(null);
    setSuccessMsg(null);
    setGlobalMsg(null);
    clearPreview();

    const playerId = extractPlayerId(addInput);
    if (!playerId) {
      setLookupError('Enter a player ID (e.g. 5705334) or paste the full playerdetails URL');
      inputRef.current?.focus();
      return;
    }

    setLookingUp(true);
    try {
      const panel = await fetchPanel(playerId);
      const name = (panel.name || '').trim() || `Player ${playerId}`;
      setPreview({
        ...panel,
        playerId: panel.playerId || playerId,
        playerUrl: PLAYER_URL(playerId),
        name,
      });
      if (!panel.name) {
        setLookupError(
          `Loaded #${playerId} but could not read the name from Battrick. You can still add them to Watch.`
        );
      }
    } catch (e: any) {
      setLookupError(e?.message || 'Could not look up that player');
    } finally {
      setLookingUp(false);
    }
  };

  const onConfirmAdd = async () => {
    if (!preview) return;
    setConfirming(true);
    setLookupError(null);
    try {
      const id = String(preview.playerId);
      const cost = preview.currentBid || preview.askingPrice || 0;
      addToWatchlist({
        playerId: id,
        name: preview.name || `Player ${id}`,
        reason: addNote.trim() || 'Manual watch',
        lastAskingPrice: preview.askingPrice,
        lastCurrentBid: preview.currentBid,
        lastCost: cost,
        lastDeadline: preview.deadline,
        playerUrl: preview.playerUrl || PLAYER_URL(id),
      });
      setSuccessMsg(`Watching ${preview.name || id}`);
      setAddInput('');
      setAddNote('');
      clearPreview();
      reload();
      window.setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      setLookupError(e?.message || 'Could not add player');
    } finally {
      setConfirming(false);
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

  const money = (n?: number | null) =>
    n != null && n > 0 ? `£${Number(n).toLocaleString()}` : '—';

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto px-1">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Eye className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-black text-slate-900">Transfer Watch</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Track transfer targets and optional bot bids. Shared across your devices when signed in.
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
          bot is armed. Use at your own risk.
        </div>
      </div>

      {globalMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          {globalMsg}
          <button type="button" className="ml-2 underline font-bold" onClick={() => setGlobalMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Add a player</h3>
            <p className="text-[11px] text-slate-500">
              Paste a player URL or just the ID (e.g. 5705334)
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              value={addInput}
              onChange={(e) => {
                setAddInput(e.target.value);
                if (preview) clearPreview();
                setLookupError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onLookUp();
                }
              }}
              placeholder="5705334  or  paste playerdetails URL…"
              inputMode="text"
              autoComplete="off"
              className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400"
            />
          </div>
          <button
            type="button"
            onClick={() => void onLookUp()}
            disabled={lookingUp || !addInput.trim()}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white disabled:opacity-50 shrink-0"
          >
            <Search className={`w-4 h-4 ${lookingUp ? 'animate-pulse' : ''}`} />
            {lookingUp ? 'Looking up…' : 'Look up'}
          </button>
        </div>

        {detectedId && !preview && (
          <p className="text-[11px] font-mono text-slate-500">
            Detected ID <span className="font-bold text-slate-800">#{detectedId}</span>
            {alreadyWatching && (
              <span className="text-amber-700"> · already on your watch list</span>
            )}
          </p>
        )}

        {lookupError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            {lookupError}
          </div>
        )}

        {preview && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-black text-slate-900">{preview.name}</div>
                <div className="text-[11px] font-mono text-slate-500">#{preview.playerId}</div>
              </div>
              <a
                href={preview.playerUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600"
                title="Open on Battrick"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="rounded-lg bg-white border border-slate-100 px-2 py-1.5">
                <div className="text-slate-400 font-mono">Asking</div>
                <div className="font-bold text-slate-800">{money(preview.askingPrice)}</div>
              </div>
              <div className="rounded-lg bg-white border border-slate-100 px-2 py-1.5">
                <div className="text-slate-400 font-mono">Current bid</div>
                <div className="font-bold text-slate-800">{money(preview.currentBid)}</div>
              </div>
              <div className="rounded-lg bg-white border border-slate-100 px-2 py-1.5">
                <div className="text-slate-400 font-mono">Next bid ~</div>
                <div className="font-bold text-slate-800">
                  {money(nextExpectedBid(preview.currentBid, preview.askingPrice))}
                </div>
              </div>
              <div className="rounded-lg bg-white border border-slate-100 px-2 py-1.5">
                <div className="text-slate-400 font-mono">Deadline</div>
                <div className="font-bold text-slate-800 text-[10px] leading-snug">
                  {preview.deadline || '—'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px]">
              {preview.isTransferListed ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  On transfer list
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
                  Not listed (you can still watch)
                </span>
              )}
              {preview.bidderTeam && (
                <span className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                  Bid by {preview.bidderTeam}
                </span>
              )}
              {alreadyWatching && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">
                  Already watching — confirm to refresh details
                </span>
              )}
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-mono text-slate-500">Note (optional)</span>
              <input
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                placeholder="e.g. Middle order gap · under 25"
                className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onConfirmAdd()}
                disabled={confirming}
                className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl bg-amber-600 text-white disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {confirming ? 'Adding…' : alreadyWatching ? 'Update watch' : 'Add to watch'}
              </button>
              <button
                type="button"
                onClick={clearPreview}
                className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3">
        {list.length === 0 && !preview && (
          <p className="text-sm text-slate-500 text-center py-8 px-4">
            No watched players yet. Type an ID like 5705334, or paste a Battrick player URL, then Look
            up.
          </p>
        )}
        {list.map((w) => {
          const expected = nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice);
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
                  <a
                    href={w.playerUrl || PLAYER_URL(w.playerId)}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
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
                {expected > 0 && <span>Next bid ~£{expected.toLocaleString()}</span>}
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
