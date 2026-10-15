import React, { useEffect, useRef, useState } from 'react';
import { Bot, Check, ChevronDown, ChevronUp, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  loadJarvisSettingsFromCloud,
  readJarvisLocal,
  saveJarvisSettingsToCloud,
} from '../utils/jarvisSettingsStore';

interface JarvisFooterProps {
  onOpenFullSettings: () => void;
}

/**
 * Global footer shown at the bottom of every page: lets the user paste/save
 * their OpenRouter API key for Coach Jarvis without hunting through menus.
 * Uses the same store as Jarvis Settings (localStorage + Firestore), so the
 * two stay in sync via the `bt_jarvis_settings_changed` event.
 */
export default function JarvisFooter({ onOpenFullSettings }: JarvisFooterProps) {
  const [open, setOpen] = useState(false);
  const [savedKey, setSavedKey] = useState(() => readJarvisLocal().openRouterApiKey);
  const [draft, setDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'localOnly'>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in sync with the Jarvis Settings screen / inline key field / cloud hydrate.
  useEffect(() => {
    const refresh = () => setSavedKey(readJarvisLocal().openRouterApiKey);
    window.addEventListener('bt_jarvis_settings_changed', refresh);
    window.addEventListener('storage', refresh);
    loadJarvisSettingsFromCloud().then(refresh).catch(() => {});
    return () => {
      window.removeEventListener('bt_jarvis_settings_changed', refresh);
      window.removeEventListener('storage', refresh);
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const save = async (value: string) => {
    const v = value.trim();
    setStatus('saving');
    try {
      await saveJarvisSettingsToCloud({ openRouterApiKey: v });
      setStatus('saved');
    } catch {
      // saveJarvisSettingsToCloud writes localStorage first, so the key still works on this device.
      setStatus('localOnly');
    }
    setSavedKey(v);
    setDraft('');
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus('idle'), 2500);
  };

  const masked = savedKey
    ? `${savedKey.slice(0, 7)}${'•'.repeat(8)}${savedKey.slice(-4)}`
    : '';

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 text-left"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Bot className="w-4 h-4 text-indigo-600" />
            Jarvis settings
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                savedKey ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {savedKey ? 'API key saved' : 'No API key'}
            </span>
          </span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {open && (
          <div className="mt-3 space-y-2 max-w-xl">
            <label className="text-[11px] font-mono font-bold uppercase text-slate-500 block">
              OpenRouter API key
            </label>
            {savedKey && (
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                <span className="truncate">Current: {showKey ? savedKey : masked}</span>
                <button
                  type="button"
                  onClick={() => save('')}
                  className="text-rose-600 hover:text-rose-800 underline shrink-0"
                >
                  Clear
                </button>
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) save(draft);
              }}
            >
              <div className="relative flex-1 min-w-0">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={savedKey ? 'Paste a new key to replace it' : 'sk-or-v1-…'}
                  className="w-full text-sm font-mono p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="submit"
                disabled={!draft.trim() || status === 'saving'}
                className="px-3.5 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
              >
                {status === 'saving' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
            </form>
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <span>
                {status === 'saved' && 'Saved to your account and this device.'}
                {status === 'localOnly' && 'Saved on this device only — cloud save failed.'}
                {status === 'idle' && 'Get a key at openrouter.ai/keys. Saved to your account so it follows you across devices.'}
                {status === 'saving' && 'Saving…'}
              </span>
              <button
                type="button"
                onClick={onOpenFullSettings}
                className="text-indigo-600 font-semibold underline shrink-0"
              >
                Model &amp; more
              </button>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
