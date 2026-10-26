import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { Milestone } from '../../types';
import { formatCurrency, formatDate } from '../../utils/helpers';

const STATUS_STYLES: Record<Milestone['status'], string> = {
  pending: 'bg-slate-800 text-slate-400',
  funded: 'bg-cyan-500/10 text-cyan-300',
  in_progress: 'bg-indigo-500/10 text-indigo-400',
  submitted: 'bg-amber-500/10 text-amber-400',
  changes_requested: 'bg-rose-500/10 text-rose-300',
  approved: 'bg-emerald-500/10 text-emerald-400',
};

interface MilestoneTimelineProps {
  milestones: Milestone[];
  /** Per-milestone controls (fund, submit, approve…) rendered under each card. */
  renderActions?: (milestone: Milestone) => React.ReactNode;
}

export const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({ milestones, renderActions }) => {
  return (
    <ol className="space-y-4">
      {milestones.map((milestone, index) => {
        const done = milestone.status === 'approved';
        return (
          <li key={milestone._id ?? index} className="relative flex gap-4">
            {index < milestones.length - 1 && <div className="absolute left-[11px] top-8 w-0.5 h-full -z-10 bg-slate-800" />}

            <div className="mt-1" aria-hidden>
              {done ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500 bg-slate-900 rounded-full" />
              ) : milestone.status === 'pending' ? (
                <Circle className="w-6 h-6 text-slate-700 bg-slate-900 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-indigo-500 bg-slate-900 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-indigo-500" />
                </div>
              )}
            </div>

            <div className="flex-1 glass-card p-4 rounded-xl border border-slate-800 min-w-0">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h4 className={`font-medium ${done ? 'text-slate-300' : 'text-white'}`}>
                    {index + 1}. {milestone.title}
                  </h4>
                  {milestone.description && <p className="text-xs text-slate-400 mt-1">{milestone.description}</p>}
                  <p className="text-xs text-slate-500 mt-1">Due {formatDate(milestone.dueDate)}</p>
                  {!done && (milestone.percent ?? 0) > 0 && (
                    <div className="mt-2 flex items-center gap-2" aria-label={`${milestone.percent}% done`}>
                      <div className="h-1.5 w-32 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${milestone.percent}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-500">{milestone.percent}%</span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="font-semibold text-emerald-400">{formatCurrency(milestone.amount)}</span>
                  <div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full mt-1 inline-block capitalize ${STATUS_STYLES[milestone.status]}`}>
                      {milestone.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
              {renderActions && <div className="mt-3 flex flex-wrap gap-2">{renderActions(milestone)}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
