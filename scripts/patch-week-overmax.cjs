/**
 * Ensure ThisWeekUpdatesCard flags over-max bids and fires browser alert/notification.
 * Idempotent surgical patch if full card already has older version.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'src', 'components', 'ThisWeekUpdatesCard.tsx');
if (!fs.existsSync(file)) {
  console.warn('[patch-week-overmax] ThisWeekUpdatesCard missing');
  process.exit(0);
}
let t = fs.readFileSync(file, 'utf8');
if (t.includes('notifyBidOverMax') && t.includes('overmax-')) {
  console.log('[patch-week-overmax] already present');
  process.exit(0);
}

if (!t.includes("from '../utils/bidBot'")) {
  if (t.includes("from '../lib/navigation';")) {
    t = t.replace(
      "import { navigateTo } from '../lib/navigation';",
      "import { navigateTo } from '../lib/navigation';\nimport { nextExpectedBid } from '../utils/bidBot';"
    );
  }
}

const helpers = `
const OVERMAX_NOTIFIED_KEY = 'bt_watch_overmax_notified';

function loadNotifiedIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(OVERMAX_NOTIFIED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function markNotified(id: string) {
  const set = loadNotifiedIds();
  set.add(String(id));
  try {
    sessionStorage.setItem(OVERMAX_NOTIFIED_KEY, JSON.stringify([...set]));
  } catch {}
}

function isOverMax(w: WatchEntry): { over: boolean; next: number; max: number } {
  const max = Math.round(Number(w.maxBid) || 0);
  if (max < 1000) return { over: false, next: 0, max: 0 };
  const next = nextExpectedBid(w.lastCurrentBid, w.lastAskingPrice);
  const over =
    w.botStatus === 'maxed' ||
    (next > 0 && next > max) ||
    !!(w.lastBotAction && /exceeds your max/i.test(w.lastBotAction || ''));
  return { over, next, max };
}

async function notifyBidOverMax(w: WatchEntry, next: number, max: number) {
  const id = String(w.playerId);
  if (loadNotifiedIds().has(id)) return;
  markNotified(id);
  const title = 'Transfer Watch — over max';
  const body = w.name + ': next bid £' + next.toLocaleString() + ' exceeds your max £' + max.toLocaleString();
  try {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm === 'granted') {
        const n = new Notification(title, { body, tag: 'bt-overmax-' + id, requireInteraction: true });
        n.onclick = () => { try { window.focus(); } catch {} n.close(); };
      }
    }
  } catch {}
  try {
    window.alert(title + '\\n\\n' + body);
  } catch {}
}
`;

if (!t.includes('function isOverMax')) {
  const end = t.indexOf('function toneClass');
  if (end > 0) {
    t = t.slice(0, end) + helpers + '\n' + t.slice(end);
    console.log('[patch-week-overmax] helpers');
  }
}

if (!t.includes('overmax-')) {
  const loop = "for (const w of watchlist) {\n      if (w.status === 'sold') continue;\n      const cd = getDeadlineCountdown";
  const block = `for (const w of watchlist) {
      if (w.status === 'sold') continue;
      const om = isOverMax(w);
      if (om.over) {
        out.push({
          id: 'overmax-' + w.playerId,
          kind: 'alert',
          title: w.name + ': over max bid',
          detail: 'Next expected £' + om.next.toLocaleString() + ' exceeds max £' + om.max.toLocaleString(),
          tone: 'critical',
          tab: 'watch',
        });
      }
    }

    for (const w of watchlist) {
      if (w.status === 'sold') continue;
      const cd = getDeadlineCountdown`;
  if (t.includes(loop)) {
    t = t.replace(loop, block);
    console.log('[patch-week-overmax] list items');
  }
}

if (!t.includes('void notifyBidOverMax')) {
  const marker = `  useEffect(() => {
    reload();
    const on = () => reload();
    window.addEventListener('storage', on);
    window.addEventListener('bt_transfer_watchlist_changed', on);
    window.addEventListener('bt_transfer_alerts_changed', on);
    const tick = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => {
      window.removeEventListener('storage', on);
      window.removeEventListener('bt_transfer_watchlist_changed', on);
      window.removeEventListener('bt_transfer_alerts_changed', on);
      window.clearInterval(tick);
    };
  }, []);`;
  const effect = marker + `

  useEffect(() => {
    for (const w of watchlist) {
      if (w.status === 'sold') continue;
      const { over, next, max } = isOverMax(w);
      if (over && next > 0) void notifyBidOverMax(w, next, max);
    }
  }, [watchlist]);
`;
  if (t.includes(marker)) {
    t = t.replace(marker, effect);
    console.log('[patch-week-overmax] notify effect');
  }
}

fs.writeFileSync(file, t);
console.log('[patch-week-overmax] done', t.length);
