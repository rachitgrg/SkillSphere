import React from 'react';
import { StatCard } from '../../components/dashboard/StatCard';
import { RecentActivity } from '../../components/dashboard/RecentActivity';
import { GigCard } from '../../components/gigs/GigCard';
import { Briefcase, DollarSign, Clock, Users } from 'lucide-react';

export const ClientDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Client Dashboard</h1>
        <button className="btn-primary px-4 py-2 rounded-lg text-sm">+ Post New Gig</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Gigs" value="3" icon={<Briefcase className="w-6 h-6" />} color="indigo" />
        <StatCard title="Total Spent" value="$12,450" icon={<DollarSign className="w-6 h-6" />} color="emerald" trend={{ value: 12, isPositive: true }} />
        <StatCard title="Hours Logged" value="142h" icon={<Clock className="w-6 h-6" />} color="cyan" />
        <StatCard title="Freelancers Hired" value="8" icon={<Users className="w-6 h-6" />} color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 rounded-2xl border border-slate-800">
            <h3 className="font-semibold text-white mb-4">Your Active Gigs</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <GigCard gig={{ id: 1, title: 'React Native App Development', budget: '8000', client: { name: 'You' } }} />
              <GigCard gig={{ id: 2, title: 'UI/UX Design for SaaS', budget: '3500', client: { name: 'You' } }} />
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <RecentActivity activities={[
            { content: 'John D. submitted a proposal', time: '2 hours ago' },
            { content: 'Milestone 1 completed for "React App"', time: 'Yesterday' },
            { content: 'Payment released to Sarah M.', time: 'Oct 24, 2023' }
          ]} />
        </div>
      </div>
    </div>
  );
};
