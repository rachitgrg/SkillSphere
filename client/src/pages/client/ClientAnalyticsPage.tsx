import { useState } from 'react';
import { Link } from 'react-router';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileText, IndianRupee, Lock, Users } from 'lucide-react';
import { StatCard } from '../../components/dashboard/StatCard';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { Avatar } from '../../components/common/Avatar';
import { ChartCard, PeriodSelect } from '../../components/charts/AnalyticsParts';
import { chartTheme, inrTick } from '../../components/charts/chartTheme';
import { useClientAnalytics } from '../../hooks/queries/useDashboard';
import type { AnalyticsPeriod, GigStatus } from '../../types';
import { formatCurrency, fullName, GIG_STATUS_META } from '../../utils/helpers';

/** /client/analytics — spending over time, hires, gig pipeline and who the client paid most. */
export function ClientAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('12m');
  const analytics = useClientAnalytics(period);
  const a = analytics.data;

  const pipeline = a
    ? (Object.entries(a.gigs.byStatus) as [GigStatus, number][]).filter(([, count]) => count > 0).map(([status, count]) => ({ name: GIG_STATUS_META[status].label, value: count }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Your spending, hires and hiring pipeline." actions={<PeriodSelect value={period} onChange={setPeriod} />} />
      <QueryState isLoading={analytics.isLoading} isError={analytics.isError} error={analytics.error} onRetry={() => analytics.refetch()}>
        {a && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total spent" value={formatCurrency(a.spending.total)} icon={<IndianRupee className="w-6 h-6" />} color="emerald" />
              <StatCard title="In escrow" value={formatCurrency(a.spending.inEscrow)} icon={<Lock className="w-6 h-6" />} color="cyan" />
              <StatCard title="Freelancers hired" value={a.hires} icon={<Users className="w-6 h-6" />} color="violet" />
              <StatCard title="Proposals received" value={a.proposalsReceived} icon={<FileText className="w-6 h-6" />} color="indigo" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <ChartCard title="Monthly spending">
                <div className="h-64">
                  {a.monthlySpending.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={a.monthlySpending}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                        <XAxis dataKey="month" stroke={chartTheme.axis} fontSize={12} />
                        <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={inrTick} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={chartTheme.tooltip} />
                        <Bar dataKey="total" name="Released" fill={chartTheme.series[0]} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-slate-500">No released payments in this period.</p>
                  )}
                </div>
              </ChartCard>

              <ChartCard title="Gig pipeline">
                <div className="h-64">
                  {pipeline.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pipeline} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2} label={({ name, value }) => `${name} (${value})`}>
                          {pipeline.map((p, i) => <Cell key={p.name} fill={chartTheme.series[i % chartTheme.series.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={chartTheme.tooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No gigs yet. <Link to="/client/gigs/new" className="text-indigo-400 hover:underline">Post your first gig</Link>.
                    </p>
                  )}
                </div>
              </ChartCard>
            </div>

            <ChartCard title="Top freelancers by spend">
              {a.topFreelancers.length ? (
                <ul className="divide-y divide-slate-800">
                  {a.topFreelancers.map((t) => (
                    <li key={t.freelancer._id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                      <Avatar src={t.freelancer.avatar} firstName={t.freelancer.firstName} lastName={t.freelancer.lastName} size="sm" />
                      <Link to={`/freelancers/${t.freelancer._id}`} className="flex-1 min-w-0 truncate text-sm text-white hover:text-indigo-400">{fullName(t.freelancer)}</Link>
                      <span className="text-xs text-slate-500">{t.payments} payment{t.payments === 1 ? '' : 's'}</span>
                      <span className="text-sm font-medium text-emerald-300">{formatCurrency(t.total)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Freelancers you pay appear here once a milestone is released.</p>
              )}
            </ChartCard>
          </>
        )}
      </QueryState>
    </div>
  );
}
