/**
 * Live OpenRouter model list for Jarvis Settings.
 *
 * GET https://openrouter.ai/api/v1/models is public (no API key) and returns
 *   { data: [{ id, name, description, context_length, created, pricing: { prompt, completion }, architecture: {...} }] }
 * Prices are strings in £/$ per token. The parser below is tolerant: a malformed entry is skipped, never thrown on.
 */

export interface OpenRouterModel {
  id: string;
  name: string;
  desc: string;
  free: boolean;
  contextLength?: number;
  /** unix seconds, used to sort newest first */
  created?: number;
  /** price per 1M input tokens in USD, when known */
  promptPerM?: number;
}

const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_KEY = 'bt_openrouter_models';
export const MODELS_STALE_MS = 24 * 3600 * 1000;

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function parseOpenRouterModels(json: unknown): OpenRouterModel[] {
  const list = (json as any)?.data;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: OpenRouterModel[] = [];
  for (const m of list) {
    const id = typeof m?.id === 'string' ? m.id.trim() : '';
    if (!id || seen.has(id)) continue;
    // Jarvis needs text replies: skip models that don't output text (image generators etc.) when stated.
    const outs = m?.architecture?.output_modalities;
    if (Array.isArray(outs) && outs.length && !outs.includes('text')) continue;
    seen.add(id);
    const p = num(m?.pricing?.prompt);
    const c = num(m?.pricing?.completion);
    const free = id.endsWith(':free') || (p === 0 && c === 0) || id === 'openrouter/free';
    const desc = String(m?.description || '').replace(/\s+/g, ' ').trim();
    out.push({
      id,
      name: String(m?.name || id).trim(),
      desc: desc.length > 140 ? desc.slice(0, 137).trimEnd() + '…' : desc,
      free,
      contextLength: num(m?.context_length),
      created: num(m?.created),
      promptPerM: p !== undefined ? p * 1_000_000 : undefined,
    });
  }
  return out;
}

export async function fetchOpenRouterModels(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 15000
): Promise<OpenRouterModel[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(MODELS_URL, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`OpenRouter answered HTTP ${res.status}`);
    const models = parseOpenRouterModels(await res.json());
    if (!models.length) throw new Error('OpenRouter returned no models');
    return models;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('OpenRouter took too long to answer');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export interface ModelCache {
  at: number;
  models: OpenRouterModel[];
}

export function loadModelCache(storage: Pick<Storage, 'getItem'> = localStorage): ModelCache | null {
  try {
    const c = JSON.parse(storage.getItem(CACHE_KEY) || 'null');
    return c && typeof c.at === 'number' && Array.isArray(c.models) && c.models.length ? c : null;
  } catch {
    return null;
  }
}

export function saveModelCache(models: OpenRouterModel[], storage: Pick<Storage, 'setItem'> = localStorage, at = Date.now()) {
  try {
    storage.setItem(CACHE_KEY, JSON.stringify({ at, models } satisfies ModelCache));
  } catch {
    /* quota / private mode: the list just won't persist */
  }
}

export const isStale = (c: ModelCache | null, now = Date.now()) => !c || now - c.at > MODELS_STALE_MS;

/** Case-insensitive match on name or id; every word typed must appear. */
export function searchModels<T extends { id: string; name: string }>(models: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return models;
  return models.filter((m) => {
    const hay = (m.name + ' ' + m.id).toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/**
 * The list to show: the live list (newest first) with the curated picks pinned on top. A curated pick that
 * OpenRouter no longer lists is dropped once we have a live list, so retired models stop being offered.
 */
export function buildModelList<C extends { id: string }>(
  curated: (C & Partial<OpenRouterModel>)[],
  live: OpenRouterModel[] | null
): (OpenRouterModel & { curated?: boolean })[] {
  if (!live || !live.length) {
    return curated.map((c) => ({ name: c.id, desc: '', free: false, ...c, curated: true })) as any;
  }
  const byId = new Map(live.map((m) => [m.id, m]));
  const pinned = curated
    .filter((c) => byId.has(c.id))
    .map((c) => ({ ...byId.get(c.id)!, name: (c as any).name || byId.get(c.id)!.name, desc: (c as any).desc || byId.get(c.id)!.desc, curated: true }));
  const pinnedIds = new Set(pinned.map((p) => p.id));
  const rest = live.filter((m) => !pinnedIds.has(m.id)).sort((a, b) => (b.created || 0) - (a.created || 0));
  return [...pinned, ...rest];
}
