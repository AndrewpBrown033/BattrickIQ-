/** Run: npm run test:models */
import assert from 'node:assert/strict';
import { parseOpenRouterModels, fetchOpenRouterModels, searchModels, buildModelList, loadModelCache, saveModelCache, isStale, MODELS_STALE_MS } from '../src/utils/openrouterModels';

let n = 0; const test = async (name: string, fn: () => any) => { await fn(); n++; console.log('  ok  ' + name); };

const sample = { data: [
  { id: 'anthropic/claude-sonnet-4.6', name: 'Anthropic: Claude Sonnet 4.6', description: 'Great\n  reasoning   model. '.repeat(20), context_length: 200000, created: 1760000000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { output_modalities: ['text'] } },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (free)', context_length: 65536, created: 1750000000, pricing: { prompt: '0', completion: '0' } },
  { id: 'vendor/zero-priced', name: 'Zero priced', pricing: { prompt: '0', completion: '0' }, created: 1770000000 },
  { id: 'img/painter', name: 'Image only', architecture: { output_modalities: ['image'] }, pricing: { prompt: '0.1', completion: '0.1' } },
  { id: 'anthropic/claude-sonnet-4.6', name: 'dup' },
  { name: 'no id' }, null, 42, { id: '   ' },
  { id: 'weird/prices', name: 'Weird', pricing: { prompt: 'abc', completion: null } },
] };

(async () => {
  await test('parses good entries, skips malformed / duplicate / non-text models', () => {
    const m = parseOpenRouterModels(sample);
    assert.deepEqual(m.map((x) => x.id), ['anthropic/claude-sonnet-4.6', 'meta-llama/llama-3.3-70b-instruct:free', 'vendor/zero-priced', 'weird/prices']);
  });
  await test('free = :free suffix or zero price both ways; paid and unknown price are not free', () => {
    const f = Object.fromEntries(parseOpenRouterModels(sample).map((x) => [x.id, x.free]));
    assert.deepEqual(f, { 'anthropic/claude-sonnet-4.6': false, 'meta-llama/llama-3.3-70b-instruct:free': true, 'vendor/zero-priced': true, 'weird/prices': false });
  });
  await test('price per million, context and description are cleaned', () => {
    const m = parseOpenRouterModels(sample)[0];
    assert.equal(Math.round(m.promptPerM! * 100) / 100, 3);
    assert.equal(m.contextLength, 200000);
    assert.ok(m.desc.length <= 140 && !/\n/.test(m.desc));
  });
  await test('garbage input never throws', () => {
    for (const bad of [null, undefined, 5, 'x', {}, { data: 'no' }, { data: [] }]) assert.deepEqual(parseOpenRouterModels(bad), []);
  });
  await test('fetch: ok / http error / empty / network / timeout all behave', async () => {
    const ok = async () => ({ ok: true, json: async () => sample }) as any;
    assert.equal((await fetchOpenRouterModels(ok)).length, 4);
    await assert.rejects(fetchOpenRouterModels((async () => ({ ok: false, status: 503 })) as any), /HTTP 503/);
    await assert.rejects(fetchOpenRouterModels((async () => ({ ok: true, json: async () => ({ data: [] }) })) as any), /no models/);
    await assert.rejects(fetchOpenRouterModels((async () => { throw new TypeError('Failed to fetch'); }) as any), /Failed to fetch/);
    await assert.rejects(fetchOpenRouterModels(((_u: any, o: any) => new Promise((_r, rej) => o.signal.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' }))))) as any, 20), /too long/);
  });
  await test('search: every word must match name or id, case-insensitive', () => {
    const m = parseOpenRouterModels(sample);
    assert.deepEqual(searchModels(m, 'LLAMA free').map((x) => x.id), ['meta-llama/llama-3.3-70b-instruct:free']);
    assert.equal(searchModels(m, 'nothing here').length, 0);
    assert.equal(searchModels(m, '  ').length, m.length);
  });
  await test('list: curated pinned first, retired curated dropped once live list exists, rest newest first', () => {
    const live = parseOpenRouterModels(sample);
    const curated = [{ id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama (mine)', desc: 'my note' }, { id: 'old/retired', name: 'Retired', desc: '' }];
    const list = buildModelList(curated as any, live);
    assert.deepEqual(list.map((x) => x.id), ['meta-llama/llama-3.3-70b-instruct:free', 'vendor/zero-priced', 'anthropic/claude-sonnet-4.6', 'weird/prices']);
    assert.equal(list[0].name, 'Llama (mine)');
    assert.ok(!list.some((x) => x.id === 'old/retired'));
  });
  await test('no live list yet: the curated list is shown as-is', () => {
    assert.equal(buildModelList([{ id: 'a/b', name: 'A', desc: 'd', free: true } as any], null).length, 1);
  });
  await test('cache round-trips, rejects junk, goes stale after 24h', () => {
    const store: Record<string, string> = {};
    const s = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } };
    assert.equal(loadModelCache(s), null);
    saveModelCache(parseOpenRouterModels(sample), s, 1000);
    const c = loadModelCache(s)!; assert.equal(c.models.length, 4);
    assert.equal(isStale(c, 1000 + MODELS_STALE_MS - 1), false);
    assert.equal(isStale(c, 1000 + MODELS_STALE_MS + 1), true);
    store['bt_openrouter_models'] = '{bad'; assert.equal(loadModelCache(s), null);
  });
  console.log(`\n${n} scenarios passed`);
})();
