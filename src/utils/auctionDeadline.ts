/**
 * Auction deadline parsing: listing times are GMT; display end in Sydney + countdown.
 */
export const DEADLINE_TZ = 'Australia/Sydney';

function parseDeadlineParts(deadline?: string | null): {
  d: number; mo: number; y: number; h: number; mi: number; s: number;
} | null {
  if (!deadline) return null;
  const s = String(deadline).trim();
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    return { y: +iso[1], mo: +iso[2], d: +iso[3], h: +iso[4], mi: +iso[5], s: iso[6] ? +iso[6] : 0 };
  }
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return { d: +m[1], mo: +m[2], y: +m[3], h: +m[4], mi: +m[5], s: m[6] ? +m[6] : 0 };
}

/** Epoch ms treating the deadline wall-clock as GMT/UTC. */
export function parseDeadlineGmtMs(deadline?: string | null): number | null {
  const p = parseDeadlineParts(deadline);
  if (!p) return null;
  const ms = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s || 0);
  return Number.isFinite(ms) ? ms : null;
}

export function parseDeadlineSydneyMs(deadline?: string | null): number | null {
  return parseDeadlineGmtMs(deadline);
}

export function hoursUntilDeadline(deadline?: string | null): number | null {
  const ms = parseDeadlineGmtMs(deadline);
  if (ms == null) return null;
  return (ms - Date.now()) / 3600000;
}

function formatInTz(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return 'Ended';
  const totalSec = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${hours}h ${pad(mins)}m ${pad(secs)}s`;
  if (hours > 0) return `${hours}h ${pad(mins)}m ${pad(secs)}s`;
  return `${mins}m ${pad(secs)}s`;
}

export function getDeadlineCountdown(
  deadline?: string | null,
  nowMs: number = Date.now()
): {
  msLeft: number;
  ended: boolean;
  label: string;
  sydneyEndLabel: string;
  gmtEndLabel: string;
  endsAtMs: number;
} | null {
  const end = parseDeadlineGmtMs(deadline);
  if (end == null) return null;
  const msLeft = end - nowMs;
  const sydneyEndLabel = formatInTz(end, DEADLINE_TZ);
  const gmtEndLabel = formatInTz(end, 'UTC').replace(/\s*GMT$/i, '').trim() + ' GMT';
  if (msLeft <= 0) {
    return { msLeft: 0, ended: true, label: 'Ended', sydneyEndLabel, gmtEndLabel, endsAtMs: end };
  }
  return {
    msLeft,
    ended: false,
    label: formatCountdown(msLeft),
    sydneyEndLabel,
    gmtEndLabel,
    endsAtMs: end,
  };
}
