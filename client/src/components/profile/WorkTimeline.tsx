import React from 'react';

interface WorkTimelineItem {
  id: string;
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  description: string;
}

interface WorkTimelineProps {
  items: WorkTimelineItem[];
}

export const WorkTimeline: React.FC<WorkTimelineProps> = ({ items }) => {
  return (
    <div className="space-y-6 border-l-2 border-slate-800 ml-3">
      {items.map((item) => (
        <div key={item.id} className="relative pl-6">
          <div className="absolute w-3 h-3 bg-indigo-500 rounded-full -left-[7px] top-2 ring-4 ring-slate-900"></div>
          <div className="glass-card p-4 rounded-xl border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
              <div>
                <h4 className="text-lg font-semibold text-white">{item.title}</h4>
                <p className="text-indigo-400 font-medium text-sm">{item.company}</p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md">
                {item.startDate} - {item.endDate || 'Present'}
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-3">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
