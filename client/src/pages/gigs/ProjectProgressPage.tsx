import React from 'react';
import { MilestoneTimeline } from '../../components/gigs/MilestoneTimeline';

export const ProjectProgressPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Project Progress</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <MilestoneTimeline milestones={[
          { id: '1', title: 'Design phase', amount: 500, status: 'completed', dueDate: 'Oct 1' },
          { id: '2', title: 'Development phase', amount: 1500, status: 'in_progress', dueDate: 'Oct 15' },
        ]} />
      </div>
    </div>
  );
};
