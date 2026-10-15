import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, Users, GraduationCap, ArrowLeftRight } from 'lucide-react';
import type { BattrickPlayer, ClubFinances } from '../types';

/**
 * Thin manager context above the player list: wages, training load, sell signals.
 */
export default function SquadManagerBar() {
  const [squad, setSquad] = useState<BattrickPlayer[]>([]);
  const [finances, setFinances] = useState<ClubFinances | null>(null);

  useEffect(() => {
    const load = () => {
      try {
        const s = localStorage.getItem('bt_squad');
        setSquad(s ? JSON.parse(s) : []);
      } catch {
        setSquad([]);
      }
      try {
        const f = localStorage.getItem('bt_finances');
        setFinances(f ? JSON.parse(f) : null);
      } catch {
        setFinances(null);
      }
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const stats = useMemo(() => {
    const totalWage = squad.reduce((sum, p) => sum + (p.wage || 0), 0);
    const onNets = squad.filter((p) => {
      const n = p.nets;
      if (!n) return false;
      return (
        (n.batting || 0) +
          (n.bowling || 0) +
          (n.keeping || 0) +
          (n.fielding || 0) +
          (n.stamina || 0) >
        0
      );
    }).length;
    const sellish = squad.filter((p) => {
      if (p.age >= 32) return true;
      if ((p.wage || 0) > 8000 && (p.btRating || 0) < 15000) return true;
      return false;
    }).length;
    return { totalWage, onNets, sellish, count: squad.length };
  }, [squad]);

  return (
    <div className="bg-slate-900 text-white rounded-xl px-3.5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
      <div className="flex items-center gap-1.5 font-bold text-xs tracking-tight">
        <Users className="w-3.5 h-3.5 text-indigo-300" />
        Player list
        <span className="font-mono text-indigo-200 font-semibold">{stats.count}</span>
      </div>
      <div className="h-4 w-px bg-white/15 hidden sm:block" />
      <div className="flex items-center gap-1 text-slate-300">
        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
        <span>
          Squad wages{' '}
          <strong className="text-white font-mono">£{stats.totalWage.toLocaleString()}</strong>
          /wk
        </span>
        {finances?.cash != null && (
          <span className="text-slate-400">
            · cash <strong className="text-emerald-300 font-mono">£{Number(finances.cash).toLocaleString()}</strong>
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-slate-300">
        <GraduationCap className="w-3.5 h-3.5 text-violet-300" />
        <span>
          <strong className="text-white">{stats.onNets}</strong> on nets
        </span>
      </div>
      <div className="flex items-center gap-1 text-slate-300">
        <ArrowLeftRight className="w-3.5 h-3.5 text-amber-300" />
        <span>
          <strong className="text-white">{stats.sellish}</strong> review for sale
        </span>
      </div>
      <p className="w-full sm:w-auto sm:ml-auto text-[10px] text-slate-400">
        Tap a player to decide train, keep, or sell — skills win games; wages protect the club.
      </p>
    </div>
  );
}
