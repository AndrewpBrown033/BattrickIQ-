/** Run: npm run test:jarvismodel */
import assert from 'node:assert/strict';
import { describeOpenRouterError } from '../src/utils/jarvisChatClient';
import { resolveJarvisModel, isRetiredJarvisModel, DEFAULT_JARVIS_MODEL } from '../src/utils/jarvisModel';
let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log('  ok  ' + name); }
test('empty falls back to the current default', () => {
  assert.equal(resolveJarvisModel(''), DEFAULT_JARVIS_MODEL);
  assert.equal(resolveJarvisModel(null), DEFAULT_JARVIS_MODEL);
});
test('a saved retired model is replaced', () => {
  assert.equal(resolveJarvisModel('anthropic/claude-3.5-sonnet'), DEFAULT_JARVIS_MODEL);
  assert.equal(resolveJarvisModel(' Anthropic/Claude-3.7-Sonnet '), DEFAULT_JARVIS_MODEL);
  assert.ok(isRetiredJarvisModel('anthropic/claude-3-opus'));
});
test('a current or non-Anthropic model is kept as chosen', () => {
  assert.equal(resolveJarvisModel('openai/gpt-4o'), 'openai/gpt-4o');
  assert.equal(resolveJarvisModel('openrouter/free'), 'openrouter/free');
  assert.equal(resolveJarvisModel('anthropic/claude-sonnet-4.6'), 'anthropic/claude-sonnet-4.6');
});
test('OpenRouter errors are explained', () => {
  assert.match(describeOpenRouterError(404, 'No endpoints found for x', 'x'), /isn't available.*Jarvis Settings/);
  assert.match(describeOpenRouterError(401, 'bad key', 'x'), /API key/);
  assert.match(describeOpenRouterError(402, 'credits', 'x'), /credits/);
  assert.equal(describeOpenRouterError(500, 'boom', 'x'), 'boom');
});
console.log(`\n${n} scenarios passed`);
