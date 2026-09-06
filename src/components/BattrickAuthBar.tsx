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
    rememberUsername
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
    if (!formUsername.trim() || !formPassword) return;
    await authenticate(formUsername, formPassword, formRemember);
  };

  return (
    <>
      {/* Always-visible session status bar, sits above every tab */}
      <div
        className={`w-full px-4 sm:px-6 lg:px-8 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] sm:text-xs font-mono border-b ${
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
              <strong>Connected to Battrick</strong> as {username} &mdash; sync buttons across the app are ready to use for this session.
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

      {/* Login modal */}
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
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Authenticate once and every sync button across BattrickIQ &mdash; Roster Sync, Opponent Scout, and League Standings &mdash; will reuse this session automatically.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono font-bold uppercase text-slate-600 block mb-1">
                  Battrick Username
                </label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="Your Battrick username"
                  autoComplete="username"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono font-bold uppercase text-slate-600 block mb-1">
                  Battrick Password
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Your Battrick password"
                  autoComplete="current-password"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formRemember}
                  onChange={(e) => setFormRemember(e.target.checked)}
                />
                Remember username on this device
              </label>

              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 text-[11px] rounded-lg p-2">
                  {error}
                </div>
              )}

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[10px] font-mono text-slate-500">
                Your password is held only in this browser tab's session memory and is cleared automatically on log out or inactivity timeout &mdash; it is never stored permanently.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closePrompt}
                  className="px-3.5 py-2 text-xs font-mono font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-mono font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isAuthenticating ? 'Connecting…' : 'Connect & Save for Session'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
