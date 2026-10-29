import React, { useMemo, useState } from 'react';
import { Bot, Send, Loader2 } from 'lucide-react';
import type { BattrickPlayer, LineupPlayer, BattrickGame } from '../types';
import { callJarvisOpenRouter, LINEUP_ONLY_SYSTEM_PROMPT } from '../utils/jarvisChatClient';
import { buildLineupBriefing, nextUpcomingFixture, type OpponentBriefPlayer } from '../utils/lineupJarvis';
import { getOwnTeamId, getOwnTeamName } from '../utils/teamIdentity';
import { resolveFixtureOpponent } from '../utils/opponentResolve';

interface Props {
  lineup: LineupPlayer[];
  squad: BattrickPlayer[];
}

const QUICK = [
  { label: 'Review this XI', q: 'Review the XI I have picked. Is it the best side from my squad for this game? Name any swaps.' },
  { label: 'Pick my best XI', q: 'Pick the best XI and batting order for this game from my full squad.' },
  { label: 'Bowling plan', q: 'Give me the bowling plan for this game: who opens, who bowls the middle and death overs, and the 5th bowler.' },
  { label: 'Who to rest', q: 'Which players should I rest or swap because of fitness or form, and who replaces them?' },
];

function readFixtures(): BattrickGame[] {
  try {
    const raw = JSON.parse(localStorage.getItem('bt_fixtures') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** A scouted roster cached by the Scout / Drill Into Game screens, flattened to what the briefing needs. */
function readScoutedRoster(opponentName: string): OpponentBriefPlayer[] {
  if (!opponentName) return [];
  try {
    const r = JSON.parse(localStorage.getItem('bt_scout_roster_' + opponentName) || 'null');
    const ps: any[] = Array.isArray(r) ? r : r?.players;
    if (!Array.isArray(ps)) return [];
    return ps
      .filter((p) => p?.name)
      .map((p) => ({
        id: p.id,
        name: String(p.name),
        role: p.role,
        bowlingType: p.bowlingType,
        batting: p.skills ? p.skills.batting : p.batting,
        bowling: p.skills ? p.skills.bowling : p.bowling,
      }));
  } catch {
    return [];
  }
}

/** Minimal rendering of Jarvis's "## heading" / bullet / numbered answer. */
function renderAnswer(text: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return <div key={i} className="mt-2 first:mt-0 text-[11px] font-black uppercase tracking-wide text-indigo-800">{line.slice(3)}</div>;
    }
    if (!line.trim()) return <div key={i} className="h-1" />;
    return <div key={i} className="text-xs text-slate-700 leading-snug">{line.replace(/\*\*/g, '')}</div>;
  });
}

export default function LineupJarvisPanel({ lineup, squad }: Props) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fixture = useMemo(() => nextUpcomingFixture(readFixtures()), []);
  const own = { teamId: getOwnTeamId(), teamName: getOwnTeamName() };
  const opponentLabel = fixture ? resolveFixtureOpponent(fixture, own).opponent.name : '';

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setError('');
    try {
      const opponentName = fixture ? resolveFixtureOpponent(fixture, own).opponent.name : '';
      const briefing = buildLineupBriefing({
        xi: lineup.map((p) => ({ name: p.name, role: p.role, bowlingType: p.bowlingType, batting: p.batting, bowling: p.bowling, keeping: p.keeping })),
        squad: squad as any,
        fixture,
        own,
        opponentPlayers: readScoutedRoster(opponentName),
      });
      const reply = await callJarvisOpenRouter({
        message: question,
        context: briefing.text,
        systemPrompt: LINEUP_ONLY_SYSTEM_PROMPT,
        direct: true,
        maxTokens: 700,
      });
      setAnswer(reply || 'No response was generated.');
    } catch (e: any) {
      const msg = String(e?.message || 'Request failed');
      setError(/api key required/i.test(msg) ? 'Add your OpenRouter key in Jarvis Settings (More → Jarvis Settings) to use Coach Jarvis.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-sm">
      <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        <Bot className="w-4 h-4 text-indigo-600" />
        Coach Jarvis
      </h4>
      <p className="text-[11px] text-slate-500 mt-1">
        {fixture ? <>Lineup advice for your next game vs <strong>{opponentLabel || 'your opponent'}</strong>.</> : 'Lineup advice from your squad (no upcoming fixture found).'}
      </p>

      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {QUICK.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={busy || squad.length === 0}
            onClick={() => ask(c.q)}
            className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { ask(query); setQuery(''); }
          }}
          placeholder="Ask about your XI, order or bowlers…"
          className="flex-1 min-w-0 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
        />
        <button
          type="button"
          disabled={busy || !query.trim()}
          onClick={() => { ask(query); setQuery(''); }}
          className="px-2.5 rounded-lg bg-indigo-600 text-white disabled:opacity-50"
          aria-label="Ask Jarvis"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {busy && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Jarvis is picking…
        </div>
      )}
      {error && <div className="mt-3 text-xs text-rose-800 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2">{error}</div>}
      {answer && !busy && (
        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-0.5">{renderAnswer(answer)}</div>
      )}
    </div>
  );
}
