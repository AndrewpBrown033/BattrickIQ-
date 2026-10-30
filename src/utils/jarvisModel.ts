/**
 * Jarvis model selection. Anthropic retired the Claude 3.x Sonnet / 3 Opus / Sonnet 4 API models, so a request
 * naming one of them fails with a model-unavailable error from OpenRouter. The old default
 * (anthropic/claude-3.5-sonnet) is also what many users still have SAVED in Jarvis Settings, so a saved retired
 * id is swapped for the current default instead of silently failing every call.
 */
export const DEFAULT_JARVIS_MODEL = 'anthropic/claude-sonnet-4.6';

const RETIRED_MODELS = new Set([
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.5-sonnet:beta',
  'anthropic/claude-3-5-sonnet',
  'anthropic/claude-3.7-sonnet',
  'anthropic/claude-3.7-sonnet:thinking',
  'anthropic/claude-3-sonnet',
  'anthropic/claude-3-opus',
  'anthropic/claude-sonnet-4',
]);

export function isRetiredJarvisModel(id?: string | null): boolean {
  return RETIRED_MODELS.has(String(id || '').trim().toLowerCase());
}

/** The model id to actually send: the saved one, unless empty or retired. */
export function resolveJarvisModel(id?: string | null): string {
  const m = String(id || '').trim();
  return !m || isRetiredJarvisModel(m) ? DEFAULT_JARVIS_MODEL : m;
}
