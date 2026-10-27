import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Bot, StopCircle, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
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

  const reload = useCallback(() => setList(loadWatchlist()), []);

  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener('bt_transfer_watchlist_changed', onChange);
    window.addEventListener('storage', onChange);
    window.addEventListener(WATCH_SYNC_EVENT, onChange);
    window.addEventListener(LEASE_EVENT, onChange);
    return () => {
      window.removeEventListener('bt_transfer_watchlist_changed', onChange);
      window.removeEventListener('storage', onChange);
      window.removeEventListener(WATCH_SYNC_EVENT, onChange);
      window.removeEventListener(LEASE_EVENT, onChange);
    };
  }, [reload]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const myTeamName = () => {
    try {
      return (localStorage.getItem('bt_team_name') || '').trim();
    } catch {
      return '';
    }
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
        if (e?.name === 'AbortError') throw new Error('Battrick took too long to answer (timed out)');
        throw e;
      } finally {
        window.clearTimeout(timer);
      }
    };
    let { res, data } = await attempt(localStorage.getItem('bt_sync_session') || '');
    if (data.sessionToken) localStorage.setItem('bt_sync_session', data.sessionToken);
    if (res.status === 401 || data?.isAuthFailure) {
      try {
        localStorage.removeItem('bt_sync_session');
      } catch {}
      ({ res, data } = await attempt(''));
      if (data.sessionToken) localStorage.setItem('bt_sync_session', data.sessionToken);
      if (res.status === 401 || data?.isAuthFailure) {
        requireAuth();
        throw new Error(`${data?.error || 'Battrick login failed'} — re-enter your password`);
      }
    }
    if (!res.ok && data?.error) throw new Error(data.error);
    return data;
  };

  const fetchPanel = async (playerId: string) => {
    const data = await callBattrick('/api/sync-battrick-step', {
      pageName: 'playerdetails.asp',
      pageUrl: `https://www.battrick.org/nl/playerdetails.asp?playerID=${playerId}`,
      playerId,
    });
    const html = data.html || data.content || '';
    if (!html || html.length < 200) throw new Error(data?.error || 'No player page returned');
    const panel = parseTransferPanelFromHtml(html);
    if (!panel.playerId) panel.playerId = playerId;
    return panel;
  };

  const placeBid = async (playerId: string, bidValue: number) => {
    const data = await callBattrick('/api/battrick-place-bid', { playerId, bidValue });
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const tickOne = async (entry: WatchEntry) => {
    if (inFlight.current.has(entry.playerId)) return;
    inFlight.current.add(entry.playerId);
    setBusyId(entry.playerId);
    try {
      const panel = await fetchPanel(entry.playerId);
      const teamName = myTeamName();
      const plan = planBotBid(entry, panel, { myTeamName: teamName });

      updateWatchAfterBotTick(entry.playerId, {
        lastAskingPrice: panel.askingPrice ?? entry.lastAskingPrice,
        lastCurrentBid: panel.currentBid ?? entry.lastCurrentBid,
        lastCost: panel.currentBid || panel.askingPrice || entry.lastCost,
        lastDeadline: panel.deadline || entry.lastDeadline,
        expectedBid: plan.nextBid ?? panel.suggestedBid,
        lastBidderTeam: panel.bidderTeam ?? entry.lastBidderTeam,
        status: panel.isTransferListed ? 'listed' : 'sold',
        botStatus:
          plan.action === 'already_leading'
            ? 'leading'
            : plan.action === 'outbid_over_max' || plan.action === 'at_max'
              ? 'maxed'
              : plan.action === 'not_listed'
                ? 'sold'
                : entry.botEnabled
                  ? 'armed'
                  : entry.botStatus || 'idle',
        lastBotAction: plan.message,
      });

      // Refresh-only when bot is not armed: update prices / lead status, never bid
      if (!entry.botEnabled || !entry.maxBid) {
        reload();
        return;
      }

      const claim = await claimBotLease();
      if (!claim.ok && !claim.local) {
        setGlobalMsg(claim.error || `Bot running on ${claim.holderLabel || 'another device'}`);
        reload();
        return;
      }

      let cash: number | undefined;
      try {
        cash = JSON.parse(localStorage.getItem('bt_finances') || 'null')?.cash;
      } catch {}
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
        updateWatchAfterBotTick(entry.playerId, {
          botStatus: 'bidding',
          lastBotAction: `Posting £${plan.nextBid.toLocaleString()}…`,
        });
        await placeBid(entry.playerId, plan.nextBid);
        updateWatchAfterBotTick(entry.playerId, {
          botStatus: 'leading',
          lastCurrentBid: plan.nextBid,
          lastCost: plan.nextBid,
          lastBidderTeam: teamName || panel.bidderTeam || entry.lastBidderTeam,
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
    const id = window.setInterval(() => {
      loadWatchlist()
        .filter((w) => w.botEnabled && w.maxBid && w.status !== 'sold')
        .forEach((w) => void tickOne(w));
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
          lastBidderTeam: panel?.bidderTeam,
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

  const leadState = (w: WatchEntry): 'leading' | 'outbid' | 'none' | 'unknown' => {
    if (w.status === 'sold') return 'none';
    if (w.botStatus === 'leading') return 'leading';
    const team = myTeamName().toLowerCase();
    const bidder = (w.lastBidderTeam || '').trim();
    if (team && bidder) {
      return bidder.toLowerCase().includes(team) || team.includes(bidder.toLowerCase())
        ? 'leading'
        : 'outbid';
    }
    if (!w.lastCurrentBid) return 'none';
    return 'unknown';
  };

  const sortedList = [...list].sort((a, b) => {
    const ca = getDeadlineCountdown(a.lastDeadline, nowMs);
    const cb = getDeadlineCountdown(b.lastDeadline, nowMs);
    const ea = ca?.endsAtMs ?? Number.POSITIVE_INFINITY;
    const eb = cb?.endsAtMs ?? Number.POSITIVE_INFINITY;
    if (ea !== eb) return ea - eb;
    return String(a.playerId).localeCompare(String(b.playerId));
  });

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Eye className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-black text-slate-900">Transfer Watch</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Sorted by soonest auction end (#1 = closest deadline). Green = you are high bidder;
            amber = outbid. Next expected bid: max(asking, current + £1,000, current × 1.02).
          </p>
        </div>
      </div>

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
        {sortedList.map((w, index) => {
          const expected = nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice);
          const draft = maxDraft[w.playerId] ?? String(w.maxBid || expected || '');
          const lead = leadState(w);
          const cardBorder =
            lead === 'leading'
              ? 'border-emerald-300 ring-1 ring-emerald-200'
              : lead === 'outbid'
                ? 'border-amber-300 ring-1 ring-amber-100'
                : 'border-slate-200';
          return (
            <div key={w.playerId} className={`rounded-2xl border bg-white p-4 shadow-sm ${cardBorder}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-start gap-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0 tabular-nums">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900">{w.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">ID {w.playerId}</div>
                    {w.reason && <div className="text-[11px] text-slate-600 mt-1">{w.reason}</div>}
                    {lead === 'leading' && (
                      <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wide">
                        You are leading
                        {w.lastCurrentBid ? ` · £${w.lastCurrentBid.toLocaleString()}` : ''}
                      </div>
                    )}
                    {lead === 'outbid' && (
                      <div className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black uppercase tracking-wide">
                        Outbid{w.lastBidderTeam ? ` by ${w.lastBidderTeam}` : ''}
                        {w.lastCurrentBid ? ` · £${w.lastCurrentBid.toLocaleString()}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-600">
                  <div>
                    Asking{' '}
                    <span className="font-bold text-slate-900">
                      {w.lastAskingPrice ? `£${w.lastAskingPrice.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  <div>
                    Current{' '}
                    <span className="font-semibold">
                      {w.lastCurrentBid ? `£${w.lastCurrentBid.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  {w.lastBidderTeam && (
                    <div className={lead === 'leading' ? 'text-emerald-700 font-bold' : 'text-amber-800 font-semibold'}>
                      {lead === 'leading' ? 'High bidder: you' : `High bidder: ${w.lastBidderTeam}`}
                    </div>
                  )}
                  <div>
                    Next expected bid:{' '}
                    <span className="font-black text-indigo-700">
                      {expected ? `£${expected.toLocaleString()}` : '—'}
                    </span>
                  </div>
                  {(() => {
                    const cd = getDeadlineCountdown(w.lastDeadline, nowMs);
                    if (!cd && !w.lastDeadline) return null;
                    if (!cd) return <div>Deadline: {w.lastDeadline}</div>;
                    if (cd.ended) return <div className="font-semibold text-slate-500">Auction ended</div>;
                    return (
                      <div>
                        <div className="text-[10px] text-slate-500">Ends Sydney {cd.sydneyEndLabel}</div>
                        <div
                          className={
                            'font-black tabular-nums ' +
                            (cd.msLeft <= 10 * 60 * 1000 ? 'text-amber-700' : 'text-indigo-700')
                          }
                        >
                          {cd.label} left
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <label className="text-[10px] font-semibold text-slate-600 flex flex-col gap-0.5">
                  Max bid (£)
                  <input
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
                          ? 'border-slate-200 bg-slate-50 text-slate-700'
                          : 'border-indigo-200 bg-indigo-50 text-indigo-800'
                      }`}
                    >
                      {d > 0 ? `+${d / 1000}k` : `${d / 1000}k`}
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
                    void tickOne({
                      ...w,
                      maxBid: max >= 1000 ? max : w.maxBid,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busyId === w.playerId ? 'animate-spin' : ''}`} /> Check now
                </button>
                <a
                  href={
                    w.playerUrl ||
                    `https://www.battrick.org/nl/playerdetails.asp?playerID=${w.playerId}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700"
                >
                  <ExternalLink className="w-3 h-3" /> Battrick
                </a>
                <button
                  type="button"
                  onClick={() => {
                    removeFromWatchlist(w.playerId);
                    reload();
                  }}
                  className="text-[11px] text-slate-500 underline ml-auto"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                {lead === 'leading' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black uppercase tracking-wide">
                    Leading
                  </span>
                )}
                {lead === 'outbid' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-black uppercase tracking-wide">
                    Outbid
                  </span>
                )}
                {w.botEnabled && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold uppercase tracking-wide">
                    Bot {w.botStatus || 'armed'}
                  </span>
                )}
                {w.status === 'sold' && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    Sold
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
