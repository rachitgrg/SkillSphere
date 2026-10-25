import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, FileText, IndianRupee, Lock } from 'lucide-react';
import { StatCard } from '../../components/dashboard/StatCard';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { chartTheme, inrTick } from '../../components/charts/chartTheme';
import { ReviewBreakdownChart } from '../../components/reviews/ReviewBreakdownChart';
import { useFreelancerAnalytics } from '../../hooks/queries/useDashboard';
import type { AnalyticsPeriod } from '../../types';
import { formatCurrency } from '../../utils/helpers';

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="glass-card p-6 rounded-2xl border border-slate-800">
    <h2 className="font-semibold text-white mb-4">{title}</h2>
    {children}
  </section>
);

export function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('12m');
  const analytics = useFreelancerAnalytics(period);
  const a = analytics.data;

  const outcomes = a
    ? Object.entries(a.proposals.byStatus).map(([status, count]) => ({ name: status, value: count ?? 0 })).filter((o) => o.value > 0)
    : [];
  const feedback = a
    ? (Object.entries(a.feedback.categories) as [string, number][]).map(([category, score]) => ({ category, score }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="How your proposals, earnings and client feedback are trending."
        actions={
          <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
          </select>
        }
      />
      <QueryState isLoading={analytics.isLoading} isError={analytics.isError} error={analytics.error} onRetry={() => analytics.refetch()}>
        {a && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Earned" value={formatCurrency(a.earnings.released)} icon={<IndianRupee className="w-6 h-6" />} color="emerald" />
              <StatCard title="Pending in escrow" value={formatCurrency(a.earnings.pending)} icon={<Lock className="w-6 h-6" />} color="cyan" />
              <StatCard title="Proposals sent" value={a.proposals.sent} icon={<FileText className="w-6 h-6" />} color="indigo" />
              <StatCard title="Acceptance rate" value={`${a.proposals.acceptanceRate}%`} icon={<CheckCircle2 className="w-6 h-6" />} color="violet" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card title="Monthly revenue">
                <div className="h-64">
                  {a.monthlyRevenue.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={a.monthlyRevenue}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                        <XAxis dataKey="month" stroke={chartTheme.axis} fontSize={12} />
                        <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={inrTick} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={chartTheme.tooltip} />
                        <Bar dataKey="total" name="Released" fill={chartTheme.series[3]} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-slate-500">No released payments in this period.</p>
                  )}
                </div>
              </Card>

              <Card title="Proposal outcomes">
                <div className="h-64">
                  {outcomes.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={outcomes} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2} label={({ name, value }) => `${name} (${value})`}>
                          {outcomes.map((o, i) => <Cell key={o.name} fill={chartTheme.series[i % chartTheme.series.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={chartTheme.tooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-slate-500">No proposals in this period.</p>
                  )}
                </div>
              </Card>

              <Card title="Client feedback by category">
                <div className="h-64">
                  {a.feedback.totalReviews ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={feedback}>
                        <PolarGrid stroke={chartTheme.grid} />
                        <PolarAngleAxis dataKey="category" stroke={chartTheme.axis} fontSize={12} />
                        <PolarRadiusAxis domain={[0, 5]} stroke={chartTheme.axis} fontSize={10} />
                        <Radar dataKey="score" stroke={chartTheme.series[0]} fill={chartTheme.series[0]} fillOpacity={0.35} />
                        <Tooltip contentStyle={chartTheme.tooltip} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-slate-500">Category scores appear after your first review.</p>
                  )}
                </div>
              </Card>

              <Card title="Ratings and winning skills">
                <ReviewBreakdownChart breakdown={a.feedback} />
                {a.topSkills.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-medium text-slate-300 mb-2">Skills on jobs you won</h3>
                    <div className="flex flex-wrap gap-2">
                      {a.topSkills.map((s) => (
                        <span key={s.skill} className="rounded-full bg-indigo-500/10 text-indigo-300 text-xs px-2.5 py-1">
                          {s.skill} · {s.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
