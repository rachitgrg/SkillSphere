import { Link } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, Flag, IndianRupee, Lock, Shield, Users } from 'lucide-react';
import { StatCard } from '../../components/dashboard/StatCard';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { chartTheme, inrTick } from '../../components/charts/chartTheme';
import { useAdminAnalytics, useAdminStats } from '../../hooks/queries/useAdmin';
import { formatCurrency } from '../../utils/helpers';

export function AdminDashboard() {
  const stats = useAdminStats();
  const analytics = useAdminAnalytics('12m');
  const s = stats.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Admin overview" description="Platform health at a glance." />

      <QueryState isLoading={stats.isLoading} isError={stats.isError} error={stats.error} onRetry={() => stats.refetch()}>
        {s && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Platform revenue" value={formatCurrency(s.revenue)} icon={<IndianRupee className="w-6 h-6" />} color="emerald" />
              <StatCard title="Users" value={s.users.total} icon={<Users className="w-6 h-6" />} color="indigo" />
              <StatCard title="Held in escrow" value={formatCurrency(s.inEscrow)} icon={<Lock className="w-6 h-6" />} color="cyan" />
              <StatCard title="Active disputes" value={s.activeDisputes} icon={<AlertCircle className="w-6 h-6" />} color="violet" />
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { to: '/admin/gigs', label: 'Gigs awaiting approval', value: s.gigs.pendingApproval, icon: Shield },
                { to: '/admin/disputes', label: 'Disputes to mediate', value: s.activeDisputes, icon: AlertCircle },
                { to: '/admin/analytics#fraud', label: 'Flagged reviews', value: s.flaggedReviews, icon: Flag },
              ].map(({ to, label, value, icon: Icon }) => (
                <Link key={to} to={to} className="glass-card rounded-2xl border border-slate-800 p-4 flex items-center gap-3 hover:border-indigo-500/40">
                  <Icon className="w-5 h-5 text-indigo-400" />
                  <span className="flex-1 text-sm text-slate-300">{label}</span>
                  <span className={`text-lg font-bold ${value ? 'text-amber-300' : 'text-slate-500'}`}>{value}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </QueryState>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="glass-card p-6 rounded-2xl border border-slate-800">
          <h2 className="font-semibold text-white mb-4">Revenue (platform fees, 12 months)</h2>
          <div className="h-64">
            {analytics.data?.revenueByMonth.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.data.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="month" stroke={chartTheme.axis} fontSize={12} />
                  <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={inrTick} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={chartTheme.tooltip} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke={chartTheme.series[0]} fill={chartTheme.series[0]} fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No released payments yet.</p>
            )}
          </div>
        </section>
        <section className="glass-card p-6 rounded-2xl border border-slate-800">
          <h2 className="font-semibold text-white mb-4">New users</h2>
          <div className="h-64">
            {analytics.data?.userGrowth.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.data.userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="month" stroke={chartTheme.axis} fontSize={12} />
                  <YAxis stroke={chartTheme.axis} fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={chartTheme.tooltip} />
                  <Legend />
                  <Bar dataKey="freelancers" name="Freelancers" stackId="u" fill={chartTheme.series[0]} />
                  <Bar dataKey="clients" name="Clients" stackId="u" fill={chartTheme.series[1]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No sign-ups in this period.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
