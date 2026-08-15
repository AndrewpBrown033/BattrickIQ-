import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  onCustomAuthStateChanged, 
  customSignIn, 
  customSignUp, 
  customSignOut, 
  CustomUser,
  toggleDemoRole
} from '../lib/customAuth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Lock, Mail, ShieldAlert, Sparkles, LogOut, CheckCircle, RefreshCw, Trophy } from 'lucide-react';

export default function AuthController() {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('My Battrick IQ Club');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudSynced, setCloudSynced] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [cloudProfile, setCloudProfile] = useState<any>(null);

  // 1. Listen for Auth State Changes
  useEffect(() => {
    const unsubscribe = onCustomAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      setAuthError(null);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time snapshot listener to fetch cloud data on login
  useEffect(() => {
    if (!user) {
      setCloudSynced(false);
      return;
    }

    // Force clear any leftover wipe flags when a user session starts to avoid blocking synchronization
    localStorage.removeItem('bt_wiping');

    const updateLocalIfChanged = (key: string, newValue: any): { changed: boolean; shouldPush: boolean } => {
      const serializedNew = typeof newValue === 'string' ? newValue : JSON.stringify(newValue);
      const serializedCurrent = localStorage.getItem(key);

      // If there was a very recent local write (within the last 15 seconds), do NOT overwrite it.
      // Instead, we mark it to force push the local changes back up to the cloud.
      const lastLocalWrite = localStorage.getItem('bt_last_local_write_' + key);
      if (lastLocalWrite) {
        const elapsed = Date.now() - parseInt(lastLocalWrite, 10);
        if (elapsed < 15000) {
          console.log(`[AuthController] Recent local write for ${key} detected (${elapsed}ms ago). Skipping cloud overwrite to prevent data loss.`);
          return { changed: false, shouldPush: true };
        }
      }

      // If cloud value is empty but local has actual data, we should back up local data instead of wiping it
      let isCloudEmpty = false;
      if (!newValue) {
        isCloudEmpty = true;
      } else if (Array.isArray(newValue) && newValue.length === 0) {
        isCloudEmpty = true;
      } else if (typeof newValue === 'object') {
        const keys = Object.keys(newValue);
        if (keys.length === 0) {
          isCloudEmpty = true;
        } else if (key === 'bt_finances' && (newValue.cash === 0 || newValue.cash === undefined)) {
          isCloudEmpty = true;
        } else if (key === 'bt_stadium' && (newValue.capacity === 0 || newValue.capacity === undefined)) {
          isCloudEmpty = true;
        }
      }

      let isLocalPopulated = false;
      if (serializedCurrent && serializedCurrent !== '[]' && serializedCurrent !== 'null' && serializedCurrent !== '{}') {
        try {
          const parsed = JSON.parse(serializedCurrent);
          if (Array.isArray(parsed)) {
            if (parsed.length > 0) isLocalPopulated = true;
          } else if (parsed && typeof parsed === 'object') {
            if (key === 'bt_finances' && parsed.cash > 0) isLocalPopulated = true;
            if (key === 'bt_stadium' && parsed.capacity > 0) isLocalPopulated = true;
            if (key === 'bt_pavilion' && parsed.groundName) isLocalPopulated = true;
          }
        } catch (e) {}
      }

      if (isCloudEmpty && isLocalPopulated) {
        return { changed: false, shouldPush: true };
      }

      if (serializedCurrent !== serializedNew) {
        (window as any).isCloudUpdatingLocal = true;
        try {
          localStorage.setItem(key, serializedNew);
        } finally {
          (window as any).isCloudUpdatingLocal = false;
        }
        return { changed: true, shouldPush: false };
      }
      return { changed: false, shouldPush: false };
    };

    setSyncing(true);
    const userDocRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(userDocRef, { includeMetadataChanges: true }, (docSnap) => {
      // If Admin is currently viewing another team, do NOT overwrite localStorage with their own team data
      if (localStorage.getItem('bt_admin_selected_team')) {
        setCloudSynced(true);
        setSyncing(false);
        return;
      }

      // If we are currently wiping local data, do NOT restore cloud data over the wipe
      if (localStorage.getItem('bt_wiping') === 'true') {
        return;
      }

      // If there are pending writes in flight from this client, skip overwriting local storage with stale server states
      if (docSnap.metadata.hasPendingWrites) {
        setCloudSynced(false);
        return;
      }

        if (docSnap.exists()) {
          const data = docSnap.data();
          setCloudProfile(data);
          let changed = false;
          let pushRequired = false;

          if (data.squad && Array.isArray(data.squad) && data.squad.length > 0) {
            localStorage.setItem('bt_has_ever_synced', 'true');
          }

          if (data.squad) {
          const res = updateLocalIfChanged('bt_squad', data.squad);
          if (res.changed) changed = true;
          if (res.shouldPush) pushRequired = true;
        } else if (localStorage.getItem('bt_squad')) {
          pushRequired = true;
        }

        if (data.finances) {
          const res = updateLocalIfChanged('bt_finances', data.finances);
          if (res.changed) changed = true;
          if (res.shouldPush) pushRequired = true;
        } else if (localStorage.getItem('bt_finances')) {
          pushRequired = true;
        }

        if (data.stadium) {
          const res = updateLocalIfChanged('bt_stadium', data.stadium);
          if (res.changed) changed = true;
          if (res.shouldPush) pushRequired = true;
        } else if (localStorage.getItem('bt_stadium')) {
          pushRequired = true;
        }

        if (data.fixtures) {
          const res = updateLocalIfChanged('bt_fixtures', data.fixtures);
          if (res.changed) changed = true;
          if (res.shouldPush) pushRequired = true;
        } else if (localStorage.getItem('bt_fixtures')) {
          pushRequired = true;
        }

        if (data.pavilion) {
          const res = updateLocalIfChanged('bt_pavilion', data.pavilion);
          if (res.changed) changed = true;
          if (res.shouldPush) pushRequired = true;
        } else if (localStorage.getItem('bt_pavilion')) {
          pushRequired = true;
        }

        if (data.teamName) {
          const res = updateLocalIfChanged('bt_team_name', data.teamName);
          if (res.changed) {
            changed = true;
            setTeamName(data.teamName);
          }
        }

        // Only dispatch storage event if something actually changed to prevent infinite loops / flashing
        if (changed) {
          window.dispatchEvent(new Event('storage'));
        }

        // If local has guest data but cloud has empty state, push local -> cloud in background
        if (pushRequired) {
          console.log("[AuthController] Guest data detected. Merging and uploading to cloud...");
          pushLocalDataToCloud(true);
        }

        setCloudSynced(true);
      } else {
        // Create initial cloud doc if it doesn't exist yet
        saveToCloudInitial(user.uid, user.email || '');
      }
      setSyncing(false);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
      setSyncing(false);
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user]);

  const saveToCloudInitial = async (uid: string, userEmail: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const localSquad = localStorage.getItem('bt_squad');
      const localFinances = localStorage.getItem('bt_finances');
      const localStadium = localStorage.getItem('bt_stadium');
      const localFixtures = localStorage.getItem('bt_fixtures');
      const localPavilion = localStorage.getItem('bt_pavilion');
      const localTeamName = localStorage.getItem('bt_team_name') || 'My Battrick IQ Club';

      const initialData = {
        email: userEmail,
        teamName: localTeamName,
        createdAt: new Date().toISOString(),
        squad: localSquad ? JSON.parse(localSquad) : [],
        finances: localFinances ? JSON.parse(localFinances) : {
          cash: 0,
          members: 0,
          prOfficers: 0,
          finAdvisors: 0,
          sponsorsIncome: 0,
          gateReceipts: 0,
          interestReceived: 0,
          playerWages: 0,
          staffWages: 0,
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
        stadium: localStadium ? JSON.parse(localStadium) : {
          terracing: 6000,
          grass: 3000,
          seats: 800,
          boxes: 200,
          capacity: 10000
        },
        fixtures: localFixtures ? JSON.parse(localFixtures) : [],
        pavilion: localPavilion ? JSON.parse(localPavilion) : null
      };
      await setDoc(userDocRef, initialData);
      setCloudSynced(true);
    } catch (e: any) {
      console.error("Error creating initial profile:", e);
      handleFirestoreError(e, OperationType.CREATE, `users/${uid}`);
    }
  };

  // 3. Manually push current local data to Firestore Cloud
  const pushLocalDataToCloud = async (silent: boolean = false) => {
    if (!user) return;
    setSyncing(true);
    try {
      const localSquad = localStorage.getItem('bt_squad');
      const localFinances = localStorage.getItem('bt_finances');
      const localStadium = localStorage.getItem('bt_stadium');
      const localFixtures = localStorage.getItem('bt_fixtures');
      const localPavilion = localStorage.getItem('bt_pavilion');
      const localTeamName = localStorage.getItem('bt_team_name') || teamName || 'My Battrick IQ Club';
      const isWiping = localStorage.getItem('bt_wiping') === 'true';

      const updatePayload: any = {
        email: user.email,
        teamName: localTeamName,
        lastSyncedAt: new Date().toISOString()
      };

      if (isWiping) {
        updatePayload.squad = [];
        updatePayload.finances = {
          cash: 0, members: 0, prOfficers: 0, finAdvisors: 0, sponsorsIncome: 0, gateReceipts: 0, interestReceived: 0, playerWages: 0, staffWages: 0, morale: 'respectable', sponsorsMood: 'respectable', membersConfidence: 'respectable', academyCondition: 'feeble', academyInvestment: 0, academyIts: 0, bowlingCoaches: 0, battingCoaches: 0, fieldingCoaches: 0, keepingCoaches: 0, staminaCoaches: 0, psychologists: 0
        };
        updatePayload.stadium = {
          terracing: 6000, grass: 3000, seats: 800, boxes: 200, capacity: 10000
        };
        updatePayload.fixtures = [];
        updatePayload.pavilion = null;
      } else {
        if (localSquad !== null) {
          updatePayload.squad = JSON.parse(localSquad);
        }
        if (localFinances !== null) {
          updatePayload.finances = JSON.parse(localFinances);
        }
        if (localStadium !== null) {
          updatePayload.stadium = JSON.parse(localStadium);
        }
        if (localFixtures !== null) {
          updatePayload.fixtures = JSON.parse(localFixtures);
        }
        if (localPavilion !== null) {
          updatePayload.pavilion = JSON.parse(localPavilion);
        }
      }

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, updatePayload, { merge: true });

      setCloudSynced(true);
      localStorage.removeItem('bt_wiping');
      if (!silent) {
        alert('Success! All local roster, finances, and stadium settings backed up to the secure Cloud Database.');
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) {
        alert('Error syncing with cloud: ' + err.message);
      }
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      localStorage.removeItem('bt_wiping');
      setSyncing(false);
    }
  };

  // 4. Automatically trigger cloud backup when local data changes
  useEffect(() => {
    const handleBackupRequest = () => {
      if (user) {
        pushLocalDataToCloud(true);
      }
    };
    window.addEventListener('bt_cloud_backup_request', handleBackupRequest);
    return () => {
      window.removeEventListener('bt_cloud_backup_request', handleBackupRequest);
    };
  }, [user, teamName]);

  // Auth operations
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);

    try {
      if (isRegistering) {
        const credentials = await customSignUp(email, password);
        // Initialize Firestore profile
        await saveToCloudInitial(credentials.uid, credentials.email);
      } else {
        await customSignIn(email, password);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message;
      if (err.code === 'auth/wrong-password') errMsg = 'Invalid password. Please try again.';
      if (err.code === 'auth/user-not-found') errMsg = 'No account associated with this email address.';
      if (err.code === 'auth/email-already-in-use') errMsg = 'This email address is already registered.';
      setAuthError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out of BattrickIQ Cloud? Your cloud data will remain secure.')) {
      try {
        customSignOut();
        // Clear sensitive states from local storage so guests don't see them
        localStorage.removeItem('bt_squad');
        localStorage.removeItem('bt_finances');
        localStorage.removeItem('bt_stadium');
        localStorage.removeItem('bt_fixtures');
        localStorage.removeItem('bt_pavilion');
        localStorage.removeItem('bt_team_name');
        localStorage.removeItem('bt_has_ever_synced');
        localStorage.removeItem('bt_is_demo');
        localStorage.removeItem('bt_wiping');
        window.dispatchEvent(new Event('storage'));
      } catch (e: any) {
        console.error(e);
      }
    }
  };

  const updateTeamName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSyncing(true);
    try {
      localStorage.setItem('bt_team_name', teamName);
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { teamName }, { merge: true });
      window.dispatchEvent(new Event('storage'));
      alert('Team Name successfully updated!');
    } catch (e: any) {
      alert('Error updating team name: ' + e.message);
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center justify-center h-44">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
          <span className="text-xs text-slate-500 font-mono">Authenticating session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm w-full" id="auth-controller-container">
      {user ? (
        // Authenticated manager view
        <div className="flex flex-col gap-4">
          <h3 className="font-display font-extrabold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Trophy className="w-5 h-5 text-indigo-600" />
            Manager Profile & Team Association
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left side: Profile details & associated team */}
            <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
              <div className="flex justify-between items-center text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px]">Logged In As</span>
                  <span className="font-semibold text-slate-800 font-mono block truncate text-sm">{user.email}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[9px] font-mono font-bold uppercase block text-slate-400 tracking-wider">Role</span>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = toggleDemoRole();
                      if (updated) {
                        alert(`Demo Role toggled to: ${updated.role?.toUpperCase()}`);
                      }
                    }}
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border cursor-pointer mt-0.5 inline-block hover:scale-105 active:scale-95 transition ${
                      user.role === 'admin' 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-black' 
                        : 'bg-slate-150 border-slate-300 text-slate-600'
                    }`}
                    title="Click to toggle between Admin & Manager roles for demo/evaluation!"
                  >
                    {user.role || 'manager'} 🔄
                  </button>
                </div>
              </div>

              <form onSubmit={updateTeamName} className="flex flex-col gap-1.5 border-t border-slate-200/60 pt-3">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Associated Team Name</label>
                <div className="flex gap-1.5">
                  <input
                    id="auth-input-teamname"
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="flex-1 p-2 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={syncing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-bold transition duration-150 cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>

            {/* Right side: Database Backup & Manual sync */}
            <div className="flex flex-col gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/50">
              <div className="flex items-center justify-between text-xs h-9">
                <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Database Backup Status</span>
                {cloudSynced ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded text-[10px] font-mono">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Cloud Synced
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold flex items-center gap-1 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded text-[10px] font-mono">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Awaiting Snapshot
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 border-t border-slate-200/60 pt-3">
                <button
                  id="btn-auth-manual-sync"
                  onClick={() => pushLocalDataToCloud()}
                  disabled={syncing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-bold transition duration-150 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  Backup Local Data to Cloud
                </button>
                <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                  Your team settings, squad roster, finances, and stadium blueprints are securely persistent in Google Cloud Firestore.
                </p>
              </div>

              {/* Cloud Database Breakdown */}
              <div className="border-t border-slate-200/60 pt-3 flex flex-col gap-2">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Cloud Database Breakdown</span>
                <div className="bg-white border border-slate-200/80 rounded-lg p-2.5 flex flex-col gap-1.5 text-[11px] text-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Squad Roster:</span>
                    <span className={`font-mono font-bold ${cloudProfile?.squad?.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {cloudProfile?.squad?.length || 0} players
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Weekly Finances:</span>
                    <span className={`font-mono font-bold ${cloudProfile?.finances && (cloudProfile.finances.members > 0 || cloudProfile.finances.cash !== 0) ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {cloudProfile?.finances && (cloudProfile.finances.members > 0 || cloudProfile.finances.cash !== 0) ? '✓ Synced' : '✗ Empty / Default'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Stadium Blueprint:</span>
                    <span className={`font-mono font-bold ${cloudProfile?.stadium && cloudProfile.stadium.capacity > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {cloudProfile?.stadium && cloudProfile.stadium.capacity > 0 ? `${(cloudProfile.stadium.capacity).toLocaleString()} capacity` : '✗ Default'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Match Fixtures:</span>
                    <span className={`font-mono font-bold ${cloudProfile?.fixtures?.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
                      {cloudProfile?.fixtures?.length || 0} fixtures
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Pavilion & Pitch:</span>
                    <span className={`font-mono font-bold ${cloudProfile?.pavilion ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {cloudProfile?.pavilion ? '✓ Synced' : '✗ Empty'}
                    </span>
                  </div>
                </div>
                {(!cloudProfile?.finances || cloudProfile.finances.members === 0 || !cloudProfile?.stadium || cloudProfile.stadium.capacity <= 10000) ? (
                  <p className="text-[10px] text-amber-700 bg-amber-50/70 border border-amber-200 rounded p-2 leading-relaxed">
                    💡 <strong>Pro-Tip:</strong> If some data is missing on login, it is likely because it hasn't been uploaded yet. Simply go to the <strong>Roster Sync</strong> tab, paste your <strong>Weekly Finances</strong> and <strong>Stadium Ground Specs</strong> pages from Battrick, and they will be safely backed up automatically!
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Unauthenticated Login / Register Form
        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <h3 className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <Lock className="w-4.5 h-4.5 text-indigo-600" />
            {isRegistering ? 'Create Club Account' : 'Sign In / Authenticate'}
          </h3>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            {isRegistering 
              ? 'Register a secure cloud account to store player histories, save club budgets, and run customized coaching simulations.'
              : 'Log in to securely retrieve your squad databases, stadium expansion blueprints, and trade assessments from any device.'}
          </p>

          {!isRegistering && (
            <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-indigo-700 leading-relaxed flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Shield:</strong> When you log out, BattrickIQ clears the local copy of your squad and finances from this browser to keep your data secure on shared computers. Simply sign in again to instantly restore all your club data!
              </span>
            </div>
          )}

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-[11px] text-rose-700 font-medium flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-slate-600 font-semibold flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Email Address
              </label>
              <input
                id="auth-input-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. manager@battrick.com"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-600 font-semibold flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Password
              </label>
              <input
                id="auth-input-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-xs font-bold transition duration-150 shadow-sm flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isRegistering ? (
                'Create Secure Account'
              ) : (
                'Sign In Securely'
              )}
            </button>

            <button
              id="btn-auth-toggle-mode"
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError(null);
              }}
              className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 py-2 rounded-lg text-xs font-semibold transition duration-150"
            >
              {isRegistering ? 'Already have an account? Sign In' : 'Create new manager account'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
