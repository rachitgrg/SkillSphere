import React from 'react';
import type { WorkExperience } from '../../types';

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

export const WorkTimeline: React.FC<{ items: WorkExperience[] }> = ({ items }) => {
  const sorted = [...items].sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));
  return (
    <ol className="space-y-6 border-l-2 border-slate-800 ml-3">
      {sorted.map((item, i) => (
        <li key={item._id ?? i} className="relative pl-6">
          <div className="absolute w-3 h-3 bg-indigo-500 rounded-full -left-[7px] top-2 ring-4 ring-slate-900" />
          <div className="glass-card p-4 rounded-xl border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              <div>
                <h4 className="text-base font-semibold text-white">{item.title}</h4>
                <p className="text-indigo-400 font-medium text-sm">{item.company}</p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md shrink-0">
                {monthYear(item.startDate)} – {item.current || !item.endDate ? 'Present' : monthYear(item.endDate)}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-3 whitespace-pre-line">{item.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
};
