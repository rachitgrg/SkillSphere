import { Link } from 'react-router';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bell, Briefcase, IndianRupee, Lock, Plus, Users } from 'lucide-react';
import { StatCard } from '../../components/dashboard/StatCard';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { Badge } from '../../components/common/Badge';
import { useClientAnalytics, useMyGigs, useRecentNotifications } from '../../hooks/queries/useDashboard';
import { useAppSelector } from '../../hooks/useRedux';
import { formatBudget, formatCurrency, formatTimeAgo, GIG_STATUS_META } from '../../utils/helpers';

export function ClientDashboard() {
  const user = useAppSelector((s) => s.auth.user);
  const analytics = useClientAnalytics('12m');
  const activeGigs = useMyGigs({ status: ['open', 'in_progress', 'pending_approval'], limit: 6 });
  const notifications = useRecentNotifications(6);
  const a = analytics.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? ''}`}
        description="Your hiring at a glance."
        actions={
          <Link to="/client/gigs/new" className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Post a gig</span>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active gigs" value={a?.gigs.active ?? '—'} icon={<Briefcase className="w-6 h-6" />} color="indigo" />
        <StatCard title="Total spent" value={a ? formatCurrency(a.spending.total) : '—'} icon={<IndianRupee className="w-6 h-6" />} color="emerald" />
        <StatCard title="In escrow" value={a ? formatCurrency(a.spending.inEscrow) : '—'} icon={<Lock className="w-6 h-6" />} color="cyan" />
        <StatCard title="Freelancers hired" value={a?.hires ?? '—'} icon={<Users className="w-6 h-6" />} color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="glass-card p-6 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-white">Your active gigs</h2>
              <Link to="/client/gigs" className="text-xs text-indigo-400 hover:text-indigo-300">
                View all
              </Link>
            </div>
            <QueryState
              isLoading={activeGigs.isLoading}
              isError={activeGigs.isError}
              error={activeGigs.error}
              onRetry={() => activeGigs.refetch()}
              isEmpty={!activeGigs.data?.items.length}
              empty={{ title: 'No active gigs', description: 'Post a gig to start receiving proposals from nearby freelancers.' }}
            >
              <ul className="divide-y divide-slate-800">
                {activeGigs.data?.items.map((gig) => (
                  <li key={gig._id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={gig.status === 'in_progress' ? `/projects/${gig._id}` : `/client/gigs/${gig._id}/proposals`} className="font-medium text-white hover:text-indigo-400 truncate block">
                        {gig.title}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {formatBudget(gig)} · {gig.totalProposals} {gig.totalProposals === 1 ? 'proposal' : 'proposals'}
                      </p>
                    </div>
                    <Badge variant={GIG_STATUS_META[gig.status].variant}>{GIG_STATUS_META[gig.status].label}</Badge>
                  </li>
                ))}
              </ul>
            </QueryState>
          </section>

          <section className="glass-card p-6 rounded-2xl border border-slate-800">
            <h2 className="font-semibold text-white mb-4">Monthly spending</h2>
            {a && a.monthlySpending.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.monthlySpending}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v))}
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
                    />
                    <Bar dataKey="total" name="Released" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Released payments will appear here month by month.</p>
            )}
          </section>
        </div>

        <section className="glass-card p-6 rounded-2xl border border-slate-800 h-fit">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-white">Recent activity</h2>
            <Link to="/notifications" className="text-xs text-indigo-400 hover:text-indigo-300">
              View all
            </Link>
          </div>
          <QueryState
            isLoading={notifications.isLoading}
            isError={notifications.isError}
            error={notifications.error}
            isEmpty={!notifications.data?.items.notifications.length}
            empty={{ icon: <Bell className="w-8 h-8" />, title: 'Nothing yet', description: 'Proposals, payments and reviews show up here.' }}
          >
            <ul className="space-y-4">
              {notifications.data?.items.notifications.map((n) => (
                <li key={n._id}>
                  <Link to={n.link || '/notifications'} className="block group">
                    <p className={`text-sm ${n.isRead ? 'text-slate-400' : 'text-slate-200'} group-hover:text-white`}>{n.message}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatTimeAgo(n.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </QueryState>
        </section>
      </div>
    </div>
  );
}
