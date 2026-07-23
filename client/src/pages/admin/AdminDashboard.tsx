import React from 'react';
import { StatCard } from '../../components/dashboard/StatCard';
import { Users, DollarSign, Activity, AlertCircle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Admin Overview</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value="$142,500" icon={<DollarSign className="w-6 h-6" />} color="emerald" trend={{ value: 12, isPositive: true }} />
        <StatCard title="Active Users" value="12,450" icon={<Users className="w-6 h-6" />} color="indigo" trend={{ value: 5, isPositive: true }} />
        <StatCard title="Active Gigs" value="842" icon={<Activity className="w-6 h-6" />} color="cyan" />
        <StatCard title="Open Disputes" value="14" icon={<AlertCircle className="w-6 h-6" />} color="violet" trend={{ value: 2, isPositive: false }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-800 h-80 flex items-center justify-center">
          <p className="text-slate-500">Revenue Chart Placeholder</p>
        </div>
        <div className="glass-card p-6 rounded-2xl border border-slate-800 h-80 flex items-center justify-center">
          <p className="text-slate-500">User Growth Chart Placeholder</p>
        </div>
      </div>
    </div>
  );
};
