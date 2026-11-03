/**
 * System prompt for the per-fixture Jarvis chat (Drill Into Game). The answer must stay on the team
 * selection for that one game: XI, batting order, bowling plan. It is also sent inside the briefing, because the
 * server route uses its own broader coach prompt.
 */
import { resolveJarvisModel } from './jarvisModel';
import { BATTRICK_MECHANICS_PROMPT } from './battrickKnowledge';
export const LINEUP_ONLY_SYSTEM_PROMPT = `You are Coach Jarvis, a cricket selection coach for Battrick. Your ONLY job is the team lineup for the ONE fixture described in the briefing.

IN SCOPE: who plays (the XI and the wicketkeeper), the batting order, the bowling plan (who bowls, in what order / phase, which bowlers to pair), who to rest or swap because of fitness or form, and how the opponent's named players, the pitch and the weather should change those choices.

OUT OF SCOPE - do not mention: transfers, finances, wages, training / nets, stadium, youth, other fixtures or the wider season, long-term squad planning, match effort (TIE / PAN / GFI), toss, and generic cricket advice. If the manager asks about anything out of scope, reply with ONE sentence saying you only cover the lineup for this game, and offer the lineup question closest to what they asked.

RULES
- Use ONLY players named in the briefing. Never invent players, ratings or stats. Choose the XI from the full squad list, not just the first eleven listed.
- The opponent section says whether their squad is real, estimated, or unavailable. If it says unavailable, say so in one line and do not name any opponent players.
- Use the PITCH / WEATHER effect numbers and each bowler's type in the briefing to choose the attack. Name the effect (for example "flat: fast -2, spin -2") rather than generic cricket talk.
- Be decisive and brief: no preamble, no recap of the briefing, no closing summary. Maximum about 330 words.

${BATTRICK_MECHANICS_PROMPT}

FORMAT
## XI & batting order
1. Name - role - order (5-8 words why)
(11 lines in batting order; mark the wicketkeeper; "order" is that batter's match order, one of: Very Defensive, Defensive, Normal, Attacking, Very Attacking - write the full name, use Normal unless there is a reason)
## Captain & keeper
- Captain: Name (leadership X, experience Y) - one line why. Keeper: Name - one line why.
## Bowling plan
- One Day: name ONE preset EXACTLY as written in the briefing's list, then B1..B5 as "B1 Name (type, order) - why this slot" using the full order names. BT20: B1..B5 for the fixed order. First Class: priority order and spell advice.
- Say who is the 5th or part-time option and why.
## Why
- up to 3 bullets tying choices to the pitch / weather numbers, named opponent threats or fitness
## Doubts
- only if a selected player is unfit / out of form or a slot has no good option (omit this section otherwise)

For a narrow question (for example only the batting order) answer only that part.`;

/**
 * Shared Jarvis OpenRouter call.
 *
 * The site routes /api/** to a server that talks to OpenRouter, which keeps working when the browser cannot
 * reach openrouter.ai itself (VPN, content blockers, restrictive networks). So the server route is ALWAYS tried
 * first. That server uses its own general coaching prompt, so a caller's `systemPrompt` is sent both as a field
 * and as a leading instruction block in the briefing, which keeps replies on-task (e.g. lineup only).
 * The browser calls OpenRouter directly only if the server route is missing or itself failing (HTML / network /
 * 5xx). A definite answer from the server (bad key, no credits, unknown model) is reported as-is.
 *
 * `direct` is kept for compatibility but no longer skips the server route. `maxTokens` caps the reply length.
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
  const activeModel = resolveJarvisModel(
    opts.model || (typeof localStorage !== 'undefined' ? localStorage.getItem('bt_llm_model') || '' : '')
  );

  if (!activeOpenRouterKey) {
    throw new Error(
      'OpenRouter API key required. Add it in Jarvis settings (page footer or More \u2192 Jarvis Settings).'
    );
  }

  const serverContext = opts.systemPrompt
    ? `[INSTRUCTIONS - follow these exactly; they override any general coaching role]\n${opts.systemPrompt}\n\n${opts.context}`
    : opts.context;

  let reply = '';
  let useClientFallback = false;
  let serverVerdict: Error | null = null; // a definite answer from the server (bad key, no credits, unknown model)

  try {
    const response = await fetch('/api/coach-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: opts.message,
        context: serverContext,
        model: activeModel,
        openRouterApiKey: activeOpenRouterKey,
        systemPrompt: opts.systemPrompt,
        maxTokens: opts.maxTokens,
      }),
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('json')) {
      useClientFallback = true; // no API server behind this host (HTML / 404 page)
    } else {
      const data: any = await response.json().catch(() => ({}));
      if (data.success && data.reply) {
        reply = data.reply;
      } else if (response.status >= 500 || !data.error) {
        useClientFallback = true; // the server itself had a problem: try OpenRouter directly
      } else {
        serverVerdict = new Error(describeOpenRouterError(response.status, String(data.error), activeModel));
      }
    }
  } catch {
    useClientFallback = true; // network failure reaching our own server: try OpenRouter directly
  }

  if (serverVerdict) throw serverVerdict;

  if (useClientFallback && !reply) {
    const orRes = await fetchOpenRouter('https://openrouter.ai/api/v1/chat/completions', {
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
      throw new Error(describeOpenRouterError(orRes.status, errData.error?.message, activeModel));
    }
    const orData = await orRes.json();
    reply = orData.choices?.[0]?.message?.content || '';
    if (!reply) throw new Error('Empty response from OpenRouter.');
  }

  return reply;
}

async function fetchOpenRouter(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error('Could not reach OpenRouter. A VPN, ad-blocker or network problem may be blocking openrouter.ai.');
  }
}

/** Turn an OpenRouter failure into something the manager can act on. */
export function describeOpenRouterError(status: number, message: string | undefined, model: string): string {
  const raw = (message || `OpenRouter HTTP ${status}`).trim();
  if (status === 401 || status === 403) return `OpenRouter rejected your API key (${raw}). Check it in Jarvis Settings.`;
  if (status === 402) return `OpenRouter says the account is out of credits (${raw}). Add credits or pick a free model in Jarvis Settings.`;
  if (status === 429) return `OpenRouter is rate-limiting this request (${raw}). Wait a moment and try again, or pick another model.`;
  if (status === 404 || /no endpoints|not a valid model|model.*(not found|unavailable|deprecated|retired)/i.test(raw)) {
    return `The model "${model}" isn't available on OpenRouter (${raw}). Pick another model in Jarvis Settings.`;
  }
  return raw;
}
