import { battingForm, bowlingForm } from '../utils/playerGrade';
import React, { useState, useEffect } from 'react';
import { SKILL_LEVELS, LineupPlayer, BattrickPlayer } from '../types';
import { Users, Shield, Copy, Check, Info, ChevronDown, ChevronUp, RefreshCw, UserCheck, Sparkles } from 'lucide-react';
import BowlingOrderPanel, { rankBowlingOrder } from './BowlingOrderPanel';

const PRESET_STRATEGIES = [
  { name: 'Balanced Attack', desc: 'Stable batting order and balanced spin/seam split.' },
  { name: 'Spin Dominance', desc: 'Stacks spin options for dusty/cracked pitches.' },
  { name: 'Green Top Blitzers', desc: 'Seam & fast bowlers for green pitches.' },
  { name: 'Batting Powerhouse', desc: 'Batting depth up to spot 8; fewer pure bowlers.' },
];

function toLineupPlayer(p: BattrickPlayer, order: number, role: LineupPlayer['role']): LineupPlayer {
  return {
    id: String(order),
    name: p.name,
    role,
    batting: p.skills.batting,
    bowling: p.skills.bowling,
    keeping: p.skills.keeping,
    fielding: p.skills.fielding || 5,
    btRating: p.btRating,
    stamina: p.skills.stamina,
    experience: p.skills.experience,
    concentration: p.skills.concentration,
    consistency: p.skills.consistency,
    form: p.form,
    batForm: battingForm(p),
    bowlForm: bowlingForm(p),
    fitness: p.fitness,
    bowlingType: p.bowlingType || 'None',
    order,
  };
}

function generateLineupForStrategy(strategyName: string, players: BattrickPlayer[]): LineupPlayer[] {
  if (!players || players.length === 0) return [];

  const sortedKeepers = [...players].sort((a, b) => {
    if (b.skills.keeping !== a.skills.keeping) return b.skills.keeping - a.skills.keeping;
    return b.skills.batting - a.skills.batting;
  });
  const keeper = sortedKeepers[0];
  const pool = players.filter((p) => p.id !== keeper.id);

  let topBatters: BattrickPlayer[] = [];
  let chosenBowlers: BattrickPlayer[] = [];

  if (strategyName === 'Spin Dominance') {
    const spins = pool.filter((p) => p.bowlingType === 'Spin').sort((a, b) => b.skills.bowling - a.skills.bowling);
    const others = pool.filter((p) => p.bowlingType !== 'Spin').sort((a, b) => b.skills.bowling - a.skills.bowling);
    chosenBowlers = [...spins, ...others].slice(0, 5);
    const ids = new Set(chosenBowlers.map((p) => p.id));
    topBatters = pool.filter((p) => !ids.has(p.id)).sort((a, b) => b.skills.batting - a.skills.batting).slice(0, 5);
  } else if (strategyName === 'Green Top Blitzers') {
    const seams = pool
      .filter((p) => ['Fast', 'Fast Medium', 'Medium'].includes(p.bowlingType))
      .sort((a, b) => b.skills.bowling - a.skills.bowling);
    const others = pool
      .filter((p) => !['Fast', 'Fast Medium', 'Medium'].includes(p.bowlingType))
      .sort((a, b) => b.skills.bowling - a.skills.bowling);
    chosenBowlers = [...seams, ...others].slice(0, 5);
    const ids = new Set(chosenBowlers.map((p) => p.id));
    topBatters = pool.filter((p) => !ids.has(p.id)).sort((a, b) => b.skills.batting - a.skills.batting).slice(0, 5);
  } else if (strategyName === 'Batting Powerhouse') {
    topBatters = [...pool].sort((a, b) => b.skills.batting - a.skills.batting).slice(0, 7);
    const ids = new Set(topBatters.map((p) => p.id));
    chosenBowlers = pool.filter((p) => !ids.has(p.id)).sort((a, b) => b.skills.bowling - a.skills.bowling).slice(0, 3);
  } else {
    topBatters = [...pool].sort((a, b) => b.skills.batting - a.skills.batting).slice(0, 5);
    const ids = new Set(topBatters.map((p) => p.id));
    chosenBowlers = pool.filter((p) => !ids.has(p.id)).sort((a, b) => b.skills.bowling - a.skills.bowling).slice(0, 5);
  }

  const xi: LineupPlayer[] = [];
  for (let i = 0; i < 5; i++) {
    if (topBatters[i]) xi.push(toLineupPlayer(topBatters[i], i + 1, 'Batter'));
  }
  if (chosenBowlers[0]) {
    const b = chosenBowlers[0];
    xi.push(toLineupPlayer(b, 6, b.skills.batting >= 6 ? 'All-rounder' : 'Bowler'));
  }
  xi.push(toLineupPlayer(keeper, 7, 'Keeper'));

  if (strategyName === 'Batting Powerhouse') {
    if (topBatters[5]) xi.push(toLineupPlayer(topBatters[5], 8, 'Batter'));
    if (topBatters[6]) xi.push(toLineupPlayer(topBatters[6], 9, 'Batter'));
    if (chosenBowlers[0]) xi.push(toLineupPlayer(chosenBowlers[0], 10, 'Bowler'));
    if (chosenBowlers[1]) xi.push(toLineupPlayer(chosenBowlers[1], 11, 'Bowler'));
  } else {
    for (let i = 1; i < chosenBowlers.length && xi.length < 11; i++) {
      xi.push(toLineupPlayer(chosenBowlers[i], xi.length + 1, 'Bowler'));
    }
  }

  while (xi.length < 11 && pool.length) {
    const used = new Set(xi.map((p) => p.name));
    const next = pool.find((p) => !used.has(p.name));
    if (!next) break;
    xi.push(toLineupPlayer(next, xi.length + 1, 'Batter'));
  }

  return xi.slice(0, 11).map((p, i) => ({ ...p, id: String(i + 1), order: i + 1 }));
}

interface LineupOptimizerProps {
  setActiveTab?: (tab: string) => void;
}

export default function LineupOptimizer({ setActiveTab }: LineupOptimizerProps) {
  const [lineup, setLineup] = useState<LineupPlayer[]>([]);
  const [importedPlayers, setImportedPlayers] = useState<BattrickPlayer[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [matchEffort, setMatchEffort] = useState<'TIE' | 'PAN' | 'GFI'>('PAN');

  const loadImportedSquad = () => {
    try {
      const saved = localStorage.getItem('bt_squad');
      if (!saved) {
        setImportedPlayers([]);
        setLineup([]);
        return;
      }
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setImportedPlayers(parsed);
        setLineup((prev) =>
          prev.length === 0 ? generateLineupForStrategy('Balanced Attack', parsed) : prev
        );
      }
    } catch {
      setImportedPlayers([]);
    }
  };

  useEffect(() => {
    loadImportedSquad();
    const onStorage = () => loadImportedSquad();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const applyStrategy = (name: string) => {
    if (importedPlayers.length === 0) return;
    setLineup(generateLineupForStrategy(name, importedPlayers));
  };

  const autoOptimizeXI = () => applyStrategy('Balanced Attack');

  const toggleExpand = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  const copySquadToClipboard = () => {
    let text = '[BattrickIQ Team Lineup]\nBatting order:\n';
    lineup.forEach((p) => {
      const bowl =
        p.bowlingType !== 'None'
          ? p.bowlingType + ' ' + SKILL_LEVELS[p.bowling]
          : 'None';
      text += p.order + '. ' + p.name + ' - ' + p.role + ' (Bat: ' + SKILL_LEVELS[p.batting] + ' | Bowl: ' + bowl + ')\n';
    });
    text += '\nBowling order:\n';
    rankBowlingOrder(lineup).forEach((p, i) => {
      text += i + 1 + '. ' + p.name + ' (' + p.bowlingType + ' ' + SKILL_LEVELS[p.bowling] + ')\n';
    });
    text += '\nMatch Effort: ' + matchEffort + '\n';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (importedPlayers.length === 0 && lineup.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-xl p-8 shadow-sm flex flex-col items-center text-center max-w-xl mx-auto my-8">
        <Users className="w-7 h-7 text-indigo-500 mb-4" />
        <h3 className="font-display font-bold text-slate-800 text-sm">No Active Squad Loaded</h3>
        <p className="text-xs text-slate-500 mt-2">
          Sync your Battrick roster to build a Best Match XI with batting and bowling order.
        </p>
        {setActiveTab && (
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
          >
            Go to Sync
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-2 mb-2">
          {importedPlayers.length > 0 && (
            <button
              type="button"
              onClick={autoOptimizeXI}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Auto-Select XI
            </button>
          )}
          {PRESET_STRATEGIES.map((strat) => (
            <button
              key={strat.name}
              type="button"
              onClick={() => applyStrategy(strat.name)}
              className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 hover:border-indigo-300"
            >
              {strat.name}
            </button>
          ))}
        </div>

        <h4 className="font-display font-semibold text-xs text-slate-500 uppercase tracking-wider flex items-center justify-between">
          <span>Batting order</span>
          <span className="text-[10px] lowercase text-slate-400 font-normal">Click a slot for details</span>
        </h4>

        <div className="flex flex-col gap-2">
          {lineup.map((player) => {
            const isExpanded = expandedId === player.id;
            return (
              <div
                key={player.id}
                className={`border rounded-lg shadow-sm ${
                  isExpanded ? 'bg-indigo-50/20 border-indigo-300' : 'bg-white border-slate-200'
                }`}
              >
                <div
                  onClick={() => toggleExpand(player.id)}
                  className="p-3 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-500 w-5 text-right font-bold tabular-nums">
                      {player.order}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        {player.name}
                        {player.role === 'Keeper' && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] rounded font-mono uppercase font-bold">
                            Keeper
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {player.role}
                        {' · '}
                        {player.bowlingType !== 'None' ? `${player.bowlingType} Bowler` : 'No Bowling'}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 font-mono text-[10px]">
                    <div>
                      <span className="text-slate-400 uppercase mr-1">bat:</span>
                      <span className="text-indigo-600 font-bold">{player.batting}</span>
                    </div>
                    {player.bowlingType !== 'None' && (
                      <div>
                        <span className="text-slate-400 uppercase mr-1">bwl:</span>
                        <span className="text-rose-600 font-bold">{player.bowling}</span>
                      </div>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 text-[11px] text-slate-600 border-t border-slate-100 pt-2 grid grid-cols-2 gap-2">
                    <div>Batting: {SKILL_LEVELS[player.batting]} ({player.batting})</div>
                    <div>Bowling: {player.bowlingType !== 'None' ? `${SKILL_LEVELS[player.bowling]} (${player.bowling})` : '—'}</div>
                    <div>Keeping: {SKILL_LEVELS[player.keeping]} ({player.keeping})</div>
                    <div>Stamina: {player.stamina} · Exp: {player.experience}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <BowlingOrderPanel lineup={lineup} />
      </div>

      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h4 className="font-display font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
            <Shield className="w-4 h-4 text-indigo-600" />
            Match Effort
          </h4>
          <div className="grid grid-cols-3 gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1">
            {(
              [
                ['TIE', 'Take It Easy'],
                ['PAN', 'Play As Normal'],
                ['GFI', 'Go For It'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMatchEffort(key)}
                className={`px-2 py-1.5 rounded-md text-[11px] font-bold ${
                  matchEffort === key ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={copySquadToClipboard}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:border-indigo-300"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy batting + bowling order'}
        </button>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3 text-xs text-slate-600">
          <Info className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>
            <strong className="text-indigo-800">Bowling order</strong> ranks everyone in the XI who can
            bowl by bowling skill (plus consistency). Use it as a suggested attack order for the match.
          </span>
        </div>
      </div>
    </div>
  );
}
