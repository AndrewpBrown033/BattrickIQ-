import React, { useState, useEffect, useMemo } from 'react';
import { BattrickGame } from '../types';
import { getBattrickDateForString, getCurrentBattrickDate } from '../utils/history';
import { Calendar, Search, MapPin, Trophy, Shield, Clock, Swords } from 'lucide-react';

interface FixturesDashboardProps {
  setActiveTab: (tab: any) => void;
}

export default function FixturesDashboard({ setActiveTab }: FixturesDashboardProps) {
  const [fixtures, setFixtures] = useState<BattrickGame[]>([]);
  const [filterType, setFilterType] = useState<string>('All');
  const [clubName, setClubName] = useState<string>('My Club');

  useEffect(() => {
    const loadData = () => {
      const savedFixtures = localStorage.getItem('bt_fixtures');
      if (savedFixtures) {
        try {
          const parsed = JSON.parse(savedFixtures);
          if (Array.isArray(parsed)) {
            setFixtures(parsed);
          }
        } catch (e) {
          console.error('Failed to parse fixtures', e);
        }
      }
      
      const team = localStorage.getItem('bt_team_name');
      if (team && team !== 'My Battrick IQ Club') setClubName(team);
    };

    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const currentBattrickDate = getCurrentBattrickDate();

  const filteredFixtures = useMemo(() => {
    let filtered = fixtures;
    if (filterType !== 'All') {
      filtered = fixtures.filter(f => f.type === filterType);
    }
    
    // Sort by date parsed
    return filtered.sort((a, b) => {
      const dateA = getBattrickDateForString(a.date);
      const dateB = getBattrickDateForString(b.date);
      
      if (dateA && dateB) {
        if (dateA.season !== dateB.season) return dateA.season - dateB.season;
        return dateA.week - dateB.week;
      }
      return 0;
    });
  }, [fixtures, filterType]);

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    fixtures.forEach(f => {
      if (f.type) types.add(f.type);
    });
    return ['All', ...Array.from(types)];
  }, [fixtures]);

  const getResultColor = (result?: string) => {
    if (!result || result === 'Upcoming') return 'text-slate-500 bg-slate-100 border-slate-200';
    const lower = result.toLowerCase();
    if (lower.includes('won')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (lower.includes('lost') || lower.includes('loss')) return 'text-rose-700 bg-rose-50 border-rose-200';
    if (lower.includes('tied') || lower.includes('tie')) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-blue-700 bg-blue-50 border-blue-200';
  };

  return (
    <div className="flex flex-col gap-6" id="fixtures-dashboard-view">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" />
              Draw & Results
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Complete club fixture schedule and historical match results
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {uniqueTypes.map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterType === type 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {fixtures.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-slate-900 font-bold mb-1">No Fixtures Found</h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-4">
              Your draw is currently empty. Sync your Club page from Battrick to load your upcoming and past fixtures.
            </p>
            <button
              onClick={() => setActiveTab('sync')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-5 py-2.5 rounded-lg transition"
            >
              Go to Sync Hub
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Match Details</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Format</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFixtures.map((game, idx) => {
                  const bDate = getBattrickDateForString(game.date);
                  const isCurrentWeek = bDate && bDate.season === currentBattrickDate.season && bDate.week === currentBattrickDate.week;
                  
                  return (
                    <tr key={idx} className={`hover:bg-slate-50 transition ${isCurrentWeek ? 'bg-blue-50/30' : ''}`}>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-700">{game.date}</span>
                          {isCurrentWeek && (
                            <span className="text-[9px] uppercase tracking-wider font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">This Week</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${game.venue === 'Home' ? 'text-blue-900' : 'text-slate-700'}`}>
                              {game.homeTeam || (game.venue === 'Home' ? clubName : game.opponent)}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">v</span>
                            <span className={`font-bold ${game.venue === 'Away' ? 'text-blue-900' : 'text-slate-700'}`}>
                              {game.awayTeam || (game.venue === 'Away' ? clubName : game.opponent)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span className={game.venue === 'Home' ? 'font-bold text-blue-700' : ''}>{game.venue}</span>
                            </div>
                            {game.opponentTeamId && (
                              <button 
                                onClick={() => {
                                  localStorage.setItem('bt_scout_target_team', JSON.stringify({
                                    teamName: game.opponent,
                                    teamId: game.opponentTeamId,
                                    matchId: game.matchId,
                                    type: game.type,
                                    venue: game.venue
                                  }));
                                  window.dispatchEvent(new CustomEvent('bt_scout_target_updated', {
                                    detail: { teamName: game.opponent, teamId: game.opponentTeamId }
                                  }));
                                  window.dispatchEvent(new Event('storage'));
                                  setActiveTab('scout');
                                }}
                                className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition font-medium"
                              >
                                <Swords className="w-3 h-3" />
                                Scout
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-medium">
                          {game.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {game.result && game.result !== 'Upcoming' ? (
                          <div className={`inline-flex items-center px-2.5 py-1.5 rounded-lg border text-xs font-bold ${getResultColor(game.result)}`}>
                            {game.result}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-slate-400 italic">Upcoming</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
