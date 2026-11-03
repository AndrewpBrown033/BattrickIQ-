/** Run: npm run test:jarvisclient */
import assert from 'node:assert/strict';
import { callJarvisOpenRouter } from '../src/utils/jarvisChatClient';

let n = 0;
type Call = { url: string; body: any };
function stubFetch(handlers: Array<(url: string) => Response | Promise<Response> | never>): Call[] {
  const calls: Call[] = [];
  let i = 0;
  (globalThis as any).fetch = async (url: string, init: any) => {
    calls.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    return handlers[Math.min(i++, handlers.length - 1)](url);
  };
  return calls;
}
const json = (status: number, body: any) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const html = () => new Response('<html></html>', { status: 404, headers: { 'content-type': 'text/html' } });
const base = { message: 'Pick my XI', context: 'SQUAD...', systemPrompt: 'LINEUP ONLY', openRouterApiKey: 'sk-or-test', model: 'openai/gpt-4o' };
async function test(name: string, fn: () => Promise<void>) { await fn(); n++; console.log('  ok  ' + name); }

(async () => {
  await test('server route is tried first and the lineup instructions travel in the briefing', async () => {
    const calls = stubFetch([() => json(200, { success: true, reply: 'XI: ...' })]);
    const r = await callJarvisOpenRouter({ ...base, direct: true });
    assert.equal(r, 'XI: ...');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/coach-chat');
    assert.ok(calls[0].body.context.includes('LINEUP ONLY'));
    assert.ok(calls[0].body.context.includes('SQUAD...'));
  });
  await test('no API server behind the host (HTML) falls back to OpenRouter directly', async () => {
    const calls = stubFetch([() => html(), () => json(200, { choices: [{ message: { content: 'direct reply' } }] })]);
    assert.equal(await callJarvisOpenRouter(base), 'direct reply');
    assert.equal(calls[1].url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(calls[1].body.messages[0].content, 'LINEUP ONLY');
  });
  await test('server crash (5xx) falls back to direct', async () => {
    stubFetch([() => json(500, { success: false, error: 'boom' }), () => json(200, { choices: [{ message: { content: 'ok' } }] })]);
    assert.equal(await callJarvisOpenRouter(base), 'ok');
  });
  await test('network failure reaching the server falls back to direct', async () => {
    stubFetch([() => { throw new TypeError('Failed to fetch'); }, () => json(200, { choices: [{ message: { content: 'ok2' } }] })]);
    assert.equal(await callJarvisOpenRouter(base), 'ok2');
  });
  await test('a definite server verdict is reported, with no fallback', async () => {
    const calls = stubFetch([() => json(401, { success: false, error: 'No auth credentials found' })]);
    await assert.rejects(() => callJarvisOpenRouter(base), /API key/);
    assert.equal(calls.length, 1);
  });
  await test('unknown model from the server says so', async () => {
    stubFetch([() => json(404, { success: false, error: 'No endpoints found for foo/bar' })]);
    await assert.rejects(() => callJarvisOpenRouter({ ...base, model: 'foo/bar' }), /isn't available.*Jarvis Settings/);
  });
  await test('direct path unreachable gives a VPN / blocker hint', async () => {
    stubFetch([() => html(), () => { throw new TypeError('Failed to fetch'); }]);
    await assert.rejects(() => callJarvisOpenRouter(base), /Could not reach OpenRouter/);
  });
  await test('missing key is reported before any request', async () => {
    const calls = stubFetch([() => json(200, {})]);
    await assert.rejects(() => callJarvisOpenRouter({ ...base, openRouterApiKey: '' }), /API key required/);
    assert.equal(calls.length, 0);
  });
  console.log(`\n${n} scenarios passed`);
})();
