import React from 'react';
import { buildSkillCard, type SkillKey, type TeamAlignment } from '../../utils/playerSkillCard';
import { getSkillLabel } from '../../types';

const TONE: Record<TeamAlignment['tone'], string> = {
  good: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  ok: 'bg-amber-50 border-amber-200 text-amber-950',
  poor: 'bg-slate-50 border-slate-200 text-slate-700',
};
const BAR: Record<TeamAlignment['tone'], string> = { good: 'bg-emerald-500', ok: 'bg-amber-500', poor: 'bg-slate-400' };

interface Props {
  skills?: Partial<Record<SkillKey, number>> | null;
  bowlingType?: string;
  alignment: TeamAlignment | null;
}

/** Skill bars + strengths for a listed player, with Jarvis's team-alignment score. */
export default function PlayerSkillCard({ skills, bowlingType, alignment }: Props) {
  const card = buildSkillCard(skills);
  if (!card.hasSkills && !alignment) return null;
  return (
    <div className="mt-1.5 rounded-lg border border-slate-200 bg-white/70 p-2 space-y-1.5">
      {alignment && (
        <div className={'rounded-md border px-2 py-1 ' + TONE[alignment.tone]}>
          <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wide">
            <span>Jarvis team fit: {alignment.verdict}</span>
            <span>{alignment.score}/100</span>
          </div>
          <div className="mt-0.5 h-1.5 rounded-full bg-white/80 overflow-hidden" aria-hidden="true">
            <div className={'h-full rounded-full ' + BAR[alignment.tone]} style={{ width: `${alignment.score}%` }} />
          </div>
          <div className="mt-0.5 text-[10px] font-medium leading-snug">{alignment.summary}</div>
        </div>
      )}
      {card.hasSkills ? (
        <>
          {card.strengths.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <span className="font-bold text-slate-500 uppercase tracking-wide">Strengths</span>
              {card.strengths.map((s) => (
                <span key={s} className="px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold">{s}</span>
              ))}
              {bowlingType && <span className="text-slate-500">· {bowlingType}</span>}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
            {card.rows.map((r) => (
              <div key={r.key} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-[72px] shrink-0 text-slate-500">{r.label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                  <div className={'h-full rounded-full ' + (r.isStrength ? 'bg-indigo-500' : 'bg-slate-400')} style={{ width: `${r.pct}%` }} />
                </div>
                <span className="w-[74px] shrink-0 text-right font-mono text-slate-700" title={`Level ${r.value}`}>
                  {getSkillLabel(r.key, r.value)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-[10px] text-slate-500">Skills weren't shown on this listing.</div>
      )}
    </div>
  );
}
