import React, { useEffect, useState } from 'react';
import { useBattrickAuth } from '../lib/battrickAuthContext';
import { ShieldAlert, ShieldCheck, Lock, X, LogOut } from 'lucide-react';

export default function BattrickAuthBar() {
  const {
    isAuthenticated,
    username,
    isAuthenticating,
    error,
    isPromptOpen,
    openPrompt,
    closePrompt,
    authenticate,
    logout,
    rememberUsername,
  } = useBattrickAuth();

  const [formUsername, setFormUsername] = useState<string>(username);
  const [formPassword, setFormPassword] = useState<string>('');
  const [formRemember, setFormRemember] = useState<boolean>(rememberUsername);

  // Reset the form whenever the prompt is (re)opened
  useEffect(() => {
    if (isPromptOpen) {
      setFormUsername(username);
      setFormPassword('');
      setFormRemember(rememberUsername);
    }
  }, [isPromptOpen, username, rememberUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await authenticate(formUsername, formPassword, formRemember);
  };

  return (
    <>
      <div
        className={`w-full border-b px-3 py-2 text-[11px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
          isAuthenticated
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isAuthenticated ? (
            <ShieldCheck className="w-4 h-4 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 shrink-0" />
          )}
          {isAuthenticated ? (
            <span className="truncate">
              <strong>Connected to Battrick</strong> as {username} &mdash; sync and the transfer bot are ready. Stay signed in keeps the bot working after you close the tab.
            </span>
          ) : (
            <span className="truncate">
              <strong>Not connected to Battrick.</strong> Connect once here and every sync button will work without asking again.
            </span>
          )}
        </div>
        {isAuthenticated ? (
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1 font-bold hover:underline shrink-0 self-start sm:self-auto cursor-pointer"
            title="Disconnect Battrick session"
          >
            <LogOut className="w-3.5 h-3.5" />
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={openPrompt}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded-lg shrink-0 self-start sm:self-auto cursor-pointer"
          >
            Connect Battrick
          </button>
        )}
      </div>

      {isPromptOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-display font-bold text-base text-slate-900">Connect Your Battrick Account</h3>
              </div>
              <button
                type="button"
                onClick={closePrompt}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                Username
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="Your Battrick username"
                  autoComplete="username"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-normal"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-700">
                Password
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Your Battrick password"
                  autoComplete="current-password"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-normal"
                  required
                />
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formRemember}
                  onChange={(e) => setFormRemember(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Stay signed in (for transfer bot) on this device
              </label>

              {error && (
                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>
              )}

              <div className="text-[10px] text-slate-500 leading-relaxed">
                Tick Stay signed in so the transfer bot can refresh and bid after you close the tab. Password stays in this browser only until you Disconnect.
              </div>

              <button
                type="submit"
                disabled={isAuthenticating || !formUsername.trim() || !formPassword}
                className="mt-1 w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {isAuthenticating ? 'Connecting…' : 'Connect'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
