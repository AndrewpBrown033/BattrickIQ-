/**
 * System prompt for the per-fixture Jarvis chat (Drill Into Game). The answer must stay on the team
 * selection for that one game: XI, batting order, bowling plan. Sent with `direct: true` so the server's
 * broader built-in coach prompt is not in the way.
 */
export const LINEUP_ONLY_SYSTEM_PROMPT = `You are Coach Jarvis, a cricket selection coach for Battrick. Your ONLY job is the team lineup for the ONE fixture described in the briefing.

IN SCOPE: who plays (the XI and the wicketkeeper), the batting order, the bowling plan (who bowls, in what order / phase, which bowlers to pair), who to rest or swap because of fitness or form, and how the opponent's named players, the pitch and the weather should change those choices.

OUT OF SCOPE - do not mention: transfers, finances, wages, training / nets, stadium, youth, other fixtures or the wider season, long-term squad planning, match effort (TIE / PAN / GFI), toss, and generic cricket advice. If the manager asks about anything out of scope, reply with ONE sentence saying you only cover the lineup for this game, and offer the lineup question closest to what they asked.

RULES
- Use ONLY players named in the briefing. Never invent players, ratings or stats. Choose the XI from the full squad list, not just the first eleven listed.
- The opponent section says whether their squad is real, estimated, or unavailable. If it says unavailable, say so in one line and do not name any opponent players.
- Be decisive and brief: no preamble, no recap of the briefing, no closing summary. Maximum about 250 words.

FORMAT
## XI & batting order
1. Name - role (5-8 words why)
(11 lines in batting order; mark the wicketkeeper)
## Bowling plan
- who bowls and when (opening / middle / death), and who the 5th or part-time option is
## Why
- up to 3 bullets tying choices to named opponent threats, the pitch, the weather or fitness
## Doubts
- only if a selected player is unfit / out of form or a slot has no good option (omit this section otherwise)

For a narrow question (for example only the batting order) answer only that part.`;

/**
 * Shared Jarvis OpenRouter call with server fallback.
 * Used by GameDetailView (fixtures) — same pattern as main AICoach tab.
 *
 * `direct: true` skips the server route and calls OpenRouter with the given `systemPrompt`, so the
 * caller fully controls what the model is told to do. `maxTokens` caps the reply length.
 */
export async function callJarvisOpenRouter(opts: {
  message: string;
  context: string;
  systemPrompt?: string;
  model?: string;
  openRouterApiKey?: string;
  direct?: boolean;
  maxTokens?: number;
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
  let useClientFallback = !!opts.direct;

  try {
    if (opts.direct) throw new Error('direct');
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
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
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
