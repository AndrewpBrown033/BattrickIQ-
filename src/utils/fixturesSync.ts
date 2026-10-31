/**
 * Pull the real Draw from Battrick (fixtures.asp) and store it as bt_fixtures.
 * Used by the app's startup sync and by the Refresh button on the 16-Week Match Ledger.
 * Read-only against Battrick: it only fetches the page.
 */
import type { BattrickGame, DiaryEntry } from '../types';
import { parseBattrickPage } from '../parser';
import { mergeFixtures, countUpcoming, isPlayed } from './fixturesMerge';

export const FIXTURES_SYNCED_AT_KEY = 'bt_fixtures_synced_at';
/** Startup sync is skipped when the Draw was refreshed more recently than this. */
export const FIXTURES_AUTO_SYNC_MIN_AGE_MS = 15 * 60 * 1000;

export interface FixturesSyncResult {
  total: number;
  upcoming: number;
  played: number;
  syncedAt: number;
}

export function lastFixturesSyncAt(): number {
  try {
    return Number(localStorage.getItem(FIXTURES_SYNCED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function fixturesSyncIsFresh(now = Date.now()): boolean {
  const at = lastFixturesSyncAt();
  return at > 0 && now - at < FIXTURES_AUTO_SYNC_MIN_AGE_MS;
}

function readStoredFixtures(): BattrickGame[] {
  try {
    const raw = JSON.parse(localStorage.getItem('bt_fixtures') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function fetchBattrickHtml(pageName: 'fixtures' | 'diary', creds: { username: string; password: string }): Promise<string> {
  const username = creds.username.trim();
  if (!username || !creds.password) throw new Error('Sign in to Battrick first.');

  const response = await fetch('/api/sync-battrick-step', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pageName,
      username,
      password: creds.password,
      sessionToken: localStorage.getItem('bt_sync_session') || '',
    }),
  });
  const data: any = await response.json().catch(() => ({}));
  if (data.sessionToken) localStorage.setItem('bt_sync_session', data.sessionToken);
  if (!response.ok || data.isAuthFailure) {
    throw new Error(data.error || `Battrick returned HTTP ${response.status}`);
  }
  const html: string = data.html || '';
  if (!html) throw new Error('Battrick returned an empty page.');
  if (/log in to battrick|id=["']login["']/i.test(html)) {
    throw new Error('Battrick returned its login page. Re-authenticate and try again.');
  }
  return html;
}

export async function syncFixturesFromBattrick(creds: { username: string; password: string }): Promise<FixturesSyncResult> {
  const html = await fetchBattrickHtml('fixtures', creds);

  const parsed = parseBattrickPage(html, 'fixtures');
  const incoming: BattrickGame[] = parsed.type === 'fixtures' && parsed.fixtures ? parsed.fixtures : [];
  if (incoming.length === 0) {
    throw new Error(`Could not read any fixtures from fixtures.asp (${html.length} chars received).`);
  }

  const merged = mergeFixtures(readStoredFixtures(), incoming);
  const syncedAt = Date.now();
  localStorage.setItem('bt_fixtures', JSON.stringify(merged));
  localStorage.setItem(FIXTURES_SYNCED_AT_KEY, String(syncedAt));
  if (parsed.teamName && parsed.teamName !== 'My Club' && parsed.teamName !== 'My Battrick IQ Club') {
    localStorage.setItem('bt_team_name', parsed.teamName);
    window.dispatchEvent(new Event('bt_team_name_updated'));
  }
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('bt_cloud_backup_request'));

  return { total: merged.length, upcoming: countUpcoming(merged), played: merged.filter(isPlayed).length, syncedAt };
}

/**
 * Pull the Club Diary (diary.asp): the real gate receipts and income per match. The ledger lines these up with
 * the Draw by match ID. Entries accumulate week by week, so they are merged (update in place, append new),
 * exactly as the Sync Hub does.
 */
export async function syncDiaryFromBattrick(creds: { username: string; password: string }): Promise<{ entries: number }> {
  const html = await fetchBattrickHtml('diary', creds);
  const parsed = parseBattrickPage(html, 'diary');
  const incoming: DiaryEntry[] = parsed.type === 'diary' && parsed.diary ? parsed.diary : [];
  if (incoming.length === 0) throw new Error('No diary entries could be read from diary.asp.');

  let existing: DiaryEntry[] = [];
  try {
    const raw = JSON.parse(localStorage.getItem('bt_diary') || '[]');
    if (Array.isArray(raw)) existing = raw;
  } catch {
    existing = [];
  }
  const merged = [...existing];
  for (const e of incoming) {
    const i = merged.findIndex((m) =>
      (e.matchId && m.matchId === e.matchId) ||
      (!e.matchId && m.week === e.week && m.date === e.date && m.description === e.description)
    );
    if (i >= 0) merged[i] = { ...merged[i], ...e };
    else merged.push(e);
  }
  merged.sort((a, b) => (a.week || 0) - (b.week || 0));
  localStorage.setItem('bt_diary', JSON.stringify(merged));
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new Event('bt_cloud_backup_request'));
  return { entries: merged.length };
}

export interface DrawAndIncomeResult extends FixturesSyncResult {
  /** Number of diary entries now stored, or null when the diary could not be refreshed. */
  diaryEntries: number | null;
  diaryError?: string;
}

/** Refresh the Draw first (that is what must succeed), then the diary income; a diary failure is reported, not fatal. */
export async function syncDrawAndIncome(creds: { username: string; password: string }): Promise<DrawAndIncomeResult> {
  const draw = await syncFixturesFromBattrick(creds);
  try {
    const { entries } = await syncDiaryFromBattrick(creds);
    return { ...draw, diaryEntries: entries };
  } catch (e: any) {
    return { ...draw, diaryEntries: null, diaryError: e?.message || 'Diary refresh failed' };
  }
}
