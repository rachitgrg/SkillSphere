import React from 'react';
import { StatCard } from '../../components/dashboard/StatCard';
import { RecentActivity } from '../../components/dashboard/RecentActivity';
import { IndianRupee, Clock, CheckCircle2, TrendingUp } from 'lucide-react';
import { MilestoneTimeline } from '../../components/gigs/MilestoneTimeline';
import { ResumeMatcher } from '../../components/freelancer/ResumeMatcher';

export const FreelancerDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Freelancer Dashboard</h1>
        <div className="flex gap-2">
          <button className="btn-secondary px-4 py-2 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-white">Find Work</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Earnings" value="₹24,500" icon={<IndianRupee className="w-6 h-6" />} color="emerald" trend={{ value: 8, isPositive: true }} />
        <StatCard title="Active Projects" value="4" icon={<Clock className="w-6 h-6" />} color="indigo" />
        <StatCard title="Jobs Completed" value="32" icon={<CheckCircle2 className="w-6 h-6" />} color="cyan" />
        <StatCard title="Profile Views" value="1,204" icon={<TrendingUp className="w-6 h-6" />} color="violet" trend={{ value: 24, isPositive: true }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ResumeMatcher />
          
          <div className="glass-card p-6 rounded-2xl border border-slate-800">
            <h3 className="font-semibold text-white mb-4">Current Milestones</h3>
            <MilestoneTimeline milestones={[
              { id: '1', title: 'Frontend Setup', amount: 500, status: 'completed', dueDate: 'Oct 20, 2023' },
              { id: '2', title: 'API Integration', amount: 1200, status: 'in_progress', dueDate: 'Nov 5, 2023' },
              { id: '3', title: 'Final Testing & Launch', amount: 800, status: 'pending', dueDate: 'Nov 15, 2023' }
            ]} />
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <RecentActivity activities={[
            { content: 'New message from TechCorp', time: '1 hour ago' },
            { content: 'Proposal viewed by StartupInc', time: '3 hours ago' },
            { content: 'Earned Top Rated Badge', time: '1 day ago' }
          ]} />
        </div>
      </div>
    </div>
  );
};
