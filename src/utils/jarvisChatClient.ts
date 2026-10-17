/**
 * Shared Jarvis OpenRouter call with server fallback.
 * Used by GameDetailView (fixtures) — same pattern as main AICoach tab.
 */
export async function callJarvisOpenRouter(opts: {
  message: string;
  context: string;
  systemPrompt?: string;
  model?: string;
  openRouterApiKey?: string;
}): Promise<string> {
  const activeOpenRouterKey =
    opts.openRouterApiKey ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('bt_openrouter_api_key') || '' : '');
  const activeModel =
    opts.model ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('bt_llm_model') || '' : '') ||
    'anthropic/claude-3.5-sonnet';

  if (!activeOpenRouterKey) {
    throw new Error(
      'OpenRouter API key required. Add it in Jarvis settings (page footer or More \u2192 Jarvis Settings).'
    );
  }

  let reply = '';
  let useClientFallback = false;

  try {
    const response = await fetch('/api/coach-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: opts.message,
        context: opts.context,
        model: activeModel,
        openRouterApiKey: activeOpenRouterKey,
      }),
    });
    const contentType = response.headers.get('content-type') || '';
    if (response.status === 404 || contentType.includes('text/html')) {
      useClientFallback = true;
    } else {
      const data = await response.json().catch(() => ({}));
      if (data.success && data.reply) reply = data.reply;
      else useClientFallback = true;
    }
  } catch {
    useClientFallback = true;
  }

  if (useClientFallback || !reply) {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeOpenRouterKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://battrickiq.app',
        'X-Title': 'BattrickIQ Match Jarvis',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [
          {
            role: 'system',
            content:
              opts.systemPrompt ||
              'You are Coach Jarvis for Battrick cricket management. Give concrete match tactics: XI, effort (TIE/PAN/GFI), bowling plans, and targets. Be concise and decisive.',
          },
          {
            role: 'user',
            content: `[MATCH BRIEFING]:\n${opts.context}\n\n[MANAGER QUESTION]:\n${opts.message}`,
          },
        ],
      }),
    });
    if (!orRes.ok) {
      const errData = await orRes.json().catch(() => ({}));
      throw new Error(errData.error?.message || `OpenRouter HTTP ${orRes.status}`);
    }
    const orData = await orRes.json();
    reply = orData.choices?.[0]?.message?.content || '';
    if (!reply) throw new Error('Empty response from OpenRouter.');
  }

  return reply;
}
