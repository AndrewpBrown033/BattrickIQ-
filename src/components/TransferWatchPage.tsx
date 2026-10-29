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
  hydrateWatchlistFromCloud,
  syncWatchlistFromCloud,
  startWatchlistLiveSync,
  type WatchEntry,
} from '../utils/transferWatchlist';
import { getCustomUser, onCustomAuthStateChanged } from '../lib/customAuth';
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
import { evaluateScoutBuyFit } from '../utils/scoutBuyFit';
import WatchFitPanel from './WatchFitPanel';
import { SKILL_LEVELS } from '../types';
import type { BattrickPlayer } from '../types';

const POLL_MS = 60_000;

export default function TransferWatchPage() {
  const { requireAuth, ensureSession, username, password } = useBattrickAuth();
  const [list, setList] = useState<WatchEntry[]>(() => loadWatchlist());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [globalMsg, setGlobalMsg] = useState<string | null>(null);
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [maxDraft, setMaxDraft] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    const unsubAuth = onCustomAuthStateChanged((user) => {
      if (cancelled) return;
      if (!user?.uid) {
        setSyncMsg('Local only — sign in to BattrickIQ with the same account on every device');
        setSyncing(false);
        return;
      }
      setSyncing(true);
      hydrateWatchlistFromCloud()
        .then((next) => {
          if (cancelled) return;
          setList(next);
          const st = getWatchCloudStatus();
          if (st.lastError) setSyncMsg(st.lastError);
          else setSyncMsg('Cloud sync OK · ' + next.length + ' player' + (next.length === 1 ? '' : 's'));
        })
        .catch((e: any) => {
          if (!cancelled) setSyncMsg(String(e?.message || e || 'Cloud hydrate failed'));
        })
        .finally(() => {
          if (!cancelled) setSyncing(false);
        });
    });
    return () => {
      cancelled = true;
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    let unsubLive: (() => void) | undefined;
    const unsubAuth = onCustomAuthStateChanged((user) => {
      if (unsubLive) {
        unsubLive();
        unsubLive = undefined;
      }
      if (!user?.uid) return;
      unsubLive = startWatchlistLiveSync(user.uid);
    });
    return () => {
      unsubAuth();
      if (unsubLive) unsubLive();
    };
  }, []);

  const onSyncNow = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncWatchlistFromCloud();
      setList(res.list || loadWatchlist());
      if (res.error) setSyncMsg(res.error);
      else setSyncMsg('Synced · ' + (res.list?.length ?? loadWatchlist().length) + ' players');
    } catch (e: any) {
      setSyncMsg(String(e?.message || e || 'Sync failed'));
    } finally {
      setSyncing(false);
    }
  };

  const myTeamName = () => {
    try {
      return (localStorage.getItem('bt_team_name') || '').trim();
    } catch {
      return '';
    }
  };

  const loadSquad = (): BattrickPlayer[] => {
    try {
      const raw = localStorage.getItem('bt_squad');
      return raw ? (JSON.parse(raw) as BattrickPlayer[]) : [];
    } catch {
      return [];
    }
  };

  const loadCash = (): number => {
    try {
      return Number(JSON.parse(localStorage.getItem('bt_finances') || 'null')?.cash) || 0;
    } catch {
      return 0;
    }
  };

  const loadRatingTargets = (): Record<string, number> => {
    try {
      return JSON.parse(localStorage.getItem('bt_rating_targets') || '{}') || {};
    } catch {
      return {};
    }
  };

  const skillShort = (n?: number) => {
    if (n == null || Number.isNaN(n)) return '—';
    const label = SKILL_LEVELS[Math.max(0, Math.min(SKILL_LEVELS.length - 1, Math.round(n)))] || '?';
    return `${label} (${n})`;
  };

  const computeBuyFit = (panel: {
    name?: string;
    age?: number;
    wage?: number;
    role?: string;
    bowlingType?: string;
    skills?: Record<string, number>;
  }) => {
    const squad = loadSquad().map((p) => ({
      id: p.id,
      name: p.name,
      age: p.age || 0,
      wage: p.wage,
      btRating: p.btRating,
      role: p.role,
      skills: p.skills || {},
      bowlingType: p.bowlingType,
    }));
    return evaluateScoutBuyFit(
      {
        name: panel.name || 'Player',
        age: panel.age || 0,
        wage: panel.wage,
        role: panel.role,
        bowlingType: panel.bowlingType,
        skills: panel.skills || {},
      },
      squad,
      { cash: loadCash(), ratingTargets: loadRatingTargets() as any, factorFinance: true }
    );
  };

  const callBattrick = async (path: string, payload: Record<string, unknown>) => {
    let user = username;
    let pass = password;
    if (!user || !pass) {
      try {
        user = user || localStorage.getItem('bt_battrick_username') || localStorage.getItem('bt_direct_user') || '';
        pass = pass || sessionStorage.getItem('bt_direct_pass') || localStorage.getItem('bt_direct_pass_persist') || '';
      } catch {}
    }
    if (!user || !pass) {
      const ok = await ensureSession();
      if (!ok) {
        requireAuth();
        throw new Error('Battrick session expired — sign in again (bot paused until you do)');
      }
      try {
        user = user || localStorage.getItem('bt_battrick_username') || '';
        pass = pass || localStorage.getItem('bt_direct_pass_persist') || sessionStorage.getItem('bt_direct_pass') || '';
      } catch {}
    }
    if (!user || !pass) {
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
          body: JSON.stringify({ ...payload, username: user, password: pass, sessionToken: token }),
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
      await ensureSession();
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

  // Read his Battrick page and store skills / age / wage on the entry. Read-only: this never bids and never
  // touches the bot, so the Jarvis check is safe to press on an armed player.
  const refreshDetails = async (entry: WatchEntry): Promise<WatchEntry | null> => {
    const panel = await fetchPanel(entry.playerId);
    updateWatchAfterBotTick(entry.playerId, {
      name: panel.name || entry.name,
      age: panel.age ?? entry.age,
      wage: panel.wage ?? entry.wage,
      role: panel.role || entry.role,
      bowlingType: panel.bowlingType || entry.bowlingType,
      skills: panel.skills || entry.skills,
    });
    reload();
    return loadWatchlist().find((w) => w.playerId === entry.playerId) || null;
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
      const fit = panel.skills
        ? computeBuyFit({
            name: panel.name || entry.name,
            age: panel.age ?? entry.age,
            wage: panel.wage ?? entry.wage,
            role: panel.role,
            bowlingType: panel.bowlingType,
            skills: panel.skills,
          })
        : entry.buyFit;

      updateWatchAfterBotTick(entry.playerId, {
        name: panel.name || entry.name,
        age: panel.age ?? entry.age,
        wage: panel.wage ?? entry.wage,
        role: panel.role || entry.role,
        bowlingType: panel.bowlingType || entry.bowlingType,
        skills: panel.skills || entry.skills,
        buyFit: fit
          ? {
              verdict: fit.verdict,
              score: fit.score,
              summary: fit.summary,
              reasons: fit.reasons?.slice(0, 4) || [],
              affordable: fit.affordable,
            }
          : entry.buyFit,
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
        const fit =
          panel?.skills &&
          computeBuyFit({
            name: panel.name,
            age: panel.age,
            wage: panel.wage,
            role: panel.role,
            bowlingType: panel.bowlingType,
            skills: panel.skills,
          });
        addToWatchlist({
          playerId: id,
          name: panel?.name || `Player #${id}`,
          reason: 'Added by player ID',
          playerUrl: `https://www.battrick.org/nl/playerdetails.asp?playerID=${id}`,
          lastAskingPrice: panel?.askingPrice,
          lastCurrentBid: panel?.currentBid,
          lastDeadline: panel?.deadline,
          lastBidderTeam: panel?.bidderTeam,
          age: panel?.age,
          wage: panel?.wage,
          role: panel?.role,
          bowlingType: panel?.bowlingType,
          skills: panel?.skills,
          buyFit: fit
            ? {
                verdict: fit.verdict,
                score: fit.score,
                summary: fit.summary,
                reasons: fit.reasons?.slice(0, 4) || [],
                affordable: fit.affordable,
              }
            : undefined,
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
            All skills + Jarvis buy-fit update on Check now. Sorted by soonest auction end.
          </p>
          {(syncMsg || syncing) && (
            <p className="text-[11px] text-slate-500 mt-1">{syncing ? 'Syncing across devices…' : syncMsg}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void onSyncNow()}
          disabled={syncing}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          Sync
        </button>
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
            placeholder="Player ID or playerdetails URL"
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{w.name}</div>
                      <a
                        href={
                          w.playerUrl ||
                          `https://www.battrick.org/nl/playerdetails.asp?playerID=${w.playerId}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-indigo-600 hover:text-indigo-800"
                        title="Open on Battrick"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">ID {w.playerId}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600">
                      {w.age ? <span>Age {w.age}</span> : null}
                      <span className="font-semibold text-slate-800" title="Weekly wage, read from his Battrick page">
                        {w.wage && w.wage > 0 ? `Wage £${w.wage.toLocaleString()}/wk` : 'Wage not read yet'}
                      </span>
                    </div>
                    {w.skills && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(
                          [
                            ['Bat', w.skills.batting],
                            ['Bowl', w.skills.bowling],
                            ['Keep', w.skills.keeping],
                            ['Field', w.skills.fielding],
                            ['Sta', w.skills.stamina],
                            ['Conc', w.skills.concentration],
                            ['Cons', w.skills.consistency],
                            ['Exp', w.skills.experience],
                          ] as const
                        ).map(([label, val]) =>
                          val != null && Number(val) > 0 ? (
                            <span
                              key={label}
                              className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-700"
                              title={skillShort(Number(val))}
                            >
                              {label} {val}
                            </span>
                          ) : null
                        )}
                      </div>
                    )}
                    {w.buyFit && (
                      <div
                        className={
                          'mt-1.5 inline-flex flex-col gap-0.5 px-2 py-1 rounded-lg border text-[10px] ' +
                          (w.buyFit.verdict === 'BUY'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : w.buyFit.verdict === 'PASS'
                              ? 'bg-slate-50 border-slate-200 text-slate-700'
                              : 'bg-amber-50 border-amber-200 text-amber-950')
                        }
                      >
                        <span className="font-black uppercase tracking-wide">
                          Jarvis fit: {w.buyFit.verdict} · {w.buyFit.score}/100
                        </span>
                        <span className="font-medium leading-snug">{w.buyFit.summary}</span>
                      </div>
                    )}
                    <WatchFitPanel entry={w} refreshDetails={refreshDetails} />
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-600 shrink-0">
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
                  onClick={() => void tickOne(w)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${busyId === w.playerId ? 'animate-spin' : ''}`} /> Check now
                </button>
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
              {w.lastBotAction && <div className="mt-2 text-[10px] text-slate-600">{w.lastBotAction}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
