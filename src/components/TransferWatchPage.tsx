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
  const [nowMs, setNowMs] = useState(() => Date.now());
  // One check at a time per player: a slow check overlapping the next 1-minute tick could post a double bid.
  const inFlight = useRef<Set<string>>(new Set());

  // Cross-device state. The live listener itself runs from AppShell (so it works on every tab of the
  // app); this page only reads its status and re-renders when the list, sync status or bot lease change.
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
    // A lease expires by the clock, not by an event, so re-check now and then.
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

  const onSyncNow = async () => {
    setSyncing(true);
    setSyncNote(null);
    const res = await syncWatchlistFromCloud();
    setList(res.list);
    setSyncNote(res.error || null);
    setCloud(getWatchCloudStatus());
    setSyncing(false);
  };

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // One place for every Battrick call: checks creds, times out after 40s, and if the server has
  // forgotten our session (restart, 15-min idle expiry) retries once with a fresh login.
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
        try { data = await res.json(); } catch { data = { error: `Server returned HTTP ${res.status}` }; }
        return { res, data };
      } catch (e: any) {
        if (e?.name === 'AbortError') throw new Error('Battrick took too long to answer (timed out) — will retry next check');
        throw e;
      } finally {
        window.clearTimeout(timer);
      }
    };
    let { res, data } = await attempt(localStorage.getItem('bt_sync_session') || '');
    if (res.status === 401 || data?.isAuthFailure) {
      try { localStorage.removeItem('bt_sync_session'); } catch {}
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
      pageName: 'playerdetails.asp',
      pageUrl: `https://www.battrick.org/nl/playerdetails.asp?playerID=${playerId}`,
    });
    if (!data.success || !data.html) throw new Error(data.error || 'Could not load player page');
    return parseTransferPanelFromHtml(data.html);
  };

  const placeBid = async (playerId: string, bidValue: number) => {
    const data = await callBattrick('/api/battrick-place-bid', { playerId, bidValue });
    if (!data.success) throw new Error(data.error || 'Bid failed');
    return data;
  };

  const tickOne = async (entry: WatchEntry) => {
    if (!entry.botEnabled || !entry.maxBid) return;
    if (inFlight.current.has(entry.playerId)) return;
    inFlight.current.add(entry.playerId);
    setBusyId(entry.playerId);
    try {
      const panel = await fetchPanel(entry.playerId);
      const teamName = localStorage.getItem('bt_team_name') || '';
      const plan = planBotBid(entry, panel, { myTeamName: teamName });

      updateWatchAfterBotTick(entry.playerId, {
        lastAskingPrice: panel.askingPrice ?? entry.lastAskingPrice,
        lastCurrentBid: panel.currentBid ?? entry.lastCurrentBid,
        lastCost: panel.currentBid || panel.askingPrice || entry.lastCost,
        lastDeadline: panel.deadline || entry.lastDeadline,
        expectedBid: plan.nextBid ?? panel.suggestedBid,
        status: panel.isTransferListed ? 'listed' : 'sold',
        botStatus:
          plan.action === 'already_leading'
            ? 'leading'
            : plan.action === 'outbid_over_max' || plan.action === 'at_max'
              ? 'maxed'
              : plan.action === 'not_listed'
                ? 'sold'
                : 'armed',
        lastBotAction: plan.message,
      });

      // Never bid more than the club can actually pay.
      let cash: number | undefined;
      try { cash = JSON.parse(localStorage.getItem('bt_finances') || 'null')?.cash; } catch {}
      if (plan.action === 'bid_placed' && plan.nextBid != null && cash != null && plan.nextBid > cash) {
        updateWatchAfterBotTick(entry.playerId, {
          botStatus: 'maxed',
          lastBotAction: `Next bid £${plan.nextBid.toLocaleString()} is more than your cash £${cash.toLocaleString()} — not bidding`,
        });
        setGlobalMsg(`${entry.name}: next bid exceeds your available cash`);
        reload();
        return;
      }

      if (plan.action === 'bid_placed' && plan.nextBid != null) {
        // Gate 1: another device may have stopped the bot or lowered the max while we were talking to Battrick.
        const fresh = loadWatchlist().find((w) => w.playerId === entry.playerId);
        if (!fresh?.botEnabled || !fresh.maxBid || plan.nextBid > fresh.maxBid) {
          updateWatchAfterBotTick(entry.playerId, {
            lastBotAction: 'Bot stopped or max lowered on another device — not bidding',
          });
          reload();
          return;
        }
        // Gate 2: only one device/tab may place bids, otherwise two open copies would both bid.
        const claim = await claimBotLease();
        setLease(getBotLeaseState());
        if (!claim.ok) {
          updateWatchAfterBotTick(entry.playerId, {
            lastBotAction: claim.error
              ? `Not bidding — ${claim.error}`
              : `Bot is running on ${claim.holderLabel || 'another device'} — not bidding from here`,
          });
          reload();
          return;
        }
      }

      if (plan.action === 'bid_placed' && plan.nextBid != null) {
        updateWatchAfterBotTick(entry.playerId, {
          botStatus: 'bidding',
          lastBotAction: `Posting £${plan.nextBid.toLocaleString()}…`,
        });
        await placeBid(entry.playerId, plan.nextBid);
        updateWatchAfterBotTick(entry.playerId, {
          botStatus: 'leading',
          lastCurrentBid: plan.nextBid,
          lastCost: plan.nextBid,
          expectedBid: nextExpectedBid(plan.nextBid, panel.askingPrice),
          lastBotAction: `Bid placed £${plan.nextBid.toLocaleString()} — recheck in 1 min`,
        });
        setGlobalMsg(`Bid £${plan.nextBid.toLocaleString()} on ${entry.name}`);
      } else if (plan.action === 'outbid_over_max' || plan.action === 'at_max') {
        setGlobalMsg(`${entry.name}: ${plan.message}`);
      }
      reload();
    } catch (e: any) {
      updateWatchAfterBotTick(entry.playerId, {
        botStatus: 'error',
        lastBotAction: e?.message || 'Bot error',
      });
      reload();
    } finally {
      inFlight.current.delete(entry.playerId);
      setBusyId(null);
    }
  };

  useEffect(() => {
    const armed = list.filter((w) => w.botEnabled && w.maxBid && w.botStatus !== 'sold');
    if (!armed.length) return;
    const id = window.setInterval(async () => {
      const current = loadWatchlist().filter((w) => w.botEnabled && w.maxBid && w.botStatus !== 'sold');
      if (!current.length) return;
      // Only the device holding the bot lease polls Battrick and bids; the others just show synced data.
      if (!password || !username) {
        // Can't bid from here, so don't hold the lease. If nobody else is running the bot, say so.
        const s = getBotLeaseState();
        if (!(s.active && !s.mine)) {
          setGlobalMsg('Battrick session expired — sign in (top bar) to resume the bot on this device');
          requireAuth();
        }
        return;
      }
      const claim = await claimBotLease();
      setLease(getBotLeaseState());
      if (!claim.ok) return;
      current.forEach((w) => void tickOne(w));
    }, POLL_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.map((w) => `${w.playerId}:${w.botEnabled}:${w.maxBid}`).join('|'), username, password]);

  // Take the bot over from whichever other device/tab is running it (e.g. you switched to this phone).
  const onRunHere = async () => {
    if (!password || !username) {
      requireAuth();
      setGlobalMsg('Sign in to Battrick (top bar) first — the bot uses your Battrick login on this device');
      return;
    }
    const claim = await claimBotLease({ force: true });
    setLease(getBotLeaseState());
    if (!claim.ok) {
      setGlobalMsg(claim.error || 'Could not take over the bot — try again');
      return;
    }
    setGlobalMsg('Bot is now running on this device — keep this page open');
    loadWatchlist()
      .filter((w) => w.botEnabled && w.maxBid && w.botStatus !== 'sold')
      .forEach((w) => void tickOne(w));
  };

  // Watch any player by Battrick player ID (or a pasted playerdetails.asp link), listed or not yet.
  const onAddById = async () => {
    const ids: string[] = Array.from(new Set<string>((addInput.match(/\d{5,}/g) || []).map(String)));
    if (!ids.length) {
      setGlobalMsg('Enter a Battrick player ID (e.g. 12345678) or paste a player page link');
      return;
    }
    setAdding(true);
    try {
      const added: string[] = [];
      for (const id of ids) {
        let panel: Awaited<ReturnType<typeof fetchPanel>> | null = null;
        try {
          panel = await fetchPanel(id);
        } catch {
          // Still watch the ID; details fill in on the next scan or bot check.
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

  // Nudge the max bid up or down; applies straight away (the bot's next check uses the new max).
  const nudgeMax = (w: WatchEntry, delta: number, currentDraft: string) => {
    const base = Math.round(Number(String(currentDraft).replace(/[^0-9]/g, '')) || w.maxBid || 0);
    const next = Math.max(1000, base + delta);
    setMaxDraft((d) => ({ ...d, [w.playerId]: String(next) }));
    setList(setMaxBid(w.playerId, next));
  };

  const onArm = (w: WatchEntry) => {
    const raw = maxDraft[w.playerId] ?? String(w.maxBid || nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice) || 50000);
    const max = Math.round(Number(String(raw).replace(/[^0-9]/g, '')) || 0);
    if (max < 1000) {
      setGlobalMsg('Max bid must be at least £1,000');
      return;
    }
    setList(enableBotBid(w.playerId, max));
    void tickOne({ ...w, botEnabled: true, maxBid: max });
  };

  const armed = list.filter((w) => w.botEnabled && w.maxBid && w.botStatus !== 'sold');

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
          text = 'This device only — sign in to BattrickIQ (same account everywhere) to carry your watch list across devices';
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
        const cls =
          tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : tone === 'warn'
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-slate-200 bg-slate-50 text-slate-600';
        return <div className={`rounded-xl border px-3 py-2 text-[11px] font-mono ${cls}`}>{text}</div>;
      })()}

      {armed.length > 0 && cloud.signedIn && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-950 flex flex-wrap items-center gap-2">
          <Bot className="w-4 h-4 shrink-0" />
          <div className="flex-1 min-w-0">
            {lease.mine ? (
              <>
                <strong>Bot is running on this device.</strong> Keep this page open — it places the bids for{' '}
                {armed.length} armed player{armed.length === 1 ? '' : 's'}.
              </>
            ) : lease.active ? (
              <>
                <strong>Bot is running on {lease.holderLabel}.</strong> Bids won't be placed from here, so
                you can't double-bid by having two devices open.
              </>
            ) : (
              <>
                <strong>No device is running the bot right now.</strong> It starts from this page within a
                minute — keep it open.
              </>
            )}
          </div>
          {lease.active && !lease.mine && (
            <button
              type="button"
              onClick={() => void onRunHere()}
              className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white"
            >
              Run bot on this device
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong>You are responsible for bids the bot places.</strong> Keep this app open while the bot is armed.
          Battrick may extend deadlines in the last 3 minutes. Use at your own risk.
        </div>
      </div>

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
          placeholder="Add by player ID or player page link (several allowed)"
          className="flex-1 min-w-0 text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white"
        />
        <button
          type="submit"
          disabled={adding}
          className="text-xs font-bold px-3 py-2 rounded-lg bg-amber-600 text-white disabled:opacity-50"
        >
          {adding ? 'Adding…' : 'Watch'}
        </button>
      </form>

      {globalMsg && (
        <div className="text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg px-3 py-2">{globalMsg}</div>
      )}

      {!list.length && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-600">
          No watched players. From Squad → Estimator, scan the transfer list and hit <strong>Watch</strong> on a shortlist player.
          <button
            type="button"
            className="block mx-auto mt-3 text-xs font-bold text-indigo-700 underline"
            onClick={() => navigateTo({ tab: 'squad', squadSub: 'estimator' })}
          >
            Open Estimator
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {list.map((w) => {
          const expected = w.expectedBid ?? nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice);
          const draft = maxDraft[w.playerId] ?? (w.maxBid != null ? String(w.maxBid) : String(expected || ''));
          return (
            <div key={w.playerId} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900">{w.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">ID {w.playerId}</div>
                  {w.reason && <div className="text-[11px] text-slate-600 mt-1">{w.reason}</div>}
                </div>
                <div className="text-right text-[11px] text-slate-600">
                  <div>
                    Current:{' '}
                    <span className="font-bold text-slate-900">
                      {w.lastCurrentBid != null ? `£${w.lastCurrentBid.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div>
                    Asking:{' '}
                    <span className="font-semibold">
                      {w.lastAskingPrice != null ? `£${w.lastAskingPrice.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div>
                    Next expected bid:{' '}
                    <span className="font-black text-indigo-700">
                      {expected ? `£${expected.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  {(w as any).lastBidderTeam && (
                    <div>
                      High bidder:{' '}
                      <span className="font-semibold text-slate-800">{(w as any).lastBidderTeam}</span>
                    </div>
                  )}
                  {w.lastDeadline && <div>Deadline: {w.lastDeadline}</div>}
                  {(() => {
                    const cd = getDeadlineCountdown(w.lastDeadline, nowMs);
                    if (!cd) return null;
                    if (cd.ended)
                      return <div className="font-semibold text-slate-500">Auction ended (Sydney)</div>;
                    return (
                      <div
                        className={
                          'font-black tabular-nums ' +
                          (cd.msLeft <= 10 * 60 * 1000 ? 'text-amber-700' : 'text-indigo-700')
                        }
                      >
                        {cd.label} left (Sydney)
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <label className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5">
                  Max bid (£)
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={draft}
                    onChange={(e) => setMaxDraft((d) => ({ ...d, [w.playerId]: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm w-32"
                  />
                </label>
                <div className="flex flex-wrap gap-1 w-full sm:w-auto" aria-label="Adjust max bid">
                  {[-100_000, -50_000, -10_000, 10_000, 50_000, 100_000].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => nudgeMax(w, d, draft)}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold ${
                        d < 0
                          ? 'border-rose-200 bg-rose-50 text-rose-800'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      }`}
                    >
                      {d > 0 ? '+' : '−'}£{Math.abs(d) / 1000}k
                    </button>
                  ))}
                </div>
                {!w.botEnabled ? (
                  <button
                    type="button"
                    onClick={() => onArm(w)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                  >
                    <Bot className="w-3.5 h-3.5" /> Arm bot
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setList(disableBotBid(w.playerId))}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200"
                  >
                    <StopCircle className="w-3.5 h-3.5" /> Stop bot
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === w.playerId}
                  onClick={() => {
                    const max = Math.round(Number(String(draft).replace(/[^0-9]/g, '')) || 0);
                    if (max >= 1000) setList(setMaxBid(w.playerId, max));
                    void tickOne({ ...w, maxBid: max >= 1000 ? max : w.maxBid, botEnabled: w.botEnabled });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busyId === w.playerId ? 'animate-spin' : ''}`} /> Check now
                </button>
                {w.playerUrl && (
                  <a
                    href={w.playerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700"
                  >
                    <ExternalLink className="w-3 h-3" /> Battrick
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setList(removeFromWatchlist(w.playerId))}
                  className="text-[11px] text-slate-500 underline ml-auto"
                >
                  Remove
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                {w.botEnabled && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold uppercase tracking-wide">
                    Bot {w.botStatus || 'armed'}
                  </span>
                )}
                {w.maxBid != null && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    Max £{w.maxBid.toLocaleString()}
                  </span>
                )}
                {w.lastBotAction && <span className="text-slate-600">{w.lastBotAction}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
