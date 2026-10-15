import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Swords, UserCheck, RefreshCw, AlertTriangle, Users, Target, Info
} from 'lucide-react';
import type { BattrickPlayer, BattrickGame } from '../types';
import { getSkillLabel } from '../types';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import { evaluateScoutBuyFit, type BuyFitVerdict } from '../utils/scoutBuyFit';
import { isGameInNext7Days, parseGameDateToTimestamp } from '../utils/history';

interface Props {
  setActiveTab?: (tab: any) => void;
  initialScoutTarget?: { teamName: string; teamId?: string; nonce?: number } | null;
}

type ScoutPlayer = {
  id: string;
  name: string;
  age?: number;
  role?: string;
  wage?: number;
  btRating?: number;
  skills: {
    batting: number;
    bowling: number;
    keeping: number;
    fielding: number;
    stamina: number;
  };
  bowlingType?: string;
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getOwnTeamId(): string {
  try {
    return (
      (localStorage.getItem('bt_team_id') || '').trim() ||
      (localStorage.getItem('bt_own_team_id') || '').trim() ||
      ''
    );
  } catch {
    return '';
  }
}

/**
 * Resolve the opponent's Battrick teamID for squad.asp.
 * Never fall back to the user's own club or a bare squad.asp URL —
 * that is the root cause of "scanned opponent and got my own roster".
 */
function resolveOpponentTeamId(
  match: BattrickGame | null | undefined,
  manualTeamId: string,
  ownTeamId: string
): { teamId: string; source: string } {
  const manual = (manualTeamId || '').trim();
  if (manual) {
    if (ownTeamId && manual === ownTeamId) {
      return { teamId: '', source: 'manual-is-own' };
    }
    return { teamId: manual, source: 'manual' };
  }

  if (!match) return { teamId: '', source: 'none' };

  const opp = String((match as any).opponentTeamId || '').trim();
  if (opp && (!ownTeamId || opp !== ownTeamId)) {
    return { teamId: opp, source: 'opponentTeamId' };
  }

  const homeId = String((match as any).homeTeamId || '').trim();
  const awayId = String((match as any).awayTeamId || '').trim();
  const venue = String(match.venue || '').toLowerCase();

  // Home fixture → opponent is away side; Away fixture → opponent is home side
  if (venue === 'home' && awayId && (!ownTeamId || awayId !== ownTeamId)) {
    return { teamId: awayId, source: 'awayTeamId (home venue)' };
  }
  if (venue === 'away' && homeId && (!ownTeamId || homeId !== ownTeamId)) {
    return { teamId: homeId, source: 'homeTeamId (away venue)' };
  }

  // Both IDs present: take the one that is not us
  if (homeId && awayId && ownTeamId) {
    if (homeId === ownTeamId && awayId !== ownTeamId) {
      return { teamId: awayId, source: 'not-own pair' };
    }
    if (awayId === ownTeamId && homeId !== ownTeamId) {
      return { teamId: homeId, source: 'not-own pair' };
    }
  }

  // Prefer the ID that is explicitly not our club (no venue)
  if (awayId && (!ownTeamId || awayId !== ownTeamId)) {
    return { teamId: awayId, source: 'awayTeamId' };
  }
  if (homeId && (!ownTeamId || homeId !== ownTeamId)) {
    return { teamId: homeId, source: 'homeTeamId' };
  }

  return { teamId: '', source: 'none' };
}

function parsePlayersFromHtml(html: string): ScoutPlayer[] {
  const players: ScoutPlayer[] = [];
  const seen = new Set<string>();
  const re =
    /<a[^>]+href=["']([^"']*(?:playerdetails\.asp|playerid=|PlayerID=)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const idMatch = href.match(/playerid=(\d+)/i) || href.match(/PlayerID=(\d+)/i);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const name = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2 || name.length > 50) continue;
    const start = Math.max(0, m.index - 300);
    const end = Math.min(html.length, m.index + m[0].length + 500);
    const block = html.slice(start, end).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const ageM = block.match(/\b(\d{2})\s*(?:years|yrs|y\.o|yo)\b/i) || block.match(/\bage[:\s]+(\d{2})\b/i);
    const wageM = block.match(/£\s*([\d,]+)/);
    const batM = block.match(/\bBat(?:ting)?[:\s]+(\d{1,2})\b/i);
    const bowlM = block.match(/\bBowl(?:ing)?[:\s]+(\d{1,2})\b/i);
    const keepM = block.match(/\bKeep(?:ing)?[:\s]+(\d{1,2})\b/i);
    players.push({
      id,
      name,
      age: ageM ? Number(ageM[1]) : undefined,
      wage: wageM ? Number(wageM[1].replace(/,/g, '')) : undefined,
      skills: {
        batting: batM ? Number(batM[1]) : 0,
        bowling: bowlM ? Number(bowlM[1]) : 0,
        keeping: keepM ? Number(keepM[1]) : 0,
        fielding: 5,
        stamina: 5,
      },
    });
  }
  return players;
}

/** Extract teamID from Battrick #pagetitle (authoritative club on the page). */
function extractPageTitleTeamId(html: string): string | null {
  if (!html) return null;
  const pageTitle = html.match(
    /id=["']pagetitle["'][^>]*>[\s\S]{0,1200}?office\.asp\?teamID=(\d+)/i
  );
  if (pageTitle) return pageTitle[1];
  const h2 = html.match(/<h2[^>]*subheadernew[^>]*>[^<]*\((\d+)\)\s*</i);
  if (h2) return h2[1];
  return null;
}

function extractPageTitleTeamName(html: string): string | null {
  if (!html) return null;
  const m = html.match(
    /id=["']pagetitle["'][^>]*>[\s\S]{0,800}?<a[^>]*office\.asp\?teamID=\d+[^>]*>([^<]+)</i
  );
  if (m) return m[1].replace(/\s+/g, ' ').trim() || null;
  return null;
}

/** True if the parsed roster looks like our own squad (ID overlap). */
function looksLikeOwnSquad(parsed: ScoutPlayer[], ownSquad: BattrickPlayer[]): boolean {
  if (!parsed.length || !ownSquad.length) return false;
  const ownIds = new Set(ownSquad.map((p) => String(p.id)));
  let hits = 0;
  for (const p of parsed) {
    if (ownIds.has(String(p.id))) hits += 1;
  }
  return hits / parsed.length >= 0.4;
}

export default function OpponentScout({ setActiveTab, initialScoutTarget }: Props) {
  const { requireAuth, username, password } = useBattrickAuth();
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState<string>('');
  const [roster, setRoster] = useState<ScoutPlayer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<BuyFitVerdict | null>(null);
  const [manualTeamId, setManualTeamId] = useState('');
  const [scannedTeamLabel, setScannedTeamLabel] = useState<string>('');
  const [scannedTeamId, setScannedTeamId] = useState<string>('');

  useEffect(() => {
    const fx =
      loadJson<BattrickGame[]>('bt_fixtures', []) ||
      loadJson<BattrickGame[]>('bt_league_office_fixtures', []);
    setFixtures(Array.isArray(fx) ? fx : []);
    setSquad(loadJson<BattrickPlayer[]>('bt_squad', []));
  }, []);

  // Deep-link from home / ladders with a concrete teamId
  useEffect(() => {
    if (!initialScoutTarget) return;
    if (initialScoutTarget.teamName) setSelectedOpponent(initialScoutTarget.teamName);
    if (initialScoutTarget.teamId) setManualTeamId(String(initialScoutTarget.teamId));
  }, [initialScoutTarget?.nonce, initialScoutTarget?.teamName, initialScoutTarget?.teamId]);

  const opponents = useMemo(() => {
    const names = new Map<string, BattrickGame>();
    for (const f of fixtures) {
      const name = f.opponent || '';
      if (!name) continue;
      if (!names.has(name)) names.set(name, f);
    }
    return [...names.values()].sort(
      (a, b) =>
        (parseGameDateToTimestamp(a.date, a.time) || 0) -
        (parseGameDateToTimestamp(b.date, b.time) || 0)
    );
  }, [fixtures]);

  const nextUp = useMemo(() => {
    const n7 = opponents.filter((f) => isGameInNext7Days(f.date, f.time));
    return n7[0] || opponents[0] || null;
  }, [opponents]);

  useEffect(() => {
    if (!selectedOpponent && nextUp?.opponent) setSelectedOpponent(nextUp.opponent);
  }, [nextUp, selectedOpponent]);

  // When opponent selection changes, pre-fill team ID from fixture if available
  useEffect(() => {
    if (!selectedOpponent || manualTeamId.trim()) return;
    const match = opponents.find((o) => o.opponent === selectedOpponent);
    if (!match) return;
    const ownId = getOwnTeamId();
    const resolved = resolveOpponentTeamId(match, '', ownId);
    if (resolved.teamId) {
      setManualTeamId(resolved.teamId);
    }
  }, [selectedOpponent, opponents]);

  const filtered = useMemo(() => {
    if (!query.trim()) return roster;
    const q = query.toLowerCase();
    return roster.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q));
  }, [roster, query]);

  const syncOpponent = async () => {
    setBusy(true);
    setError(null);
    setVerdict(null);
    try {
      await requireAuth();
      const match = opponents.find((o) => o.opponent === selectedOpponent) || nextUp;
      const ownTeamId = getOwnTeamId();
      const resolved = resolveOpponentTeamId(match, manualTeamId, ownTeamId);
      const teamId = resolved.teamId;

      if (!teamId) {
        if (resolved.source === 'manual-is-own') {
          throw new Error(
            'That team ID is your own club. Enter the opponent’s team ID from their Battrick office URL (office.asp?teamID=…).'
          );
        }
        throw new Error(
          'No opponent team ID found on this fixture. Open the opponent’s club office on Battrick, copy the teamID from the URL, paste it in Team ID, then scan again. Bare squad.asp always returns your own roster — we refuse that.'
        );
      }

      if (ownTeamId && teamId === ownTeamId) {
        throw new Error(
          `Team ID ${teamId} is your own club. Scout will not load your squad as the opponent.`
        );
      }

      const pageUrl = `https://www.battrick.org/nl/squad.asp?teamID=${teamId}`;
      const res = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: 'squad.asp',
          pageUrl,
          teamId,
          username,
          password,
          sessionToken: localStorage.getItem('bt_sync_session') || '',
        }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (data.sessionToken) localStorage.setItem('bt_sync_session', data.sessionToken);
      if (!res.ok || data.isAuthFailure) {
        throw new Error(
          data.error || 'Auth failed. Re-authenticate via the Auth bar, then scan again.'
        );
      }
      if (data.requestedTeamId && data.returnedTeamId && data.requestedTeamId !== data.returnedTeamId) {
        throw new Error(
          data.error ||
            `Battrick returned team #${data.returnedTeamId} instead of #${data.requestedTeamId}. Re-authenticate and try again.`
        );
      }
      if (!data.success || !data.html) {
        throw new Error(data.error || 'Could not load opponent squad');
      }
      const html: string = data.html;
      if (/log in to battrick/i.test(html) || /id=["']login["']/i.test(html)) {
        throw new Error('Login page returned — re-authenticate via the Auth bar.');
      }

      // Server-side mismatch is preferred, but double-check page title on the client
      const pageTeamId = extractPageTitleTeamId(html);
      if (pageTeamId && pageTeamId !== teamId) {
        throw new Error(
          `Page is for team #${pageTeamId}, not requested #${teamId}. Re-auth and scan again.`
        );
      }
      if (ownTeamId && pageTeamId && pageTeamId === ownTeamId) {
        throw new Error(
          `Battrick served your own club (team #${ownTeamId}) instead of the opponent. Re-authenticate, then scan with the opponent team ID.`
        );
      }

      const players = parsePlayersFromHtml(html);
      if (!players.length) {
        throw new Error(
          'No players parsed from opponent squad. Check the team ID or re-sync fixtures.'
        );
      }

      if (looksLikeOwnSquad(players, squad)) {
        throw new Error(
          'Parsed roster matches your own squad (player IDs overlap). Refusing to show it as the opponent. Enter the correct opponent team ID from their office URL.'
        );
      }

      const pageName = extractPageTitleTeamName(html) || selectedOpponent || `Team #${teamId}`;
      setRoster(players);
      setScannedTeamId(teamId);
      setScannedTeamLabel(pageName);
      try {
        localStorage.setItem(
          'bt_scout_roster_' + (selectedOpponent || teamId || 'unknown'),
          JSON.stringify({ teamId, teamName: pageName, players })
        );
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Scout sync failed');
      setRoster([]);
      setScannedTeamId('');
      setScannedTeamLabel('');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    try {
      const key = 'bt_scout_roster_' + (selectedOpponent || 'unknown');
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRoster(parsed);
          setScannedTeamLabel(selectedOpponent || '');
          setScannedTeamId('');
        } else if (parsed && Array.isArray(parsed.players)) {
          setRoster(parsed.players);
          setScannedTeamLabel(parsed.teamName || selectedOpponent || '');
          setScannedTeamId(parsed.teamId || '');
        } else {
          setRoster([]);
        }
      } else {
        setRoster([]);
        setScannedTeamLabel('');
        setScannedTeamId('');
      }
    } catch {
      setRoster([]);
    }
  }, [selectedOpponent]);

  const inspectPlayer = (p: ScoutPlayer) => {
    setSelectedId(p.id);
    setVerdict(null);
    if (!squad.length) {
      setError('Sync your own squad first so we can score BUY / MAYBE / PASS.');
      return;
    }
    setError(null);
    const asPlayer = {
      id: p.id,
      name: p.name,
      age: p.age ?? 25,
      role: p.role || 'Player',
      wage: p.wage ?? 0,
      btRating: p.btRating ?? 0,
      skills: {
        batting: p.skills.batting || 0,
        bowling: p.skills.bowling || 0,
        keeping: p.skills.keeping || 0,
        fielding: p.skills.fielding || 0,
        stamina: p.skills.stamina || 0,
        leadership: 0,
        experience: 0,
        concentration: 0,
        consistency: 0,
      },
      bowlingType: p.bowlingType || '',
      form: 5,
      fitness: 5,
      nets: { batting: 0, bowling: 0, keeping: 0, fielding: 0, stamina: 0 },
    } as BattrickPlayer;
    const targets = loadJson<Record<string, number> | null>('bt_rating_targets', null);
    const finances = loadJson<any>('bt_finances', null);
    try {
      const v = evaluateScoutBuyFit(asPlayer, squad, {
        cash: finances?.cash,
        ratingTargets: targets || undefined,
      });
      setVerdict(v);
    } catch (e: any) {
      setError(e?.message || 'Buy-fit failed');
    }
  };

  const resolvedPreview = useMemo(() => {
    const match = opponents.find((o) => o.opponent === selectedOpponent) || nextUp;
    return resolveOpponentTeamId(match, manualTeamId, getOwnTeamId());
  }, [opponents, selectedOpponent, nextUp, manualTeamId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-rose-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Scout</h2>
            <p className="text-[11px] text-slate-500">
              Scan an <span className="font-semibold text-slate-700">opponent</span> squad (never
              your own), then tap a player for BUY / MAYBE / PASS vs your team goals.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <label className="text-xs font-semibold text-slate-600 flex-1">
            Opponent
            <select
              value={selectedOpponent}
              onChange={(e) => {
                setSelectedOpponent(e.target.value);
                setManualTeamId(''); // allow auto-resolve for new selection
              }}
              className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white"
            >
              {opponents.length === 0 && (
                <option value="">Sync fixtures first (or type team ID below)</option>
              )}
              {opponents.map((o) => (
                <option key={o.opponent + (o.date || '')} value={o.opponent}>
                  {o.opponent} · {o.type || 'Match'} · {o.venue || ''} · {o.date}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 w-full sm:w-40">
            Opponent team ID
            <input
              value={manualTeamId}
              onChange={(e) => setManualTeamId(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 674"
              inputMode="numeric"
              className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm font-mono"
            />
          </label>
          <button
            type="button"
            disabled={busy || (!selectedOpponent && !manualTeamId.trim())}
            onClick={syncOpponent}
            className="self-end px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Scan opponent squad
          </button>
        </div>

        {resolvedPreview.teamId ? (
          <p className="text-[11px] text-slate-500">
            Will request{' '}
            <a
              className="font-mono text-indigo-600 underline"
              href={`https://www.battrick.org/nl/squad.asp?teamID=${resolvedPreview.teamId}`}
              target="_blank"
              rel="noreferrer"
            >
              squad.asp?teamID={resolvedPreview.teamId}
            </a>{' '}
            <span className="text-slate-400">({resolvedPreview.source})</span>
          </p>
        ) : (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            No opponent team ID yet. Paste the number from their Battrick office URL
            (<span className="font-mono">office.asp?teamID=…</span>). Without it, Scout will not
            scan (to avoid loading your own squad).
          </p>
        )}

        {error && (
          <div className="text-xs text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {opponents.length === 0 && (
          <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 flex gap-2">
            <Info className="w-4 h-4 shrink-0 text-slate-400" />
            <span>
              No fixtures loaded yet. Sync fixtures from the Sync tab, or enter a Battrick team ID
              (from their office URL) and scan directly.
              {setActiveTab && (
                <>
                  {' '}
                  <button
                    type="button"
                    className="text-indigo-600 font-bold underline"
                    onClick={() => setActiveTab('sync')}
                  >
                    Open Sync
                  </button>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-slate-500 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 truncate">
              {scannedTeamLabel || selectedOpponent || 'Opponent'} roster{' '}
              <span className="text-xs font-mono text-slate-500">{roster.length}</span>
              {scannedTeamId && (
                <span className="ml-1.5 text-[10px] font-mono font-normal text-slate-400">
                  #{scannedTeamId}
                </span>
              )}
            </h3>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players"
              className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        {roster.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8 border border-dashed rounded-xl">
            No opponent roster yet. Pick an opponent, confirm their team ID, and scan.
          </p>
        ) : (
          <div className="divide-y border border-slate-200 rounded-xl max-h-[50dvh] overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => inspectPlayer(p)}
                className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 flex justify-between gap-2 ${
                  selectedId === p.id ? 'bg-indigo-50' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {p.age != null ? `${p.age}y · ` : ''}
                    Bat {getSkillLabel('batting', p.skills.batting)} · Bowl{' '}
                    {getSkillLabel('bowling', p.skills.bowling)}
                    {p.wage != null ? ` · £${p.wage.toLocaleString()}/wk` : ''}
                  </div>
                </div>
                <UserCheck className="w-4 h-4 text-indigo-500 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {verdict && (
        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            verdict.verdict === 'BUY'
              ? 'border-emerald-200 bg-emerald-50'
              : verdict.verdict === 'MAYBE'
                ? 'border-amber-200 bg-amber-50'
                : 'border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4" />
            <h3 className="text-sm font-bold">
              Worth buying? <span className="uppercase tracking-wide">{verdict.verdict}</span>
            </h3>
          </div>
          <p className="text-xs opacity-90 mb-2">Score {verdict.score}</p>
          {verdict.summary && <p className="text-xs mb-2">{verdict.summary}</p>}
          <ul className="text-[11px] space-y-1 list-disc pl-4">
            {(verdict.reasons || []).map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {verdict.affordable === false && (
            <p className="text-[11px] text-rose-700 mt-2 font-semibold">Over budget for current cash.</p>
          )}
        </div>
      )}

      {!squad.length && (
        <p className="text-[11px] text-slate-500 text-center">
          Sync your squad so BUY / MAYBE / PASS can compare against your gaps.
          {setActiveTab && (
            <>
              {' '}
              <button
                type="button"
                className="text-indigo-600 font-bold underline"
                onClick={() => setActiveTab('sync')}
              >
                Open Sync
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
