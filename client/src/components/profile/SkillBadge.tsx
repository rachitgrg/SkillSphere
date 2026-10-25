import React from 'react';
import type { Skill } from '../../types';

const COLORS: Record<Skill['proficiency'], string> = {
  beginner: 'bg-slate-800 text-slate-300 border-slate-700',
  intermediate: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  advanced: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  expert: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
};

export const SkillBadge: React.FC<{ skill: Skill; className?: string }> = ({ skill, className = '' }) => (
  <span
    title={`${skill.proficiency}${skill.yearsOfExperience ? ` · ${skill.yearsOfExperience} yrs` : ''}`}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${COLORS[skill.proficiency]} ${className}`}
  >
    {skill.name}
    <span className="opacity-70 capitalize">· {skill.proficiency}</span>
  </span>
);
