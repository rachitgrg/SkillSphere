import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

interface Milestone {
  id: string;
  title: string;
  amount: number;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate: string;
}

export const MilestoneTimeline: React.FC<{ milestones: Milestone[] }> = ({ milestones }) => {
  return (
    <div className="space-y-4">
      {milestones.map((milestone, index) => (
        <div key={milestone.id} className="relative flex gap-4">
          {/* Timeline Line */}
          {index < milestones.length - 1 && (
            <div className="absolute left-[11px] top-8 w-0.5 h-full -z-10 bg-slate-800"></div>
          )}
          
          <div className="mt-1">
            {milestone.status === 'completed' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-500 bg-slate-900 rounded-full" />
            ) : milestone.status === 'in_progress' ? (
              <div className="w-6 h-6 rounded-full border-2 border-indigo-500 bg-slate-900 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
              </div>
            ) : (
              <Circle className="w-6 h-6 text-slate-700 bg-slate-900 rounded-full" />
            )}
          </div>
          
          <div className="flex-1 glass-card p-4 rounded-xl border border-slate-800">
            <div className="flex justify-between items-start">
              <div>
                <h4 className={`font-medium ${milestone.status === 'completed' ? 'text-slate-300 line-through' : 'text-white'}`}>
                  {milestone.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1">Due: {milestone.dueDate}</p>
              </div>
              <div className="text-right">
                <span className="font-semibold text-emerald-400">${milestone.amount}</span>
                <div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block ${
                    milestone.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    milestone.status === 'in_progress' ? 'bg-indigo-500/10 text-indigo-400' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {milestone.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
