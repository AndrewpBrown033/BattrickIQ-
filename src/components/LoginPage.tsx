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
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const saveToCloudInitial = async (uid: string, userEmail: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const initialData = {
        email: userEmail,
        teamName: 'My Battrick IQ Club',
        createdAt: new Date().toISOString(),
        squad: [],
        finances: {
          cash: 4500000,
          members: 600,
          prOfficers: 2,
          finAdvisors: 4,
          sponsorsIncome: 25000,
          gateReceipts: 35000,
          interestReceived: 5000,
          playerWages: 15000,
          staffWages: 7500,
          morale: 'respectable',
          sponsorsMood: 'respectable',
          membersConfidence: 'respectable',
          academyCondition: 'feeble',
          academyInvestment: 0,
          academyIts: 0,
          bowlingCoaches: 0,
          battingCoaches: 0,
          fieldingCoaches: 0,
          keepingCoaches: 0,
          staminaCoaches: 0,
          psychologists: 0
        },
        stadium: {
          terracing: 6000,
          grass: 3000,
          seats: 800,
          boxes: 200,
          capacity: 10000
        }
      };
      await setDoc(userDocRef, initialData);
    } catch (e) {
      console.error("Error creating initial profile:", e);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setAuthError(null);

    try {
      if (isRegistering) {
        const credentials = await customSignUp(email, password);
        await saveToCloudInitial(credentials.uid, credentials.email);
      } else {
        await customSignIn(email, password);
      }
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message;
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = 'Invalid email or password. Please try again.';
      } else if (err.code === 'auth/user-not-found') {
        errMsg = 'No account associated with this email address.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email address is already registered.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password should be at least 6 characters.';
      }
      setAuthError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] bg-blueprint-grid flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative selection:bg-blue-500/10 selection:text-blue-800" id="login-page">
      {/* Background ambient blur elements */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl w-full mx-auto bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        
        {/* Left Branding Panel: Styled for Cricket Managers */}
        <div className="md:col-span-6 bg-[#001c40] p-8 sm:p-12 text-white flex flex-col justify-between relative overflow-hidden border-r border-slate-200">
          {/* Technical Blueprint pattern */}
          <div className="absolute inset-0 bg-blueprint-dots opacity-40 pointer-events-none" />
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-600/10 to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                <Award className="w-5.5 h-5.5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="font-display font-black text-xl tracking-tight">
                    Battrick<span className="text-blue-400">IQ</span>
                  </h1>
                  <span className="text-[8px] font-mono font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                    v4.2
                  </span>
                </div>
                <p className="text-[9px] text-blue-300 font-bold font-mono uppercase tracking-wider">
                  Strategic Squad Analytics
                </p>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight mb-4 leading-tight">
              Design & model your elite cricket squad.
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/70 leading-relaxed mb-8">
              BattrickIQ provides high-performance tactical analytics, rating prediction tools, and stadium development optimization for cricket managers. Run skill analysis, optimize line-ups, and manage finances securely.
            </p>

            {/* Strategic checklist steps */}
            <div className="flex flex-col gap-4 text-xs sm:text-sm border-t border-blue-900/40 pt-6">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-blue-950 text-blue-400 border border-blue-800 mt-0.5 shrink-0 font-mono text-[9px] font-bold">
                  01
                </div>
                <div>
                  <span className="font-bold text-slate-100 block">Roster Intelligence</span>
                  <span className="text-blue-200/60 text-xs">Paste squad pages or raw text to parse skills and back up on secure cloud documents.</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-blue-950 text-blue-400 border border-blue-800 mt-0.5 shrink-0 font-mono text-[9px] font-bold">
                  02
                </div>
                <div>
                  <span className="font-bold text-slate-100 block">Lineup Optimization</span>
                  <span className="text-blue-200/60 text-xs">Run active skill weighting to formulate maximum rating configurations.</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded bg-blue-950 text-blue-400 border border-blue-800 mt-0.5 shrink-0 font-mono text-[9px] font-bold">
                  03
                </div>
                <div>
                  <span className="font-bold text-slate-100 block">Stadium Engineering</span>
                  <span className="text-blue-200/60 text-xs">Calculate optimum capacity divisions to scale seat revenue.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-12 pt-6 border-t border-blue-900/40 flex items-center gap-2.5 text-xs text-blue-300 font-mono">
            <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Secure Firestore Database Encryption</span>
          </div>
        </div>

        {/* Right Auth Portal Column */}
        <div className="md:col-span-6 p-8 sm:p-12 flex flex-col justify-center bg-white relative">
          {/* Subtle blueprint grid on login workspace */}
          <div className="absolute inset-0 bg-blueprint-grid opacity-[0.15] pointer-events-none" />
          
          <div className="w-full max-w-md mx-auto relative z-10">
            
            <div className="mb-6">
              <h3 className="text-xl font-display font-bold text-slate-900">
                {isRegistering ? 'Register Manager Account' : 'Sign In to BattrickIQ'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isRegistering 
                  ? 'Set up a secure manager profile to sync your roster details.'
                  : 'Welcome back, manager. Enter your credentials to access your squad data.'}
              </p>
            </div>

            {authError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 font-medium flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5 text-xs">
                <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  Manager Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. manager@battrick.com"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition text-xs font-medium"
                />
              </div>

              <div className="flex flex-col gap-1.5 text-xs">
                <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  Security Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition text-xs font-medium"
                />
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-bold transition duration-150 shadow-md flex items-center justify-center gap-1.5 cursor-pointer shadow-blue-500/10"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isRegistering ? (
                    <>Create Manager Profile <ArrowRight className="w-3.5 h-3.5" /></>
                  ) : (
                    <>Sign In Securely <ArrowRight className="w-3.5 h-3.5" /></>
                  )}
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-[10px] font-mono text-slate-400 uppercase font-bold">Or Instant Access</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <button
                  id="btn-login-quick-demo"
                  type="button"
                  onClick={() => {
                    const demoUser = {
                      uid: 'bt_andrew_admin',
                      email: 'andrewpbrown33@gmail.com',
                      role: 'admin' as const
                    };
                    localStorage.setItem('bt_custom_user', JSON.stringify(demoUser));
                    window.location.reload();
                  }}
                  className="w-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-200 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Enter as Manager (Andrew Brown)</span>
                </button>
              </div>

              <div className="text-center mt-4">
                <button
                  id="btn-login-toggle-mode"
                  type="button"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setAuthError(null);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                >
                  {isRegistering ? 'Already registered? Manager Sign In' : 'Need a manager account? Register Now'}
                </button>
              </div>
            </form>

          </div>
        </div>

      </div>
    </div>
  );
}
