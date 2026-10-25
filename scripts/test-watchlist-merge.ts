/**
 * Scenario tests for the Transfer Watch cross-device merge. Run: npm run test:watch-merge
 * (plain node:assert, no test framework in this repo)
 */
import assert from 'node:assert/strict';
import {
  mergeWatchState,
  stampLocalChanges,
  sameState,
  type WatchState,
} from '../src/utils/watchlistMerge';
import type { WatchEntry } from '../src/utils/transferWatchlist';

const NOW = Date.parse('2026-10-25T10:00:00.000Z');
const iso = (mins: number) => new Date(NOW + mins * 60_000).toISOString();

const entry = (id: string, over: Partial<WatchEntry> & { intentAt?: string } = {}): WatchEntry =>
  ({
    playerId: id,
    name: `Player ${id}`,
    addedAt: iso(-100),
    updatedAt: iso(-100),
    reason: 'test',
    lastCost: 50_000,
    status: 'listed',
    ...over,
  }) as WatchEntry;

const empty = (): WatchState => ({ items: [], removed: {} });
const ids = (s: WatchState) => s.items.map((w) => w.playerId).sort();

let n = 0;
function test(name: string, fn: () => void) {
  fn();
  n++;
  console.log('  ok  ' + name);
}

test('union of two devices keeps both players', () => {
  const phone = { items: [entry('1')], removed: {} };
  const laptop = { items: [entry('2')], removed: {} };
  assert.deepEqual(ids(mergeWatchState(phone, laptop, NOW)), ['1', '2']);
});

test('merge is commutative and idempotent', () => {
  const a = { items: [entry('1', { updatedAt: iso(-5), lastCost: 1 }), entry('2')], removed: { '9': iso(-3) } };
  const b = { items: [entry('1', { updatedAt: iso(-4), lastCost: 2 }), entry('3')], removed: {} };
  const ab = mergeWatchState(a, b, NOW);
  const ba = mergeWatchState(b, a, NOW);
  assert.ok(sameState(ab, ba));
  assert.ok(sameState(mergeWatchState(ab, ab, NOW), ab));
  assert.equal(ab.items.find((w) => w.playerId === '1')!.lastCost, 2); // newer edit wins
});

test('REMOVAL propagates: removed on phone, still in cloud -> gone after merge', () => {
  const cloud = { items: [entry('1'), entry('2')], removed: {} };
  // phone removes player 1 through the normal save path
  const phoneBefore = { items: [entry('1'), entry('2')], removed: {} };
  const phoneAfter = stampLocalChanges(phoneBefore, [entry('2')], iso(0));
  assert.deepEqual(Object.keys(phoneAfter.removed), ['1']);
  const merged = mergeWatchState(cloud, phoneAfter, NOW);
  assert.deepEqual(ids(merged), ['2']);
  assert.ok(merged.removed['1']); // kept so other devices learn about it
});

test('a stale device refreshing prices cannot resurrect a removed player', () => {
  const removed = { '1': iso(0) };
  // laptop (hasn't synced yet) refreshes player 1 AFTER the removal: updatedAt newer, addedAt old
  const laptop = { items: [entry('1', { updatedAt: iso(1) })], removed: {} };
  const merged = mergeWatchState({ items: [], removed }, laptop, NOW);
  assert.deepEqual(ids(merged), []);
});

test('re-adding a removed player brings them back and spends the tombstone', () => {
  const cloud = { items: [], removed: { '1': iso(0) } };
  const readded = { items: [entry('1', { addedAt: iso(5), updatedAt: iso(5) })], removed: {} };
  const merged = mergeWatchState(cloud, readded, NOW);
  assert.deepEqual(ids(merged), ['1']);
  assert.equal(merged.removed['1'], undefined);
});

test('arming the bot on one device survives a later price refresh on a stale device', () => {
  // phone arms (intentAt t=10), laptop (stale) then refreshes prices (updatedAt t=11, bot off)
  const phone = { items: [entry('1', { botEnabled: true, maxBid: 120_000, updatedAt: iso(10), intentAt: iso(10) } as any)], removed: {} };
  // The stale laptop still holds an explicit `botEnabled: false` from before (a missing key would hide the bug).
  const laptop = { items: [entry('1', { botEnabled: false, maxBid: 50_000, lastCost: 70_000, updatedAt: iso(11) })], removed: {} };
  const merged = mergeWatchState(phone, laptop, NOW).items[0];
  assert.equal(merged.botEnabled, true);
  assert.equal(merged.maxBid, 120_000);
  assert.equal(merged.lastCost, 70_000); // fresh price data still taken from the newer refresh
});

test('disarming on one device beats an older armed copy elsewhere', () => {
  const armed = { items: [entry('1', { botEnabled: true, maxBid: 90_000, updatedAt: iso(5), intentAt: iso(5) } as any)], removed: {} };
  const disarmed = { items: [entry('1', { botEnabled: false, maxBid: 90_000, updatedAt: iso(8), intentAt: iso(8) } as any)], removed: {} };
  assert.equal(mergeWatchState(armed, disarmed, NOW).items[0].botEnabled, false);
  assert.equal(mergeWatchState(disarmed, armed, NOW).items[0].botEnabled, false);
});

test('stampLocalChanges bumps updatedAt/intentAt only when something really changed', () => {
  const before = { items: [entry('1', { botEnabled: false })], removed: {} };
  const same = stampLocalChanges(before, [entry('1', { botEnabled: false })], iso(30));
  assert.equal(same.items[0].updatedAt, iso(-100));
  const armed = stampLocalChanges(before, [entry('1', { botEnabled: true, maxBid: 80_000 })], iso(30));
  assert.equal(armed.items[0].updatedAt, iso(30));
  assert.equal((armed.items[0] as any).intentAt, iso(30));
  const priceOnly = stampLocalChanges(armed, [{ ...armed.items[0], lastCost: 1 }], iso(40));
  assert.equal(priceOnly.items[0].updatedAt, iso(40));
  assert.equal((priceOnly.items[0] as any).intentAt, iso(30)); // intent clock untouched by price refresh
});

test('old tombstones are pruned', () => {
  const old = { items: [], removed: { '1': new Date(NOW - 50 * 24 * 3600 * 1000).toISOString() } };
  assert.deepEqual(mergeWatchState(old, empty(), NOW).removed, {});
});

test('tolerates junk entries and missing fields', () => {
  const junk: any = { items: [null, {}, { playerId: 7, name: 'x' }], removed: undefined };
  assert.deepEqual(ids(mergeWatchState(junk, empty(), NOW)), ['7']);
});

console.log(`\n${n} scenarios passed`);
