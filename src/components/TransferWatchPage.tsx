import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Bot, StopCircle, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  type WatchEntry,
} from '../utils/transferWatchlist';
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
  // One check at a time per player: a slow check overlapping the next 1-minute tick could post a double bid.
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
    const id = window.setInterval(() => {
      const current = loadWatchlist().filter((w) => w.botEnabled && w.maxBid && w.botStatus !== 'sold');
      current.forEach((w) => void tickOne(w));
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [list.map((w) => `${w.playerId}:${w.botEnabled}:${w.maxBid}`).join('|')]);

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

  return (
    <div className="flex flex-col gap-4 w-full max-w-3xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <Eye className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-black text-slate-900">Transfer Watch</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Watched players and optional bot bidder. Next expected bid follows Battrick rules:
            max(asking, current + £1,000, current × 1.02).
          </p>
        </div>
      </div>

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
                  {w.lastDeadline && <div>Deadline: {w.lastDeadline}</div>}
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
