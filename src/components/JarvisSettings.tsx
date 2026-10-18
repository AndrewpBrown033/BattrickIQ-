import React, { useState, useEffect, useRef } from 'react';
import { Cpu, ShieldCheck, Eye, EyeOff, Check, ExternalLink, Bot, Cloud, Loader2 } from 'lucide-react';
import EmailReportPanel from './EmailReportPanel';
import {
  loadJarvisSettingsFromCloud,
  saveJarvisSettingsToCloud,
  readJarvisLocal,
} from '../utils/jarvisSettingsStore';

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

export default function JarvisSettings() {
  const local0 = readJarvisLocal();
  const [selectedModel, setSelectedModel] = useState(local0.llmModel);
  const [showFreeOnly, setShowFreeOnly] = useState(local0.freeOnly);
  const [openRouterKey, setOpenRouterKey] = useState(local0.openRouterApiKey);
  const [showKey, setShowKey] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'loading' | 'saved' | 'error'>('idle');
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCloudStatus('loading');
      try {
        const s = await loadJarvisSettingsFromCloud();
        if (cancelled) return;
        setOpenRouterKey(s.openRouterApiKey);
        setSelectedModel(s.llmModel);
        setShowFreeOnly(s.freeOnly);
        setCloudStatus('idle');
        setCloudMsg(s.openRouterApiKey ? 'Loaded from your account (cloud)' : 'No key in cloud yet — paste one to save');
      } catch {
        if (!cancelled) {
          setCloudStatus('error');
          setCloudMsg('Could not load from cloud — using this device only');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };

  const persist = (partial: {
    openRouterApiKey?: string;
    llmModel?: string;
    freeOnly?: boolean;
  }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setCloudStatus('loading');
      try {
        await saveJarvisSettingsToCloud(partial);
        setCloudStatus('saved');
        setCloudMsg('Saved to your account (cloud) and this device');
        flash();
        window.setTimeout(() => setCloudStatus('idle'), 2000);
      } catch (e: any) {
        setCloudStatus('error');
        const detail = e?.message ? String(e.message) : 'unknown error';
        setCloudMsg(`Saved on this device only — cloud save failed (${detail})`);
      }
    }, 400);
  };

  const visibleModels = showFreeOnly ? OPENROUTER_MODELS.filter((m) => m.free) : OPENROUTER_MODELS;

  useEffect(() => {
    if (showFreeOnly && !visibleModels.some((m) => m.id === selectedModel) && visibleModels[0]) {
      setSelectedModel(visibleModels[0].id);
      persist({ llmModel: visibleModels[0].id, freeOnly: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFreeOnly]);

  return (
    <div className="flex flex-col gap-4 max-w-xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700">
          <Bot className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Jarvis Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            OpenRouter API key and model for Coach Jarvis. Saved to your BattrickIQ account so it follows you across devices.
          </p>
        </div>
        {savedFlash && (
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">
            Saved
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
        {cloudStatus === 'loading' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
        ) : (
          <Cloud className="w-3.5 h-3.5 text-indigo-600" />
        )}
        <span>{cloudMsg || 'Syncing with your account…'}</span>
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
                persist({ openRouterApiKey: '' });
              }}
              className="text-[11px] font-mono text-rose-600 hover:text-rose-800 underline"
            >
              Clear key
            </button>
          )}
        </div>
        <p className="text-[12px] text-slate-500 leading-relaxed">
          Stored in your account database and mirrored on this device. Get a key at{' '}
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
              persist({ openRouterApiKey: val });
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
            Saved:{' '}
            {showKey
              ? openRouterKey
              : `${openRouterKey.slice(0, 7)}${'•'.repeat(Math.min(12, Math.max(0, openRouterKey.length - 11)))}${openRouterKey.slice(-4)}`}
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
              persist({ freeOnly: next });
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
                  persist({ llmModel: m.id });
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
      <EmailReportPanel />
    </div>
  );
}
