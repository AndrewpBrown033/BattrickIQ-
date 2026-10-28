import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { customSignIn, customSignUp } from '../lib/customAuth';
import { doc, setDoc } from 'firebase/firestore';
import { 
  Lock, 
  Mail, 
  ShieldAlert, 
  Award, 
  Users, 
  Calculator, 
  Landmark, 
  Bot, 
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('My Battrick IQ Club');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setBusy(true);
    try {
      if (isRegistering) {
        const user = await customSignUp(email.trim(), password);
        if (user?.uid) {
          try {
            await setDoc(
              doc(db, 'users', user.uid),
              {
                email: email.trim().toLowerCase(),
                teamName: teamName.trim() || 'My Battrick IQ Club',
                createdAt: new Date().toISOString(),
              },
              { merge: true }
            );
          } catch {
            /* profile write is best-effort */
          }
        }
      } else {
        await customSignIn(email.trim(), password);
      }
      onLoginSuccess?.();
    } catch (err: any) {
      setAuthError(err?.message || 'Sign-in failed. Check your email and password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#f8fafc] bg-blueprint-grid flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-blue-500/10 selection:text-blue-800"
      id="login-page"
    >
      <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl w-full mx-auto bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 relative z-10">
        <div className="md:col-span-6 bg-[#001c40] p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden border-r border-slate-200">
          <div className="absolute inset-0 bg-blueprint-dots opacity-40 pointer-events-none" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-600/10 to-transparent pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-bold uppercase tracking-wider mb-6">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Manager workspace
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-black leading-tight">
              Battrick<span className="text-blue-300">IQ</span>
            </h1>
            <p className="mt-3 text-sm text-blue-100/90 leading-relaxed max-w-sm">
              Your AI assistant for squad planning, training, transfers, and match prep — synced across devices.
            </p>
          </div>

          <div className="relative z-10 mt-10 grid grid-cols-2 gap-3 text-[11px]">
            {[
              { icon: Users, label: 'Squad & training' },
              { icon: Calculator, label: 'Transfer estimator' },
              { icon: Landmark, label: 'Finances & wages' },
              { icon: Bot, label: 'Jarvis coach' },
              { icon: Award, label: 'Match lineups' },
              { icon: RefreshCw, label: 'Live Battrick sync' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2"
              >
                <Icon className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                <span className="text-blue-50/95 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-6 p-8 sm:p-12 flex flex-col justify-center bg-white">
          <div className="mb-6">
            <h2 className="text-xl font-black text-slate-900">
              {isRegistering ? 'Create your account' : 'Sign in to your club'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isRegistering
                ? 'Set up BattrickIQ with the same email on every device.'
                : 'Use the same BattrickIQ account on phone and desktop so Watch and settings sync.'}
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 font-medium flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {isRegistering && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                Club / team name
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-normal text-slate-900"
                  placeholder="My Battrick IQ Club"
                />
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-normal text-slate-900"
                placeholder="manager@example.com"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Password
              </span>
              <input
                type="password"
                required
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-normal text-slate-900"
                placeholder="••••••••"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#001c40] text-white text-sm font-bold px-4 py-3 hover:bg-[#002a5c] disabled:opacity-60"
            >
              {busy ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Please wait…
                </>
              ) : (
                <>
                  {isRegistering ? 'Create account' : 'Sign in'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setIsRegistering((v) => !v);
              setAuthError(null);
            }}
            className="mt-4 text-xs font-semibold text-blue-700 hover:underline text-left"
          >
            {isRegistering ? 'Already have an account? Sign in' : "New here? Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
}
