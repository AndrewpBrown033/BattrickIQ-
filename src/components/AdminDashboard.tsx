import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  Users, RefreshCw, Search, Eye, TrendingUp, Coins, Landmark, 
  Trophy, ShieldAlert, CheckCircle, Clock, Database, BarChart3, ChevronRight,
  Bot, Key, EyeOff
} from 'lucide-react';

interface AdminDashboardProps {
  currentUserUid: string;
}

export default function AdminDashboard({ currentUserUid }: AdminDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'metrics' | 'teams' | 'ai_config'>('metrics');
  
  // Custom Gemini Key Settings
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem('bt_custom_api_key') || '');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [testingKey, setTestingKey] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testFeedback, setTestFeedback] = useState<string>('');
  
  // Active selected team for view mode
  const [viewingEmail, setViewingEmail] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ uid: doc.id, ...doc.data() });
      });
      setUsers(list);
    } catch (err: any) {
      console.error("Error fetching users:", err);
      setError(err.message || "Failed to load registered manager data from Firestore.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    
    // Sync local state viewing email
    const handleStorageChange = () => {
      setViewingEmail(localStorage.getItem('bt_admin_viewing_email'));
    };
    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Compute stats for Usage Dashboard
  const totalUsers = users.length;
  const totalPlayers = users.reduce((sum, u) => sum + (u.squad?.length || 0), 0);
  const totalCash = users.reduce((sum, u) => sum + (u.finances?.cash || 0), 0);
  const averageCash = totalUsers > 0 ? Math.round(totalCash / totalUsers) : 0;
  
  const totalStadiumCapacity = users.reduce((sum, u) => sum + (u.stadium?.capacity || 0), 0);
  const averageStadiumCapacity = totalUsers > 0 ? Math.round(totalStadiumCapacity / totalUsers) : 0;

  // Filtered users for the team switcher table
  const filteredUsers = users.filter(u => {
    const email = (u.email || '').toLowerCase();
    const teamName = (u.teamName || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return email.includes(query) || teamName.includes(query);
  });

  const handleSelectTeam = (selectedUser: any) => {
    if (selectedUser.uid === currentUserUid) {
      // Revert if they selected themselves
      handleRevertTeam();
      return;
    }

    localStorage.setItem('bt_admin_selected_team', selectedUser.uid);
    localStorage.setItem('bt_admin_viewing_email', selectedUser.email || '');
    localStorage.setItem('bt_admin_viewing_name', selectedUser.teamName || '');
    
    // Set actual team data inside local storage for dashboards to parse
    localStorage.setItem('bt_squad', JSON.stringify(selectedUser.squad || []));
    localStorage.setItem('bt_finances', JSON.stringify(selectedUser.finances || {}));
    localStorage.setItem('bt_stadium', JSON.stringify(selectedUser.stadium || {}));
    localStorage.setItem('bt_fixtures', JSON.stringify(selectedUser.fixtures || []));
    localStorage.setItem('bt_pavilion', JSON.stringify(selectedUser.pavilion || null));
    localStorage.setItem('bt_team_name', selectedUser.teamName || 'Selected Team');
    
    window.dispatchEvent(new Event('storage'));
  };

  const handleRevertTeam = async () => {
    localStorage.removeItem('bt_admin_selected_team');
    localStorage.removeItem('bt_admin_viewing_email');
    localStorage.removeItem('bt_admin_viewing_name');
    
    // Reload Admin's original data from cloud
    try {
      const docRef = doc(db, 'users', currentUserUid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.squad) localStorage.setItem('bt_squad', JSON.stringify(data.squad));
        if (data.finances) localStorage.setItem('bt_finances', JSON.stringify(data.finances));
        if (data.stadium) localStorage.setItem('bt_stadium', JSON.stringify(data.stadium));
        if (data.fixtures) localStorage.setItem('bt_fixtures', JSON.stringify(data.fixtures));
        if (data.pavilion) localStorage.setItem('bt_pavilion', JSON.stringify(data.pavilion));
        localStorage.setItem('bt_team_name', data.teamName || 'My Battrick IQ Club');
      }
    } catch (e) {
      console.error("Error reverting team data:", e);
    }
    
    window.dispatchEvent(new Event('storage'));
  };

  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleSaveApiKey = () => {
    localStorage.setItem('bt_custom_api_key', customApiKey.trim());
    window.dispatchEvent(new Event('storage'));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('bt_custom_api_key');
    window.dispatchEvent(new Event('storage'));
    setCustomApiKey('');
    setTestStatus('idle');
    setTestFeedback('');
  };

  const handleTestApiKey = async () => {
    if (!customApiKey.trim()) {
      setTestStatus('error');
      setTestFeedback('Please enter an API key first.');
      return;
    }

    setTestingKey(true);
    setTestStatus('idle');
    setTestFeedback('');

    try {
      const response = await fetch('/api/coach-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'This is an automated connection test. Please reply with: "API verified and working successfully!"',
          context: '',
          customApiKey: customApiKey.trim()
        })
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Returned HTML (e.g., 404 page or static server fallback)
        throw new Error(`The server returned an unexpected HTML response instead of JSON. The dev server may be starting up, or API routes are not active in this environment.`);
      }

      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        throw new Error("Unable to parse the response from the server as valid JSON.");
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      if (data.success && data.reply) {
        setTestStatus('success');
        setTestFeedback(`Connection verified! Response received: "${data.reply}"`);
      } else {
        throw new Error(data.error || 'Empty response received.');
      }
    } catch (err: any) {
      console.error("[Test Key Error]", err);
      setTestStatus('error');
      setTestFeedback(err.message || 'Verification request timed out or was rejected.');
    } finally {
      setTestingKey(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm">
      
      {/* Header section with Admin role badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-md">
              Secure Auth Control
            </span>
            {viewingEmail && (
              <span className="text-[10px] uppercase font-mono font-bold bg-amber-500 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3 animate-pulse" />
                Viewing Mode
              </span>
            )}
          </div>
          <h3 className="font-display font-black text-slate-900 tracking-tight text-base mt-2 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-600" />
            BattrickIQ Admin Management Suite
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Analyze cloud-wide platform usage telemetry and switch session focus between registered managers.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          className="flex items-center gap-1.5 self-start md:self-auto bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold text-[10px] px-3 py-1.5 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Registry Data
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-medium flex items-start gap-3 mb-6">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Access Denied / Query Failed</p>
            <p className="text-[11px] mt-0.5 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition duration-150 flex items-center gap-1.5 ${
            activeTab === 'metrics'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Platform Usage Dashboard
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition duration-150 flex items-center gap-1.5 ${
            activeTab === 'teams'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Team Focus Switcher ({filteredUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('ai_config')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition duration-150 flex items-center gap-1.5 ${
            activeTab === 'ai_config'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bot className="w-4 h-4" />
          Coach Jarvis AI Settings
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="text-xs text-slate-500 font-mono tracking-wide">Querying Firestore telemetry data...</span>
        </div>
      ) : (
        <>
          {/* Tab 1: Usage Telemetry Metrics */}
          {activeTab === 'metrics' && (
            <div className="flex flex-col gap-6">
              
              {/* Telemetry Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider font-mono">Total Managers</span>
                    <span className="text-lg font-black text-slate-900 font-mono">{totalUsers}</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider font-mono">Players Evaluated</span>
                    <span className="text-lg font-black text-slate-900 font-mono">{totalPlayers}</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider font-mono">Avg Club Budget</span>
                    <span className="text-lg font-black text-slate-900 font-mono">£{averageCash.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider font-mono">Avg Stadium Capacity</span>
                    <span className="text-lg font-black text-slate-900 font-mono">{averageStadiumCapacity.toLocaleString()}</span>
                  </div>
                </div>

              </div>

              {/* Advanced Usage Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                <div className="border border-slate-200 rounded-xl p-4.5 bg-white">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono mb-3.5 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    Roster Sync Sync Activity
                  </h4>
                  <div className="flex flex-col gap-2.5">
                    {users.slice(0, 5).map((u, i) => (
                      <div key={u.uid || i} className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block truncate">{u.teamName || 'My Club'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{u.email}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {u.squad?.length || 0} Players
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                            {u.lastSyncedAt ? new Date(u.lastSyncedAt).toLocaleDateString() : 'Awaiting sync'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {users.length === 0 && (
                      <div className="text-center text-slate-400 text-xs py-6">No users synced to cloud database.</div>
                    )}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-4.5 bg-white">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono mb-3.5 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    Capital Allocation Analysis
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    The average registered club maintains a stadium configuration of <strong>{averageStadiumCapacity.toLocaleString()} seats</strong> and reserves an average of <strong>£{averageCash.toLocaleString()} cash</strong> in their club balances.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 font-bold mb-1">
                        <span>AVERAGE CLUB LIQUIDITY</span>
                        <span>£{averageCash.toLocaleString()} / £10,000,000 LIMIT</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full" 
                          style={{ width: `${Math.min(100, (averageCash / 10000000) * 100)}%` }} 
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500 font-bold mb-1">
                        <span>AVERAGE STADIUM CAPACITY</span>
                        <span>{averageStadiumCapacity.toLocaleString()} / 30,000 SEATS</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full" 
                          style={{ width: `${Math.min(100, (averageStadiumCapacity / 30000) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Tab 2: Team Focus Switcher */}
          {activeTab === 'teams' && (
            <div className="flex flex-col gap-4">
              
              {/* Search filter bar */}
              <div className="relative">
                <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="admin-search-team"
                  type="text"
                  placeholder="Filter managers by email address or club team name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition font-medium"
                />
              </div>

              {/* active mode warning */}
              {viewingEmail && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center text-xs text-amber-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                    <span>
                      Currently inspecting: <strong>{viewingEmail}</strong>. 
                    </span>
                  </div>
                  <button
                    onClick={handleRevertTeam}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[9px] uppercase px-2.5 py-1 rounded transition"
                  >
                    Reset and View My Self
                  </button>
                </div>
              )}

              {/* Table / List representation */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-mono font-bold">
                        <th className="px-4 py-3">Team & Manager Details</th>
                        <th className="px-4 py-3">Roster Size</th>
                        <th className="px-4 py-3">Finances</th>
                        <th className="px-4 py-3">Stadium Cap</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {filteredUsers.map((u, index) => {
                        const isSelf = u.uid === currentUserUid;
                        const isCurrentlySelected = viewingEmail === u.email;
                        
                        return (
                          <tr 
                            key={u.uid || index} 
                            className={`hover:bg-slate-50 transition duration-100 ${
                              isCurrentlySelected ? 'bg-indigo-50/40' : ''
                            }`}
                          >
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                  isSelf 
                                    ? 'bg-indigo-100 text-indigo-700' 
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {isSelf ? 'ME' : (u.email || 'M').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="font-bold text-slate-800 block leading-tight">{u.teamName || 'Unnamed Club'}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">{u.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                {u.squad?.length || 0} Players
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-slate-700 font-semibold">
                                £{(u.finances?.cash || 0).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-slate-500 font-medium">
                                {(u.stadium?.capacity || 10000).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              {isSelf ? (
                                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase px-2 py-1">
                                  Default User
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleSelectTeam(u)}
                                  className={`font-mono text-[9px] font-bold uppercase px-2.5 py-1.5 rounded-lg border transition duration-150 cursor-pointer flex items-center gap-1 ml-auto ${
                                    isCurrentlySelected
                                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900'
                                  }`}
                                >
                                  <Eye className="w-3.5 h-3.5 shrink-0" />
                                  {isCurrentlySelected ? 'Selected' : 'View Team'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center text-slate-400 py-10 font-medium">
                            No manager profiles match the filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* Tab 3: Coach Jarvis AI settings */}
          {activeTab === 'ai_config' && (
            <div className="flex flex-col gap-6" id="ai-coach-settings-panel">
              <div className="border border-slate-200 rounded-xl p-5 bg-white">
                <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 mb-4">
                  <Key className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h4 className="font-display font-bold text-sm text-slate-800">Custom Gemini API Key Configuration</h4>
                    <p className="text-[11px] text-slate-500">Provide your own personal Gemini API key to avoid 503 high-demand rate limit blocks on Coach Jarvis.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-950 flex flex-col gap-1.5 leading-relaxed animate-fade-in">
                    <span className="font-bold">Why use a Custom API Key?</span>
                    <span>
                      BattrickIQ provides a shared hosting API key for convenience. However, during high-demand peak cricket hours, the shared key may experience 503 Service Unavailable errors. 
                    </span>
                    <span>
                      Adding your own <strong>Gemini API key</strong> (which has a generous free tier) routes your Coach Jarvis inquiries directly and securely through your own project, guaranteeing instant, 100% reliable responses!
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-500 font-bold uppercase tracking-wider font-mono">Gemini API Key</label>
                    <div className="relative flex items-center">
                      <input
                        id="custom-api-key-input"
                        type={showKey ? 'text' : 'password'}
                        placeholder="Enter your AI Studio API Key (AIzaSy...)"
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 transition font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2.5 mt-2">
                    <button
                      onClick={handleSaveApiKey}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      Save API Key
                    </button>
                    <button
                      onClick={handleTestApiKey}
                      disabled={testingKey}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {testingKey ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                      Test Connection
                    </button>
                    {customApiKey && (
                      <button
                        onClick={handleClearApiKey}
                        className="px-4 py-2 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-500 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Clear API Key
                      </button>
                    )}
                  </div>

                  {saveSuccess && (
                    <div className="mt-2 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-800 font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>API key saved successfully! Coach Jarvis will now run using your custom key.</span>
                    </div>
                  )}

                  {testStatus !== 'idle' && (
                    <div className={`mt-2 p-3 rounded-lg text-xs border flex items-start gap-2 ${
                      testStatus === 'success' 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                        : 'bg-rose-50 border-rose-100 text-rose-800'
                    }`}>
                      {testStatus === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold block">{testStatus === 'success' ? 'Verification Succeeded' : 'Verification Failed'}</span>
                        <span className="text-[11px] block mt-0.5 leading-relaxed">{testFeedback}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Instructions on getting a key */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-2.5">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-indigo-600" />
                  How to get your free Gemini API key?
                </span>
                <ol className="list-decimal pl-5 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                  <li>Go to the <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold">Google AI Studio</a>.</li>
                  <li>Log in with your standard Google Account.</li>
                  <li>Click on the prominent <strong>"Get API Key"</strong> button at the top left.</li>
                  <li>Create a new API key (choose any existing project or create a free sandbox project).</li>
                  <li>Copy your generated key, paste it in the field above, and click <strong>"Save API Key"</strong>!</li>
                </ol>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
