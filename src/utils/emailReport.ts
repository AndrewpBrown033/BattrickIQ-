/**
 * Email report: games played, training pops, and transfer purchases/sales.
 *
 * Sending uses Firebase's "Trigger Email from Firestore" extension: we add a document to the
 * `mail` collection and the extension delivers it through the SMTP/SendGrid account configured
 * when the extension was installed. Nothing is sent until that extension is installed.
 */
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getWeeklyChanges } from './history';

const REPORT_EMAIL_KEY = 'bt_report_email';

export function getSavedReportEmail(): string {
  try { return localStorage.getItem(REPORT_EMAIL_KEY) || ''; } catch { return ''; }
}
export function saveReportEmail(email: string) {
  try { localStorage.setItem(REPORT_EMAIL_KEY, email.trim()); } catch {}
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Battrick dates are dd/mm/yyyy (optionally followed by a time). */
function parseDmy(s?: string): number | null {
  const m = (s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

const money = (n: number) => `${n < 0 ? '-' : ''}£${Math.abs(Math.round(n)).toLocaleString()}`;
const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export interface ReportData {
  club: string;
  days: number;
  games: { date: string; opponent: string; type: string; venue: string; result: string }[];
  upcoming: { date: string; opponent: string; type: string; venue: string }[];
  pops: { player: string; skill: string; from: number; to: number }[];
  purchases: { date: string; description: string; amount: number }[];
}

export function buildReportData(days = 7): ReportData {
  const now = Date.now();
  const since = now - days * 86_400_000;
  const club = localStorage.getItem('bt_team_name') || 'My club';

  const fixtures = readJson<any[]>('bt_fixtures', []);
  const games: ReportData['games'] = [];
  const upcoming: ReportData['upcoming'] = [];
  for (const f of Array.isArray(fixtures) ? fixtures : []) {
    const t = parseDmy(f?.date);
    const result = String(f?.result || '').trim();
    const played = result && !/^upcoming$/i.test(result);
    const row = {
      date: String(f?.date || ''),
      opponent: String(f?.opponent || f?.awayTeam || ''),
      type: String(f?.type || f?.matchType || ''),
      venue: String(f?.venue || ''),
    };
    if (played && t != null && t >= since && t <= now + 86_400_000) games.push({ ...row, result });
    else if (!played && t != null && t > now - 86_400_000 && upcoming.length < 3) upcoming.push(row);
  }

  const squad = readJson<any[]>('bt_squad', []);
  const pops: ReportData['pops'] = [];
  for (const p of Array.isArray(squad) ? squad : []) {
    try {
      const ch = getWeeklyChanges(p);
      ch?.skillPops.forEach((sp) => {
        if (sp.to > sp.from) pops.push({ player: p.name, skill: sp.skill, from: sp.from, to: sp.to });
      });
    } catch {}
  }

  const diary = readJson<any[]>('bt_diary', []);
  const purchases: ReportData['purchases'] = [];
  for (const d of Array.isArray(diary) ? diary : []) {
    const t = parseDmy(d?.date);
    if (t == null || t < since - 7 * 86_400_000) continue; // transfers settle a few days after the deadline
    const text = String(d?.description || '');
    if (d?.category === 'transfer' || /\b(bought|purchased|signed|sold|transfer(?:red)?)\b/i.test(text)) {
      purchases.push({ date: String(d.date), description: text, amount: Number(d.amount) || 0 });
    }
  }

  return { club, days, games, upcoming, pops, purchases };
}

export function renderReport(r: ReportData): { subject: string; text: string; html: string } {
  const subject = `BattrickIQ report: ${r.club} (last ${r.days} days)`;
  const section = (title: string, rows: string[], empty: string) => ({
    text: `${title}\n${rows.length ? rows.map((x) => `  - ${x}`).join('\n') : `  ${empty}`}`,
    html: `<h3 style="margin:18px 0 6px">${esc(title)}</h3>${
      rows.length ? `<ul style="margin:0;padding-left:18px">${rows.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p style="margin:0;color:#64748b">${esc(empty)}</p>`
    }`,
  });
  const g = section('Games', r.games.map((x) => `${x.date} ${x.type} vs ${x.opponent} (${x.venue}): ${x.result}`), 'No games played in this period.');
  const u = section('Coming up', r.upcoming.map((x) => `${x.date} ${x.type} vs ${x.opponent} (${x.venue})`), 'No upcoming fixtures synced.');
  const p = section('Training pops', r.pops.map((x) => `${x.player}: ${x.skill} ${x.from} → ${x.to}`), 'No skill pops since the last sync.');
  const b = section('Purchases and sales', r.purchases.map((x) => `${x.date} ${x.description} (${money(x.amount)})`), 'No transfer activity found in the diary.');
  const text = `${r.club}\n\n${[g, p, b, u].map((s) => s.text).join('\n\n')}\n\nGenerated by BattrickIQ from your last sync.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;max-width:560px"><h2 style="margin:0">${esc(r.club)}</h2><p style="margin:2px 0 0;color:#64748b">Last ${r.days} days</p>${[g, p, b, u].map((s) => s.html).join('')}<p style="margin-top:20px;color:#94a3b8;font-size:12px">Generated by BattrickIQ from your last sync.</p></div>`;
  return { subject, text, html };
}

/** Queue the report for delivery by the Firestore "Trigger Email" extension. Throws with a readable message. */
export async function queueReportEmail(to: string, days = 7): Promise<ReportData> {
  const addr = to.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) throw new Error('Enter a valid email address');
  if (!db) throw new Error('Cloud database is not available');
  const data = buildReportData(days);
  const { subject, text, html } = renderReport(data);
  try {
    await addDoc(collection(db, 'mail'), { to: [addr], message: { subject, text, html } });
  } catch (e: any) {
    throw new Error(`Could not queue the email: ${e?.code || e?.message || e}`);
  }
  saveReportEmail(addr);
  return data;
}
