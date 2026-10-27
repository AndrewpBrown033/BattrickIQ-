import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Bot, StopCircle, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  syncWatchlistFromCloud,
  getWatchCloudStatus,
  getDeadlineCountdown,
  WATCH_SYNC_EVENT,
  type WatchEntry,
} from '../utils/transferWatchlist';
import { claimBotLease, getBotLeaseState, LEASE_EVENT } from '../utils/watchBotLease';
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

export default function TransferWatchPage() {
  const { requireAuth, username, password } = useBattrickAuth();
  const [list, setList] = useState<WatchEntry[]>(() => loadWatchlist());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [maxDraft, setMaxDraft] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const inFlight = useRef<Set<string>>(new Set());
  const [cloud, setCloud] = useState(() => getWatchCloudStatus());
  const [lease, setLease] = useState(() => getBotLeaseState());
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const reload = useCallback(() => setList(loadWatchlist()), []);

  useEffect(() => {
    const onChange = () => reload();
    const onSync = () => setCloud(getWatchCloudStatus());
    const onLease = () => setLease(getBotLeaseState());
    window.addEventListener('bt_transfer_watchlist_changed', onChange);
    window.addEventListener('storage', onChange);
    window.addEventListener(WATCH_SYNC_EVENT, onSync);
    window.addEventListener(LEASE_EVENT, onLease);
    const id = window.setInterval(() => {
      onLease();
      onSync();
    }, 15_000);
    onSync();
    onLease();
    return () => {
      window.removeEventListener('bt_transfer_watchlist_changed', onChange);
      window.removeEventListener('storage', onChange);
      window.removeEventListener(WATCH_SYNC_EVENT, onSync);
      window.removeEventListener(LEASE_EVENT, onLease);
      window.clearInterval(id);
    };
  }, [reload]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const onSyncNow = async () => {
    setSyncing(true);
    setSyncNote(null);
    const res = await syncWatchlistFromCloud();
    setList(res.list);
    setSyncNote(res.error || null);
    setCloud(getWatchCloudStatus());
    setSyncing(false);
  };

  const callBattrick = async (path: string, payload: Record<string, unknown>) => {
    if (!password || !username) {
      requireAuth();
      throw new Error('Battrick session expired — sign in again');
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
          data = { error: `HTTP ${res.status}` };
        }
        return { res, data };
      } finally {
        window.clearTimeout(timer);
      }
    };
    let { res, data } = await attempt(localStorage.getItem('bt_sync_session') || '');
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
      pageUrl: `https://www.battrick.org/nl/playerdetails.asp?playerID=${playerId}`,
      playerId,
    });
    const html = data.html || data.content || '';
    if (!html || html.length < 200) throw new Error(data?.error || 'No player page');
    const panel = parseTransferPanelFromHtml(html);
    if (!panel.playerId) panel.playerId = playerId;
    return panel;
  };

  const tickOne = async (entry: WatchEntry) => {
    if (inFlight.current.has(entry.playerId)) return;
    inFlight.current.add(entry.playerId);
    setBusyId(entry.playerId);
    try {
      const claim = await claimBotLease();
      if (!claim.ok && !claim.local) {
        setGlobalMsg(claim.error || `Bot running on ${claim.holderLabel || 'another device'}`);
        return;
      }
      const panel = await fetchPanel(entry.playerId);
      const plan = planBotBid(entry, panel);
      updateWatchAfterBotTick(entry.playerId, {
        lastCurrentBid: panel.currentBid,
        lastAskingPrice: panel.askingPrice,
        lastDeadline: panel.deadline || entry.lastDeadline,
        lastBidderTeam: panel.bidderTeam,
        lastBotAction: plan.message,
        botStatus:
          plan.action === 'bid_placed'
            ? 'bidding'
            : plan.action === 'already_leading'
              ? 'leading'
              : plan.action === 'outbid_over_max' || plan.action === 'at_max'
                ? 'maxed'
                : plan.action === 'not_listed'
                  ? 'sold'
                  : entry.botStatus,
        status: plan.action === 'not_listed' ? 'sold' : entry.status,
      });
      if (plan.action === 'bid_placed' && plan.nextBid && entry.botEnabled) {
        await callBattrick('/api/place-bid', {
          playerId: entry.playerId,
          bidValue: plan.nextBid,
        });
        updateWatchAfterBotTick(entry.playerId, {
          lastBotAction: `Bid placed £${plan.nextBid.toLocaleString()}`,
          botStatus: 'leading',
          lastCurrentBid: plan.nextBid,
        });
      }
      reload();
    } catch (e: any) {
      setGlobalMsg(e?.message || 'Check failed');
      updateWatchAfterBotTick(entry.playerId, {
        lastBotAction: e?.message || 'error',
        botStatus: 'error',
      });
      reload();
    } finally {
      inFlight.current.delete(entry.playerId);
      setBusyId(null);
    }
  };

  useEffect(() => {
    const id = window.setInterval(() => {
      const armed = loadWatchlist().filter((w) => w.botEnabled && w.maxBid && w.status !== 'sold');
      for (const w of armed) void tickOne(w);
    }, POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, password]);

  const onAdd = async () => {
    const raw = addInput.trim();
    if (!raw) return;
    setAdding(true);
    setGlobalMsg(null);
    try {
      const ids = raw
        .split(/[\s,;]+/)
        .map((s) => (s.match(/(\d{4,12})/) || [])[1])
        .filter(Boolean) as string[];
      if (!ids.length) {
        setGlobalMsg('Enter a player ID or playerdetails URL');
        return;
      }
      const added: string[] = [];
      for (const id of ids.slice(0, 8)) {
        let panel: any = {};
        try {
          panel = await fetchPanel(id);
        } catch {
          /* still add */
        }
        addToWatchlist({
          playerId: id,
          name: panel?.name || `Player #${id}`,
          reason: 'Added by player ID',
          playerUrl: `https://www.battrick.org/nl/playerdetails.asp?playerID=${id}`,
          lastAskingPrice: panel?.askingPrice,
          lastCurrentBid: panel?.currentBid,
          lastDeadline: panel?.deadline,
        } as any);
        added.push(panel?.name || id);
      }
      setAddInput('');
      reload();
      setGlobalMsg(`Watching ${added.join(', ')}`);
    } finally {
      setAdding(false);
    }
  };

  const nudgeMax = (w: WatchEntry, delta: number, currentDraft: string) => {
    const base = Math.round(Number(String(currentDraft).replace(/[^0-9]/g, '')) || w.maxBid || 0);
    const next = Math.max(1000, base + delta);
    setMaxDraft((d) => ({ ...d, [w.playerId]: String(next) }));
    setList(setMaxBid(w.playerId, next));
  };

  const onArm = (w: WatchEntry) => {
    const raw =
      maxDraft[w.playerId] ??
      String(w.maxBid || nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice) || 50000);
    const max = Math.round(Number(String(raw).replace(/[^0-9]/g, '')) || 0);
    if (max < 1000) {
      setGlobalMsg('Max bid must be at least £1,000');
      return;
    }
    setList(enableBotBid(w.playerId, max));
    void tickOne({ ...w, botEnabled: true, maxBid: max });
  };

  const money = (n?: number | null) =>
    n != null && n > 0 ? `£${Number(n).toLocaleString()}` : '—';

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Eye className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-slate-900">Transfer Watch</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Watched players and optional bot bidder. Next expected bid follows Battrick rules:
            max(asking, current + £1,000, current × 1.02).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onSyncNow()}
          disabled={syncing}
          className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {(() => {
        const err = syncNote || (cloud.signedIn ? cloud.lastError : null);
        let text: string;
        let tone: 'ok' | 'warn' | 'idle';
        if (!cloud.signedIn) {
          text =
            'This device only — sign in to BattrickIQ (same account everywhere) to carry your watch list across devices';
          tone = 'idle';
        } else if (err) {
          text = err;
          tone = 'warn';
        } else if (cloud.live) {
          text = `Synced across your devices · ${list.length} player${list.length === 1 ? '' : 's'}`;
          tone = 'ok';
        } else {
          text = 'Connecting to your other devices…';
          tone = 'idle';
        }
        return (
          <div
            className={
              'rounded-xl border px-3 py-2 text-[11px] font-mono ' +
              (tone === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : tone === 'warn'
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-slate-200 bg-slate-50 text-slate-700')
            }
          >
            {text}
          </div>
        );
      })()}

      {lease.active && !lease.mine && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-950 flex flex-wrap items-center gap-2">
          <span>
            Bot is running on <strong>{lease.holderLabel || 'another device'}</strong>
          </span>
          <button
            type="button"
            className="text-[11px] font-bold px-2 py-1 rounded-lg bg-indigo-600 text-white"
            onClick={() => void claimBotLease({ force: true }).then(() => setLease(getBotLeaseState()))}
          >
            Take over here
          </button>
        </div>
      )}

      {globalMsg && (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
          <span className="flex-1">{globalMsg}</span>
          <button type="button" className="text-[10px] font-bold" onClick={() => setGlobalMsg(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2">
        <h3 className="text-sm font-black text-slate-900">Add players</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void onAdd();
              }
            }}
            placeholder="Player ID or playerdetails URL (comma-separated ok)"
            className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2.5"
          />
          <button
            type="button"
            onClick={() => void onAdd()}
            disabled={adding || !addInput.trim()}
            className="text-sm font-bold px-4 py-2.5 rounded-xl bg-slate-900 text-white disabled:opacity-50"
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-3">
        {list.length === 0 && (
          <div className="text-center text-sm text-slate-500 py-8">No players on watch yet.</div>
        )}
        {list.map((w, idx) => {
          const expected = nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice);
          const draft = maxDraft[w.playerId] ?? String(w.maxBid || expected || '');
          return (
            <div key={w.playerId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900">
                    <span className="text-slate-400 font-mono mr-1">{idx + 1}.</span>
                    {w.name}
                    {w.botEnabled && (
                      <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        Bot {w.botStatus || 'armed'}
                      </span>
                    )}
                    {w.status === 'sold' && (
                      <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        Sold
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">#{w.playerId}</div>
                  {w.reason && <div className="text-[11px] text-slate-600 mt-0.5">{w.reason}</div>}
                  <div className="mt-1 text-[11px] text-slate-700 space-y-0.5">
                    <div>
                      Asking {money(w.lastAskingPrice)} · Current {money(w.lastCurrentBid)}
                    </div>
                    <div>
                      Next expected bid:{' '}
                      <span className="font-bold">{money(expected)}</span>
                    </div>
                    {(w as any).lastBidderTeam && (
                      <div>
                        High bidder:{' '}
                        <span className="font-semibold text-slate-800">{(w as any).lastBidderTeam}</span>
                      </div>
                    )}
                    {(() => {
                      const cd = getDeadlineCountdown(w.lastDeadline, nowMs);
                      if (!cd && !w.lastDeadline) return null;
                      if (!cd)
                        return (
                          <div className="text-slate-500">Deadline: {w.lastDeadline}</div>
                        );
                      return (
                        <div className="flex flex-col gap-0.5 text-[11px] mt-1 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5">
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
                      );
                    })()}
                  </div>
                </div>
                <a
                  href={w.playerUrl || `https://www.battrick.org/nl/playerdetails.asp?playerID=${w.playerId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <label className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5">
                  Max bid (£)
                  <input
                    value={draft}
                    onChange={(e) => setMaxDraft((d) => ({ ...d, [w.playerId]: e.target.value }))}
                    className="w-28 text-sm border rounded-lg px-2 py-1"
                  />
                </label>
                <div className="flex flex-wrap gap-1" aria-label="Adjust max bid">
                  {[-100_000, -50_000, -10_000, 10_000, 50_000, 100_000].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => nudgeMax(w, d, draft)}
                      className="text-[10px] font-mono font-bold px-1.5 py-1 rounded border border-slate-200 bg-slate-50 text-slate-700"
                    >
                      {d > 0 ? `+${d / 1000}k` : `${d / 1000}k`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => onArm(w)}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white inline-flex items-center gap-1"
                >
                  <Bot className="w-3.5 h-3.5" /> Arm bot
                </button>
                {w.botEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setList(disableBotBid(w.playerId));
                    }}
                    className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-800 inline-flex items-center gap-1"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> Stop bot
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void tickOne(w)}
                  disabled={busyId === w.playerId}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busyId === w.playerId ? 'animate-spin' : ''}`} />{' '}
                  Check now
                </button>
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
