import React from 'react';

interface SkillBadgeProps {
  skill: string;
  proficiency?: 'beginner' | 'intermediate' | 'expert';
  className?: string;
}

export const SkillBadge: React.FC<SkillBadgeProps> = ({ skill, proficiency, className = '' }) => {
  const bgColors = {
    beginner: 'bg-slate-800 text-slate-300 border-slate-700',
    intermediate: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    expert: 'bg-violet-500/10 text-violet-400 border-violet-500/20'
  };

  const bg = proficiency ? bgColors[proficiency] : bgColors.intermediate;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${bg} ${className}`}>
      {skill}
    </span>
  );
};
