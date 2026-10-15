import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Swords, UserCheck, RefreshCw, AlertTriangle, Users, Target
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

export default function OpponentScout({ setActiveTab }: Props) {
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

  useEffect(() => {
    setFixtures(
      loadJson<BattrickGame[]>('bt_fixtures', []) ||
        loadJson<BattrickGame[]>('bt_league_office_fixtures', [])
    );
    setSquad(loadJson<BattrickPlayer[]>('bt_squad', []));
  }, []);

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
      const teamId = match?.opponentTeamId || match?.awayTeamId || match?.homeTeamId;
      const pageUrl = teamId
        ? `https://www.battrick.org/nl/squad.asp?teamID=${teamId}`
        : 'https://www.battrick.org/nl/squad.asp';
      const res = await fetch('/api/sync-battrick-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageName: 'squad.asp',
          pageUrl,
          username,
          password,
          sessionToken: localStorage.getItem('bt_sync_session') || '',
        }),
      });
      const data = await res.json();
      if (data.sessionToken) localStorage.setItem('bt_sync_session', data.sessionToken);
      if (!data.success || !data.html) throw new Error(data.error || 'Could not load opponent squad');
      const html: string = data.html;
      if (/log in to battrick/i.test(html) || /id="login"/i.test(html)) {
        throw new Error('Login page returned — re-authenticate via the Auth bar.');
      }
      const players = parsePlayersFromHtml(html);
      if (!players.length) {
        throw new Error(
          'No players parsed. Opponent may need a team ID on the fixture.'
        );
      }
      setRoster(players);
      try {
        localStorage.setItem(
          'bt_scout_roster_' + (selectedOpponent || 'unknown'),
          JSON.stringify(players)
        );
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Scout sync failed');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    try {
      const key = 'bt_scout_roster_' + (selectedOpponent || 'unknown');
      const raw = localStorage.getItem(key);
      if (raw) setRoster(JSON.parse(raw));
      else setRoster([]);
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
    const asPlayer: BattrickPlayer = {
      id: p.id,
      name: p.name,
      age: p.age ?? 25,
      role: p.role || 'Player',
      wage: p.wage ?? 0,
      btRating: p.btRating ?? 0,
      skills: p.skills as any,
      bowlingType: p.bowlingType,
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

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-rose-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Scout</h2>
            <p className="text-[11px] text-slate-500">
              Next opponents, squad scan, and worth-buying vs your team goals.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <label className="text-xs font-semibold text-slate-600 flex-1">
            Opponent
            <select
              value={selectedOpponent}
              onChange={(e) => setSelectedOpponent(e.target.value)}
              className="mt-1 w-full border border-slate-200 rounded-lg px-2 py-2 text-sm"
            >
              {opponents.length === 0 && <option value="">Sync fixtures first</option>}
              {opponents.map((o) => (
                <option key={o.opponent + o.date} value={o.opponent}>
                  {o.opponent} · {o.type || 'Match'} · {o.date}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || !selectedOpponent}
            onClick={syncOpponent}
            className="self-end px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            Scan opponent squad
          </button>
        </div>

        {error && (
          <div className="text-xs text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">
              {selectedOpponent || 'Opponent'} roster{' '}
              <span className="text-xs font-mono text-slate-500">{roster.length}</span>
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
            No scout roster yet. Pick an opponent and scan their squad.
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
              Worth buying?{' '}
              <span className="uppercase tracking-wide">{verdict.verdict}</span>
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
              <button type="button" className="text-indigo-600 font-bold underline" onClick={() => setActiveTab('sync')}>
                Open Sync
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
