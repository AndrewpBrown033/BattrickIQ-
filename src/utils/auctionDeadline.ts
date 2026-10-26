/**
 * Auction deadline parsing for Battrick Transfer Watch.
 *
 * Battrick application / listing times are Battrick Time (GMT/UTC wall-clock).
 * We parse the deadline as GMT, then show:
 *   - End time in Australia/Sydney
 *   - End time in GMT
 *   - Live countdown until that moment
 */

export const DEADLINE_TZ = 'Australia/Sydney';

function parseDeadlineParts(deadline?: string | null): {
  d: number;
  mo: number;
  y: number;
  h: number;
  mi: number;
  s: number;
} | null {
  if (!deadline) return null;
  // Strip common suffixes and labels: "GMT", "UTC", "BT", "Deadline:"
  let s = String(deadline)
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/Deadline\s*:?\s*/i, '')
    .replace(/\b(GMT|UTC|BT(?:\s*time)?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // DD/MM/YYYY HH:mm[:ss]
  let m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return { d: +m[1], mo: +m[2], y: +m[3], h: +m[4], mi: +m[5], s: m[6] ? +m[6] : 0 };
  }

  // YYYY-MM-DD[ T]HH:mm[:ss]
  m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: m[6] ? +m[6] : 0 };
  }

  // DD-MM-YYYY HH:mm
  m = s.match(/(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return { d: +m[1], mo: +m[2], y: +m[3], h: +m[4], mi: +m[5], s: m[6] ? +m[6] : 0 };
  }

  return null;
}

/** Epoch ms treating the deadline wall-clock as GMT/UTC (Battrick Time). */
export function parseDeadlineGmtMs(deadline?: string | null): number | null {
  const p = parseDeadlineParts(deadline);
  if (!p) return null;
  if (p.mo < 1 || p.mo > 12 || p.d < 1 || p.d > 31 || p.h > 23 || p.mi > 59) return null;
  const ms = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s || 0);
  return Number.isFinite(ms) ? ms : null;
}

/** @deprecated Prefer parseDeadlineGmtMs — deadlines are GMT wall-clock. */
export function parseDeadlineSydneyMs(deadline?: string | null): number | null {
  return parseDeadlineGmtMs(deadline);
}

export function hoursUntilDeadline(deadline?: string | null): number | null {
  const ms = parseDeadlineGmtMs(deadline);
  if (ms == null) return null;
  return (ms - Date.now()) / 3_600_000;
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

/**
 * Live countdown for a Watch auction.
 * Deadline string is Battrick Time (GMT); end labels shown in Sydney + GMT.
 */
export function getDeadlineCountdown(
  deadline?: string | null,
  nowMs: number = Date.now()
): {
  msLeft: number;
  ended: boolean;
  label: string;
  /** Auction end in Australia/Sydney */
  sydneyEndLabel: string;
  /** Same moment labelled as GMT */
  gmtEndLabel: string;
  endsAtMs: number;
} | null {
  const end = parseDeadlineGmtMs(deadline);
  if (end == null) return null;
  const msLeft = end - nowMs;
  const sydneyEndLabel = formatInTz(end, DEADLINE_TZ);
  // Always label as GMT explicitly (Intl may say "UTC" or omit zone)
  const gmtCore = formatInTz(end, 'UTC').replace(/\s*(GMT|UTC)\s*$/i, '').trim();
  const gmtEndLabel = `${gmtCore} GMT`;
  if (msLeft <= 0) {
    return {
      msLeft: 0,
      ended: true,
      label: 'Ended',
      sydneyEndLabel,
      gmtEndLabel,
      endsAtMs: end,
    };
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
