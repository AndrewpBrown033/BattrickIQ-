/**
 * Single-runner lease for the Transfer Watch bid bot.
 *
 * Once the watch list follows you across devices, every device with the Watch page open would run its
 * own bot and each would post a bid for the same player. The lease lives in the same Firestore doc as
 * the list (`botLease`), is renewed by the runner on every bot tick (~1 min) and expires after
 * LEASE_TTL_MS, so a closed laptop hands over to the phone automatically.
 *
 * Runner identity is per *tab* (sessionStorage), not per browser: two tabs of the same browser share
 * localStorage and would otherwise both count as "this device".
 */
import { doc, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getCustomUser } from '../lib/customAuth';

const DEVICE_ID_KEY = 'bt_device_id';
const TAB_ID_KEY = 'bt_tab_id';

export const LEASE_TTL_MS = 3 * 60_000;
export const LEASE_EVENT = 'bt_watch_lease_changed';

export interface BotLease {
  runnerId: string;
  deviceLabel: string;
  at: string;
}

export interface BotLeaseState {
  /** A lease exists and has been renewed within the TTL. */
  active: boolean;
  /** This tab holds it. */
  mine: boolean;
  holderLabel: string | null;
  at: string | null;
}

export function watchDocRef(uid: string) {
  return doc(db, 'users', uid, 'settings', 'transferWatch');
}

function rand(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {}
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

let memDeviceId: string | null = null;
let memTabId: string | null = null;

function stored(storage: 'local' | 'session', key: string, fallback: () => string): string {
  try {
    const s = storage === 'local' ? window.localStorage : window.sessionStorage;
    let v = s.getItem(key);
    if (!v) {
      v = fallback();
      s.setItem(key, v);
    }
    return v;
  } catch {
    return fallback();
  }
}

export function getDeviceId(): string {
  return (memDeviceId ||= stored('local', DEVICE_ID_KEY, rand));
}

/** Unique per browser tab; this is what the lease is keyed on. */
export function getRunnerId(): string {
  return (memTabId ||= getDeviceId() + ':' + stored('session', TAB_ID_KEY, () => rand().slice(0, 8)));
}

export function getDeviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Firefox\/|FxiOS/.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac OS X|Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Linux|CrOS/.test(ua)
              ? 'Linux'
              : 'device';
  return `${browser} on ${os}`;
}

let lease: BotLease | null = null;

function parseLease(raw: unknown): BotLease | null {
  const r = raw as Partial<BotLease> | null | undefined;
  if (!r || typeof r.runnerId !== 'string' || typeof r.at !== 'string') return null;
  return { runnerId: r.runnerId, deviceLabel: String(r.deviceLabel || 'another device'), at: r.at };
}

function isFresh(l: BotLease | null, nowMs: number): l is BotLease {
  if (!l) return false;
  const ms = Date.parse(l.at);
  return Number.isFinite(ms) && nowMs - ms < LEASE_TTL_MS;
}

export function getBotLeaseState(nowMs: number = Date.now()): BotLeaseState {
  const active = isFresh(lease, nowMs);
  return {
    active,
    mine: active && lease!.runnerId === getRunnerId(),
    holderLabel: active ? lease!.deviceLabel : null,
    at: active ? lease!.at : null,
  };
}

/** Called with `botLease` from every Firestore snapshot so the UI always knows who is running the bot. */
export function setBotLeaseFromCloud(raw: unknown) {
  const next = parseLease(raw);
  const same = (next?.runnerId ?? null) === (lease?.runnerId ?? null) && (next?.at ?? null) === (lease?.at ?? null);
  lease = next;
  if (!same) {
    try {
      window.dispatchEvent(new Event(LEASE_EVENT));
    } catch {}
  }
}

export function clearBotLeaseState() {
  setBotLeaseFromCloud(null);
}

export interface ClaimResult {
  ok: boolean;
  holderLabel?: string;
  /** Signed out / no cloud session: nothing to coordinate with, this device just runs the bot. */
  local?: boolean;
  error?: string;
}

/**
 * Take (or renew) the lease. Succeeds when nobody holds it, the holder let it expire, this tab already
 * holds it, or `force` is set (the "run bot on this device" button).
 * If Firestore can't be reached we fail CLOSED: skipping one bot minute is cheap, a double bid is not.
 */
export async function claimBotLease(opts: { force?: boolean } = {}): Promise<ClaimResult> {
  const user = getCustomUser();
  if (!user?.uid || !auth.currentUser) return { ok: true, local: true };
  const me = getRunnerId();
  try {
    const result = await runTransaction(db, async (tx) => {
      const ref = watchDocRef(user.uid);
      const snap = await tx.get(ref);
      const current = parseLease(snap.exists() ? (snap.data() as any).botLease : null);
      const now = Date.now();
      if (isFresh(current, now) && current.runnerId !== me && !opts.force) {
        return { ok: false as const, lease: current };
      }
      const next: BotLease = { runnerId: me, deviceLabel: getDeviceLabel(), at: new Date(now).toISOString() };
      tx.set(ref, { botLease: next }, { merge: true });
      return { ok: true as const, lease: next };
    });
    setBotLeaseFromCloud(result.lease);
    return { ok: result.ok, holderLabel: result.lease.deviceLabel };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e || 'Could not reach cloud to coordinate the bot').slice(0, 160) };
  }
}
