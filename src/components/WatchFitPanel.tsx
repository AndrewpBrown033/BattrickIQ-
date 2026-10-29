import React, { useEffect, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { loadWatchlist, type WatchEntry } from '../utils/transferWatchlist';
import { nextExpectedBid } from '../utils/bidBot';
import { callJarvisOpenRouter } from '../utils/jarvisChatClient';
import { defaultRatings } from './squad/squadHelpers';
import { levelToLabel, type TeamRatingKey } from '../utils/transferList';
import {
  buildWatchFit,
  buildWatchFitBriefing,
  profileFromWatchEntry,
  skillsWereRead,
  WATCH_FIT_SYSTEM_PROMPT,
  type Level,
  type WatchFitReport,
  type WatchSquadPlayer,
} from '../utils/watchFit';

const cacheKey = (id: string) => `bt_watch_fit_${id}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Same goals the Estimator uses: what the manager set, on top of the defaults. */
function loadTargets(): Partial<Record<TeamRatingKey, number>> {
  return { ...defaultRatings(), ...readJson<Record<string, number>>('bt_rating_targets', {}) };
}

function loadSquad(): WatchSquadPlayer[] {
  return readJson<any[]>('bt_squad', []).map((p) => ({
    id: p.id,
    name: p.name,
    age: p.age || 0,
    wage: p.wage,
    btRating: p.btRating,
    role: p.role,
    skills: p.skills || {},
    bowlingType: p.bowlingType,
  }));
}

const money = (n: number) => (n < 0 ? '-£' : '£') + Math.abs(Math.round(n)).toLocaleString('en-GB');

const DOT: Record<Level, string> = { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500' };
const CHIP: Record<Level, string> = {
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warn: 'bg-amber-50 border-amber-200 text-amber-950',
  bad: 'bg-rose-50 border-rose-200 text-rose-900',
};

function Row({ level, title, children }: { level: Level; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${DOT[level]}`} />
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">{title}</div>
        <div className="text-[12px] text-slate-800 leading-snug">{children}</div>
      </div>
    </div>
  );
}

/** Jarvis' reply is "## Heading" + lines; render the headings bold and keep the rest as plain text. */
function JarvisText({ text }: { text: string }) {
  return (
    <div className="text-[12px] text-slate-800 leading-snug space-y-0.5">
      {text.split('\n').map((line, i) =>
        /^#{1,4}\s/.test(line) ? (
          <div key={i} className="pt-1.5 text-[10px] font-black uppercase tracking-wide text-indigo-700">
            {line.replace(/^#{1,4}\s*/, '')}
          </div>
        ) : line.trim() ? (
          <div key={i}>{line.replace(/\*\*/g, '')}</div>
        ) : null
      )}
    </div>
  );
}

interface Saved {
  at: string;
  report: WatchFitReport;
  ai?: string;
  aiNote?: string;
}

export default function WatchFitPanel({
  entry,
  refreshDetails,
}: {
  entry: WatchEntry;
  /** Reads his page from Battrick and stores skills / age / wage on the entry. Returns the updated entry. */
  refreshDetails: (e: WatchEntry) => Promise<WatchEntry | null>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(() => readJson<Saved | null>(cacheKey(entry.playerId), null));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSaved(readJson<Saved | null>(cacheKey(entry.playerId), null));
  }, [entry.playerId]);

  const run = async () => {
    setError(null);
    setOpen(true);
    try {
      let e: WatchEntry = loadWatchlist().find((w) => w.playerId === entry.playerId) || entry;
      if (!skillsWereRead(e)) {
        setBusy('Reading his Battrick page…');
        try {
          e = (await refreshDetails(e)) || e;
        } catch (err: any) {
          // Carry on: the report will say plainly that his skills couldn't be read.
          setError(`Couldn't read his Battrick page: ${err?.message || err}`);
        }
      }

      setBusy('Working out the numbers…');
      const squad = loadSquad();
      const price = e.maxBid || nextExpectedBid(e.lastCurrentBid, e.lastAskingPrice) || undefined;
      const report = buildWatchFit({
        name: e.name,
        profile: profileFromWatchEntry(e),
        fallbackAge: e.age,
        price,
        squad,
        finances: readJson<any>('bt_finances', null),
        targets: loadTargets(),
      });

      let ai: string | undefined;
      let aiNote: string | undefined;
      const key = (() => {
        try {
          return localStorage.getItem('bt_openrouter_api_key') || '';
        } catch {
          return '';
        }
      })();
      if (!key) {
        aiNote = 'Add your OpenRouter key in Jarvis settings to get a written verdict. The numbers above work without it.';
      } else {
        setBusy('Asking Jarvis…');
        try {
          ai = await callJarvisOpenRouter({
            message: `Check ${e.name}: does he make sense for my squad, what does he do to my weekly income, and does he move me towards my team goals?`,
            context: buildWatchFitBriefing(report, { squad, maxBid: e.maxBid, deadline: e.lastDeadline }),
            systemPrompt: WATCH_FIT_SYSTEM_PROMPT,
            direct: true,
            maxTokens: 450,
          });
        } catch (err: any) {
          aiNote = `Jarvis couldn't answer: ${err?.message || err}`;
        }
      }

      const next: Saved = { at: new Date().toISOString(), report, ai, aiNote };
      setSaved(next);
      try {
        localStorage.setItem(cacheKey(entry.playerId), JSON.stringify(next));
      } catch {}
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setBusy(null);
    }
  };

  const r = saved?.report;
  const goalsTargets = r?.goals?.rows || [];

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void run()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-[11px] font-bold"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {saved ? 'Re-check with Jarvis' : 'Jarvis check'}
        </button>
        {saved && !busy && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600"
          >
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {open ? 'Hide' : 'Show'} · {r!.headline}
          </button>
        )}
        {busy && <span className="text-[11px] text-slate-500">{busy}</span>}
      </div>

      {error && <div className="mt-1.5 text-[11px] text-rose-700">{error}</div>}

      {open && r && (
        <div className={`mt-2 rounded-xl border p-3 space-y-2.5 ${CHIP[r.level]}`}>
          <div className="text-[11px] font-black uppercase tracking-wide">{r.headline}</div>
          <div className="bg-white/70 rounded-lg p-2.5 space-y-2.5 border border-white">
            <Row level={r.squad.level} title="Squad fit">
              {r.squad.verdict && (
                <span className="font-bold">
                  {r.squad.verdict.verdict} · {r.squad.verdict.score}/100.{' '}
                </span>
              )}
              {r.squad.note}
            </Row>
            <Row level={r.money?.level || 'warn'} title="Weekly income">
              {r.money ? r.money.note : 'Finances not synced.'}
            </Row>
            <Row level={r.goals?.level || 'warn'} title="Team goals">
              {r.goals ? r.goals.note : 'Not assessed.'}
              {goalsTargets.length > 0 && (
                <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[10px] text-slate-600">
                  {goalsTargets.map((g) => (
                    <React.Fragment key={g.key}>
                      <span>{g.label}</span>
                      <span className={g.change > 0 ? 'text-emerald-700 font-bold' : ''}>
                        {levelToLabel(g.before)} → {levelToLabel(g.after)} (goal {levelToLabel(g.target)})
                        {g.closedGap ? ' ✓ reached' : ''}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </Row>
          </div>

          {r.dataGaps.length > 0 && (
            <ul className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 list-disc list-inside">
              {r.dataGaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          )}

          {saved?.ai ? (
            <div className="bg-white/80 rounded-lg p-2.5 border border-violet-200">
              <div className="text-[10px] font-black uppercase tracking-wide text-violet-700 mb-0.5">Jarvis says</div>
              <JarvisText text={saved.ai} />
            </div>
          ) : (
            saved?.aiNote && <div className="text-[11px] text-slate-600">{saved.aiNote}</div>
          )}

          <div className="text-[10px] text-slate-500">
            Checked {new Date(saved!.at).toLocaleString()} on this device · uses your synced squad, finances and
            Estimator goals · price used: {r.money?.price != null ? money(r.money.price) : 'n/a'}
          </div>
        </div>
      )}
    </div>
  );
}
