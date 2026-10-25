/**
 * Two-device simulation of Transfer Watch cloud sync. Run: npm run test:watch-sync
 *
 * Bundles the REAL src/utils/transferWatchlist.ts + watchBotLease.ts once per "device" with esbuild,
 * swapping only firebase/firestore, lib/firebase and lib/customAuth for an in-memory fake Firestore that
 * both devices share. Each device runs in its own vm context (own localStorage, own module state), like
 * two browsers on the same account.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- shared fake Firestore ----------------------------------------------------------
const host = {
  docs: new Map(), // path -> data
  listeners: new Map(), // path -> Set<fn>
  writes: 0,
  offline: false,
  queue: Promise.resolve(),
};
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const snapOf = (p) => ({
  exists: () => host.docs.has(p),
  data: () => clone(host.docs.get(p)),
  metadata: { hasPendingWrites: false, fromCache: false },
});
function commit(p, data, merge) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) throw new Error(`Firestore rejects undefined field "${k}"`);
  }
  host.docs.set(p, merge ? { ...(host.docs.get(p) || {}), ...clone(data) } : clone(data));
  host.writes++;
  for (const fn of host.listeners.get(p) || []) setTimeout(() => fn(snapOf(p)), 0);
}
host.api = {
  doc: (_db, ...segs) => ({ path: segs.join('/') }),
  onSnapshot(ref, next) {
    const set = host.listeners.get(ref.path) || new Set();
    host.listeners.set(ref.path, set);
    set.add(next);
    setTimeout(() => next(snapOf(ref.path)), 0);
    return () => set.delete(next);
  },
  runTransaction(_db, fn) {
    // Transactions are serialized: the strongest guarantee Firestore gives, which is what we rely on.
    const run = host.queue.then(async () => {
      if (host.offline) throw new Error('Failed to get document because the client is offline.');
      const pending = [];
      const tx = {
        get: async (ref) => snapOf(ref.path),
        set: (ref, data, opts) => pending.push([ref.path, data, !!opts?.merge]),
      };
      const result = await fn(tx);
      for (const [p, d, m] of pending) commit(p, d, m);
      return result;
    });
    host.queue = run.catch(() => {});
    return run;
  },
};
globalThis.__host = host;

// ---------- bundle the real modules against the fakes ---------------------------------------
const fakes = {
  'firebase/firestore': `const h = globalThis.__host.api; export const doc = h.doc, onSnapshot = h.onSnapshot, runTransaction = h.runTransaction;`,
  firebaseLib: `export const auth = { currentUser: { uid: 'fb' } }; export const db = {};`,
  customAuth: `export const getCustomUser = () => ({ uid: 'u1', email: 'a@b.c' });`,
};
const fakePlugin = {
  name: 'fakes',
  setup(b) {
    b.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firebase/firestore', namespace: 'fake' }));
    b.onResolve({ filter: /lib\/firebase$/ }, () => ({ path: 'firebaseLib', namespace: 'fake' }));
    b.onResolve({ filter: /lib\/customAuth$/ }, () => ({ path: 'customAuth', namespace: 'fake' }));
    b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({ contents: fakes[a.path], loader: 'js' }));
  },
};
const bundle = await build({
  stdin: {
    resolveDir: root,
    contents: `
      import * as wl from './src/utils/transferWatchlist';
      import * as lease from './src/utils/watchBotLease';
      globalThis.api = { ...wl, ...lease };`,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  plugins: [fakePlugin],
  logLevel: 'error',
});
const code = bundle.outputFiles[0].text;

function makeDevice(name, userAgent) {
  const store = new Map();
  const session = new Map();
  const mk = (m) => ({
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  });
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = 'visible';
  Object.assign(win, {
    localStorage: mk(store),
    sessionStorage: mk(session),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    document: doc,
  });
  const ctx = vm.createContext({
    __host: host,
    window: win,
    document: doc,
    localStorage: win.localStorage,
    sessionStorage: win.sessionStorage,
    navigator: { userAgent },
    crypto: globalThis.crypto,
    console,
    Event,
    EventTarget,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Promise,
    JSON,
    Date,
    Intl,
    Math,
    Object,
    Array,
    Map,
    Set,
    Error,
    Number,
    String,
    isFinite,
  });
  ctx.globalThis = ctx;
  vm.runInContext(code, ctx);
  const api = ctx.api;
  const ids = () => api.loadWatchlist().map((w) => w.playerId).sort();
  return { name, api, ids, store, ctx };
}

const CHROME_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';
const SAFARI_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
const laptop = makeDevice('laptop', CHROME_WIN);
const phone = makeDevice('phone', SAFARI_IPHONE);

let n = 0;
async function test(name, fn) {
  await fn();
  n++;
  console.log('  ok  ' + name);
}
const player = (id) => ({ playerId: id, name: `Player ${id}`, reason: 'sim' });

const stopLaptop = laptop.api.startWatchlistLiveSync('u1');
const stopPhone = phone.api.startWatchlistLiveSync('u1');
await sleep(300);

await test('player added on the laptop appears on the phone without any action', async () => {
  laptop.api.addToWatchlist(player('1001'));
  await sleep(900);
  assert.deepEqual(phone.ids(), ['1001']);
});

await test('player added on the phone appears on the laptop', async () => {
  phone.api.addToWatchlist(player('1002'));
  await sleep(900);
  assert.deepEqual(laptop.ids(), ['1001', '1002']);
});

await test('REMOVAL on the phone removes it on the laptop and it stays removed', async () => {
  phone.api.removeFromWatchlist('1001');
  await sleep(900);
  assert.deepEqual(laptop.ids(), ['1002']);
  await laptop.api.syncWatchlistFromCloud();
  await phone.api.syncWatchlistFromCloud();
  await sleep(500);
  assert.deepEqual(laptop.ids(), ['1002']);
  assert.deepEqual(phone.ids(), ['1002']);
});

let staleLaptopCopy; // what the laptop had BEFORE the phone armed the bot (as if it was asleep)
await test('arming the bot on the phone arms it on the laptop (max bid carried too)', async () => {
  // Realistic history: the bot was armed and then stopped earlier, so both devices hold an explicit `false`.
  phone.api.saveWatchlist(
    phone.api.loadWatchlist().map((w) => (w.playerId === '1002' ? { ...w, botEnabled: false, maxBid: 60000 } : w))
  );
  await sleep(900);
  assert.equal(laptop.api.loadWatchlist().find((x) => x.playerId === '1002').botEnabled, false);
  staleLaptopCopy = laptop.store.get('bt_transfer_watchlist');
  const list = phone.api.loadWatchlist().map((w) => (w.playerId === '1002' ? { ...w, botEnabled: true, maxBid: 150000 } : w));
  phone.api.saveWatchlist(list);
  await sleep(900);
  const w = laptop.api.loadWatchlist().find((x) => x.playerId === '1002');
  assert.equal(w.botEnabled, true);
  assert.equal(w.maxBid, 150000);
});

await test('a laptop that missed the arming (asleep) then refreshes prices does NOT undo it', async () => {
  // Put the laptop back to its stale pre-arming state, then do an automatic price refresh from there.
  laptop.store.set('bt_transfer_watchlist', staleLaptopCopy);
  assert.equal(laptop.api.loadWatchlist().find((x) => x.playerId === '1002').botEnabled, false);
  const list = laptop.api.loadWatchlist().map((w) => (w.playerId === '1002' ? { ...w, lastCurrentBid: 80000, lastCost: 80000 } : w));
  laptop.api.saveWatchlist(list); // newer updatedAt than the phone's arming
  await sleep(1200);
  for (const dev of [phone, laptop]) {
    const w = dev.api.loadWatchlist().find((x) => x.playerId === '1002');
    assert.equal(w.botEnabled, true, `${dev.name}: arming was lost`);
    assert.equal(w.maxBid, 150000, `${dev.name}: max bid was lost`);
    assert.equal(w.lastCurrentBid, 80000, `${dev.name}: fresh price from the refresh was lost`);
  }
});

await test('only one device may run the bot: lease, refusal, takeover', async () => {
  const a = await laptop.api.claimBotLease();
  assert.equal(a.ok, true);
  const b = await phone.api.claimBotLease();
  assert.equal(b.ok, false);
  assert.match(b.holderLabel, /Chrome on Windows/);
  const again = await laptop.api.claimBotLease(); // holder renews
  assert.equal(again.ok, true);
  const take = await phone.api.claimBotLease({ force: true });
  assert.equal(take.ok, true);
  const lost = await laptop.api.claimBotLease();
  assert.equal(lost.ok, false);
  assert.match(lost.holderLabel, /Safari on iPhone/);
  await sleep(200);
  assert.equal(laptop.api.getBotLeaseState().holderLabel, 'Safari on iPhone');
  assert.equal(phone.api.getBotLeaseState().mine, true);
});

await test('lease writes never disturb the list (and list syncs never steal the lease)', async () => {
  const before = host.docs.get('users/u1/settings/transferWatch').botLease.runnerId;
  laptop.api.addToWatchlist(player('1003'));
  await sleep(900);
  assert.equal(host.docs.get('users/u1/settings/transferWatch').botLease.runnerId, before);
  assert.deepEqual(phone.ids(), ['1002', '1003']);
});

await test('offline edits are kept and published when the connection returns', async () => {
  host.offline = true;
  laptop.api.addToWatchlist(player('1004'));
  await sleep(900);
  assert.deepEqual(phone.ids(), ['1002', '1003']); // phone can't know yet
  assert.ok(laptop.ids().includes('1004')); // laptop still shows it locally
  host.offline = false;
  await laptop.api.syncWatchlistFromCloud();
  await sleep(700);
  assert.deepEqual(phone.ids(), ['1002', '1003', '1004']);
});

await test('a burst of 25 edits is batched, and sync settles (no ping-pong between devices)', async () => {
  const w0 = host.writes;
  for (let i = 0; i < 25; i++) {
    const list = laptop.api.loadWatchlist().map((w) => (w.playerId === '1002' ? { ...w, lastCost: 90000 + i } : w));
    laptop.api.saveWatchlist(list);
  }
  await sleep(1500);
  const burstWrites = host.writes - w0;
  assert.ok(burstWrites <= 3, `expected <=3 cloud writes for a 25-edit burst, got ${burstWrites}`);
  const w1 = host.writes;
  await sleep(1500);
  assert.equal(host.writes, w1, 'cloud kept being written after everything had converged');
  assert.equal(phone.api.loadWatchlist().find((x) => x.playerId === '1002').lastCost, 90024);
});

await test('both devices and the cloud end up identical', async () => {
  const cloud = host.docs.get('users/u1/settings/transferWatch');
  const norm = (items) => JSON.stringify([...items].sort((a, b) => a.playerId.localeCompare(b.playerId)));
  assert.equal(norm(laptop.api.loadWatchlist()), norm(phone.api.loadWatchlist()));
  assert.equal(norm(cloud.items), norm(phone.api.loadWatchlist()));
});

stopLaptop();
stopPhone();
console.log(`\n${n} simulation scenarios passed`);
process.exit(0);
