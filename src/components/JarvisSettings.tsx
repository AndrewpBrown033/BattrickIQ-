import React, { useState, useEffect } from 'react';
import { Cpu, ShieldCheck, Eye, EyeOff, Check, ExternalLink, Bot } from 'lucide-react';

export const OPENROUTER_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', desc: 'Top strategic reasoning & cricket tactics', free: false },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', desc: 'Fast, open-weights tactical LLM', free: false },
  { id: 'openai/gpt-4o', name: 'GPT-4o', desc: 'High capability multimodal reasoning', free: false },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', desc: 'Efficient, deep mathematical analysis', free: false },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (via OpenRouter)', desc: 'Ultra-low latency tactical responses', free: false },
  { id: 'mistralai/mistral-large-2407', name: 'Mistral Large', desc: 'Advanced European reasoning model', free: false },
  { id: 'openrouter/free', name: 'OpenRouter Free Router (Auto)', desc: 'Automatically picks a free model that fits your request', free: true },
  { id: 'nex-agi/nex-n2.5-pro:free', name: 'Nex-N2.5 Pro (Free)', desc: 'Strong agentic reasoning, good all-rounder for tactics', free: true },
  { id: 'nvidia/nemotron-3.5-lightning:free', name: 'NVIDIA Nemotron 3.5 Lightning (Free)', desc: 'Fast, lightweight, high-throughput responses', free: true },
  { id: 'poolside/laguna-s-2.1:free', name: 'Poolside Laguna S 2.1 (Free)', desc: 'Coding-agent model, solid structured analysis', free: true },
  { id: 'inclusionai/ling-3.0-flash-fin:free', name: 'Ling 3.0 Flash Fin (Free)', desc: 'Finance-tuned reasoning, good for budget/wage analysis', free: true },
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'NVIDIA Nemotron 3 Nano Omni (Free)', desc: 'Multimodal — can read pasted screenshots too', free: true },
  { id: 'liquid/lfm-2.5-2.6b:free', name: 'LiquidAI LFM2.5 2.6B (Free)', desc: 'Compact, quick answers for simple questions', free: true },
];

function notifyChanged() {
  try {
    window.dispatchEvent(new Event('bt_jarvis_settings_changed'));
  } catch {
    // ignore
  }
}

export default function JarvisSettings() {
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem('bt_llm_model') || 'anthropic/claude-3.5-sonnet');
  const [showFreeOnly, setShowFreeOnly] = useState(() => localStorage.getItem('bt_llm_free_only') === 'true');
  const [openRouterKey, setOpenRouterKey] = useState(() => localStorage.getItem('bt_openrouter_api_key') || '');
  const [showKey, setShowKey] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const flash = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
    notifyChanged();
  };

  const visibleModels = showFreeOnly ? OPENROUTER_MODELS.filter((m) => m.free) : OPENROUTER_MODELS;

  useEffect(() => {
    if (!visibleModels.some((m) => m.id === selectedModel) && visibleModels.length > 0) {
      setSelectedModel(visibleModels[0].id);
      localStorage.setItem('bt_llm_model', visibleModels[0].id);
      notifyChanged();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFreeOnly]);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Jarvis Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            OpenRouter API key and model for Coach Jarvis. These are stored only in this browser.
          </p>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block">LLM Provider</label>
        <div className="p-3 rounded-xl border border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold flex items-start gap-2.5">
          <Cpu className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-bold">OpenRouter</div>
            <div className="text-[11px] text-slate-500 font-normal mt-0.5">
              Claude, Llama, GPT-4o, DeepSeek, and free models — Jarvis runs exclusively on OpenRouter.
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-mono font-bold uppercase text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            OpenRouter API Key
          </label>
          {openRouterKey && (
            <button
              type="button"
              onClick={() => {
                setOpenRouterKey('');
                localStorage.removeItem('bt_openrouter_api_key');
                flash();
              }}
              className="text-[11px] font-mono text-rose-600 hover:text-rose-800 underline"
            >
              Clear key
            </button>
          )}
        </div>
        <p className="text-[12px] text-slate-500 leading-relaxed">
          Use your existing OpenRouter key. Stored in this browser only.
          Get a key at{' '}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 font-semibold underline inline-flex items-center gap-0.5"
          >
            openrouter.ai/keys <ExternalLink className="w-3 h-3" />
          </a>
          .
        </p>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={openRouterKey}
            onChange={(e) => {
              const val = e.target.value.trim();
              setOpenRouterKey(val);
              if (val) localStorage.setItem('bt_openrouter_api_key', val);
              else localStorage.removeItem('bt_openrouter_api_key');
              flash();
            }}
            placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full text-sm font-mono p-3 pr-11 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {openRouterKey && (
          <p className="text-[11px] font-mono text-slate-400">
            Saved: {showKey ? openRouterKey : `${openRouterKey.slice(0, 7)}${'•'.repeat(Math.min(12, Math.max(0, openRouterKey.length - 11)))}${openRouterKey.slice(-4)}`}
          </p>
        )}
        {savedFlash && (
          <p className="text-[12px] text-emerald-600 font-semibold flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Preference updated
          </p>
        )}
        {!openRouterKey && (
          <p className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No key set — Coach Jarvis cannot reply until you paste an OpenRouter key above.
          </p>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-[11px] font-mono font-bold uppercase text-slate-500">Model</label>
          <button
            type="button"
            onClick={() => {
              const next = !showFreeOnly;
              setShowFreeOnly(next);
              localStorage.setItem('bt_llm_free_only', String(next));
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold transition ${
              showFreeOnly
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            Free models only
          </button>
        </div>
        <div className="space-y-2 max-h-[50dvh] overflow-y-auto pr-1">
          {visibleModels.map((m) => {
            const active = selectedModel === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedModel(m.id);
                  localStorage.setItem('bt_llm_model', m.id);
                  flash();
                }}
                className={`w-full p-3 rounded-xl border text-left transition flex items-start justify-between gap-2 ${
                  active
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold flex items-center gap-2 flex-wrap">
                    {m.name}
                    {m.free && (
                      <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                        Free
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{m.desc}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-1 truncate">{m.id}</div>
                </div>
                {active && <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
              </button>
            );
          })}
          {visibleModels.length === 0 && (
            <div className="text-[12px] text-slate-400 italic p-2">No free models in the current list.</div>
          )}
        </div>
      </section>
    </div>
  );
}
