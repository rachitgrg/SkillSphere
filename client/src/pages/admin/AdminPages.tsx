import { useState } from 'react';
import { Link } from 'react-router';
import toast from 'react-hot-toast';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BadgeCheck, CheckCircle2, Eye, EyeOff, FileText, ScrollText, Shield } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { StatusTabs } from '../../components/common/StatusTabs';
import { Pagination } from '../../components/common/Pagination';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { chartTheme, inrTick } from '../../components/charts/chartTheme';
import {
  useAdminAnalytics,
  useAdminLogs,
  useAdminPayments,
  useApproveGig,
  useDisputes,
  useFraudReport,
  usePendingGigs,
  useRejectGig,
  useSetReviewVisibility,
  useSuspendUser,
  useReviewVerification,
  useVerifications,
} from '../../hooks/queries/useAdmin';
import type { AnalyticsPeriod, DisputeStatus, Gig, PaymentStatus, UserSummary, VerificationRequest } from '../../types';
import {
  DISPUTE_STATUS_META,
  formatBudget,
  formatCurrency,
  formatDay,
  formatTimeAgo,
  fullName,
  getErrorMessage,
  PAYMENT_STATUS_META,
  populated,
} from '../../utils/helpers';

// ───────────────────────── Gig approval ─────────────────────────

export function GigApproval() {
  const [page, setPage] = useState(1);
  const queue = usePendingGigs(page);
  const approve = useApproveGig();
  const [rejecting, setRejecting] = useState<Gig | null>(null);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Gig approval" description="New gigs stay hidden from the marketplace until approved. Oldest first." />
      <QueryState
        isLoading={queue.isLoading}
        isError={queue.isError}
        error={queue.error}
        onRetry={() => queue.refetch()}
        isEmpty={!queue.data?.items.length}
        empty={{ icon: <Shield className="w-8 h-8" />, title: 'Queue is empty', description: 'New gigs from clients will appear here.' }}
      >
        <div className="space-y-4">
          {queue.data?.items.map((gig) => {
            const client = populated<UserSummary>(gig.client as UserSummary);
            return (
              <article key={gig._id} className="glass-card rounded-2xl border border-slate-800 p-5">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/gigs/${gig._id}`} className="font-semibold text-white hover:text-indigo-400">{gig.title}</Link>
                    <p className="text-xs text-slate-500 mt-1">
                      {gig.category} · {formatBudget(gig)} · by {fullName(client)} {client?.email ? `(${client.email})` : ''} · {formatTimeAgo(gig.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => setRejecting(gig)}>Reject</Button>
                    <Button
                      size="sm"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      isLoading={approve.isPending && approve.variables === gig._id}
                      onClick={() => approve.mutate(gig._id, { onSuccess: () => toast.success('Gig approved'), onError: (e) => toast.error(getErrorMessage(e)) })}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-slate-300 mt-3 line-clamp-4 whitespace-pre-line">{gig.description}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">{gig.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
              </article>
            );
          })}
        </div>
        {queue.data && <div className="mt-6"><Pagination currentPage={page} totalPages={queue.data.pagination.pages} onPageChange={setPage} /></div>}
      </QueryState>
      {rejecting && <RejectGigModal gig={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  );
}

function RejectGigModal({ gig, onClose }: { gig: Gig; onClose: () => void }) {
  const reject = useRejectGig();
  const [reason, setReason] = useState('');
  const submit = async () => {
    if (reason.trim().length < 3) return toast.error('Tell the client why');
    try {
      await reject.mutateAsync({ id: gig._id, reason: reason.trim() });
      toast.success('Gig rejected; the client was notified');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
  return (
    <Modal isOpen onClose={onClose} title="Reject gig" size="sm">
      <p className="text-sm text-slate-400 mb-3">{gig.title}</p>
      <label htmlFor="reject-reason" className="block text-sm font-medium text-dark-300 mb-1.5">Reason (shown to the client)</label>
      <textarea id="reject-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mb-4" />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={submit} isLoading={reject.isPending}>Reject</Button>
      </div>
    </Modal>
  );
}

// ───────────────────────── Freelancer verification ─────────────────────────

type VerificationTab = 'pending' | 'verified' | 'rejected';

export function FreelancerVerification() {
  const [status, setStatus] = useState<VerificationTab>('pending');
  const [page, setPage] = useState(1);
  const queue = useVerifications({ status, page });
  const review = useReviewVerification();
  const [rejecting, setRejecting] = useState<VerificationRequest | null>(null);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Freelancer verification" description="Check the ID or portfolio proof, then grant or refuse the verified badge. Oldest first." />
      <StatusTabs
        label="Verification status"
        value={status}
        onChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
        tabs={[
          { value: 'pending', label: 'Pending' },
          { value: 'verified', label: 'Verified' },
          { value: 'rejected', label: 'Rejected' },
        ]}
      />
      <QueryState
        isLoading={queue.isLoading}
        isError={queue.isError}
        error={queue.error}
        onRetry={() => queue.refetch()}
        isEmpty={!queue.data?.items.length}
        empty={{
          icon: <BadgeCheck className="w-8 h-8" />,
          title: 'Nothing here',
          description: status === 'pending' ? 'New verification requests will appear here.' : 'No freelancers in this state.',
        }}
      >
        <div className="space-y-4">
          {queue.data?.items.map((p) => (
            <article key={p._id} className="glass-card rounded-2xl border border-slate-800 p-5">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/freelancers/${p.user._id}`} className="font-semibold text-white hover:text-indigo-400">{fullName(p.user)}</Link>
                  <p className="text-xs text-slate-500 mt-1">
                    {p.title} · {p.user.email} · joined {formatDay(p.user.createdAt)} · {p.completedGigs} jobs ·{' '}
                    {p.totalReviews ? `${p.averageRating.toFixed(1)}★` : 'no reviews'}
                  </p>
                  {p.verification.requestedAt && <p className="text-xs text-slate-500">Requested {formatTimeAgo(p.verification.requestedAt)}</p>}
                </div>
                {status !== 'verified' && (
                  <div className="flex gap-2 shrink-0">
                    {status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => setRejecting(p)}>
                        Reject
                      </Button>
                    )}
                    <Button
                      size="sm"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      isLoading={review.isPending && review.variables?.userId === p.user._id}
                      onClick={() =>
                        review.mutate(
                          { userId: p.user._id },
                          { onSuccess: () => toast.success('Freelancer verified'), onError: (e) => toast.error(getErrorMessage(e)) }
                        )
                      }
                    >
                      Verify
                    </Button>
                  </div>
                )}
              </div>
              {p.verification.message && <p className="text-sm text-slate-300 mt-3 whitespace-pre-line">“{p.verification.message}”</p>}
              {p.verification.note && <p className="text-sm text-red-300 mt-2">Rejected: {p.verification.note}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                {(p.verification.documents ?? []).map((d) =>
                  d.mimeType.startsWith('image/') ? (
                    <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer" className="block focus-ring rounded-lg">
                      <img src={d.url} alt={d.name} className="h-24 w-36 object-cover rounded-lg border border-slate-700" />
                    </a>
                  ) : (
                    <a
                      key={d.url}
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                    >
                      <FileText className="w-4 h-4" /> {d.name}
                    </a>
                  )
                )}
                {p.portfolio.length > 0 && <span className="text-xs text-slate-500 self-center">{p.portfolio.length} portfolio items on profile</span>}
              </div>
            </article>
          ))}
        </div>
        {queue.data && (
          <div className="mt-6">
            <Pagination currentPage={page} totalPages={queue.data.pagination.pages} onPageChange={setPage} />
          </div>
        )}
      </QueryState>
      {rejecting && <RejectVerificationModal request={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  );
}

function RejectVerificationModal({ request, onClose }: { request: VerificationRequest; onClose: () => void }) {
  const review = useReviewVerification();
  const [reason, setReason] = useState('');
  const submit = async () => {
    if (reason.trim().length < 3) return toast.error('Tell the freelancer why');
    try {
      await review.mutateAsync({ userId: request.user._id, reason: reason.trim() });
      toast.success('Request rejected; the freelancer was notified');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
  return (
    <Modal isOpen onClose={onClose} title="Reject verification" size="sm">
      <p className="text-sm text-slate-400 mb-3">{fullName(request.user)}</p>
      <label htmlFor="reject-verification" className="block text-sm font-medium text-dark-300 mb-1.5">
        Reason (shown to the freelancer)
      </label>
      <textarea
        id="reject-verification"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mb-4"
      />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={submit} isLoading={review.isPending}>Reject</Button>
      </div>
    </Modal>
  );
}

// ───────────────────────── Payments ─────────────────────────

export function PaymentMonitoring() {
  const [status, setStatus] = useState<'all' | PaymentStatus>('all');
  const [page, setPage] = useState(1);
  const payments = useAdminPayments({ status: status === 'all' ? undefined : status, page });
  const totals = Object.fromEntries((payments.data?.items.totals ?? []).map((t) => [t._id, t]));
  const payouts = Object.fromEntries((payments.data?.items.payouts ?? []).map((p) => [p._id, p]));

  return (
    <div className="max-w-6xl">
      <PageHeader title="Payment monitoring" description="Every payment on the platform (Razorpay test mode)." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          ['Platform revenue', formatCurrency(payments.data?.items.revenue.totalRevenue ?? 0)],
          ['In escrow', formatCurrency((totals.escrow?.amount ?? 0) + (totals.disputed?.amount ?? 0))],
          ['Released', formatCurrency(totals.released?.amount ?? 0)],
          ['Refunds', `${totals.refunded?.count ?? 0} · ${formatCurrency(totals.refunded?.amount ?? 0)}`],
          ['Payouts processed', `${payouts.processed?.count ?? 0} · ${formatCurrency(payouts.processed?.amount ?? 0)}`],
          ['Payouts queued', `${payouts.queued?.count ?? 0} · ${formatCurrency(payouts.queued?.amount ?? 0)}`],
          ['Failed payments', String(totals.failed?.count ?? 0)],
          ['Disputed', `${totals.disputed?.count ?? 0} · ${formatCurrency(totals.disputed?.amount ?? 0)}`],
        ].map(([label, value]) => (
          <div key={label} className="glass-card rounded-2xl border border-slate-800 p-4">
            <div className="text-xs text-slate-400">{label}</div>
            <div className="text-lg font-bold text-white mt-1">{value}</div>
          </div>
        ))}
      </div>
      <StatusTabs label="Filter payments" value={status} onChange={(s) => { setStatus(s); setPage(1); }} tabs={[
        { value: 'all', label: 'All' },
        { value: 'escrow', label: 'Escrow', count: totals.escrow?.count },
        { value: 'released', label: 'Released', count: totals.released?.count },
        { value: 'disputed', label: 'Disputed', count: totals.disputed?.count },
        { value: 'refunded', label: 'Refunded', count: totals.refunded?.count },
        { value: 'pending', label: 'Pending', count: totals.pending?.count },
        { value: 'failed', label: 'Failed', count: totals.failed?.count },
        { value: 'cancelled', label: 'Cancelled', count: totals.cancelled?.count },
      ]} />
      <QueryState isLoading={payments.isLoading} isError={payments.isError} error={payments.error} onRetry={() => payments.refetch()} isEmpty={!payments.data?.items.payments.length} empty={{ title: 'No payments', description: 'Nothing in this status.' }}>
        <div className="glass-card rounded-2xl border border-slate-800 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 uppercase tracking-wide">
                <th className="p-3">Date</th><th className="p-3">Gig</th><th className="p-3">Client → Freelancer</th><th className="p-3 text-right">Amount</th><th className="p-3 text-right">Fee</th><th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.data?.items.payments.map((p) => {
                const gig = populated<{ _id: string; title: string }>(p.gig as { _id: string; title: string });
                const meta = PAYMENT_STATUS_META[p.status];
                return (
                  <tr key={p._id} className="border-b border-slate-800/50">
                    <td className="p-3 text-slate-400 whitespace-nowrap">{formatDay(p.createdAt)}</td>
                    <td className="p-3 text-white max-w-[220px] truncate">{gig?.title}</td>
                    <td className="p-3 text-slate-300 whitespace-nowrap">{fullName(populated<UserSummary>(p.client as UserSummary))} → {fullName(populated<UserSummary>(p.freelancer as UserSummary))}</td>
                    <td className="p-3 text-right text-white">{formatCurrency(p.amount)}{p.refundedAmount ? <span className="block text-xs text-amber-300">refunded {formatCurrency(p.refundedAmount)}</span> : null}</td>
                    <td className="p-3 text-right text-slate-400">{formatCurrency(p.platformFee)}</td>
                    <td className="p-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {payments.data && <div className="mt-6"><Pagination currentPage={page} totalPages={payments.data.pagination.pages} onPageChange={setPage} /></div>}
      </QueryState>
    </div>
  );
}

// ───────────────────────── Disputes ─────────────────────────

export function DisputeManagement() {
  const [status, setStatus] = useState<'all' | DisputeStatus>('open');
  const [page, setPage] = useState(1);
  const disputes = useDisputes({ status: status === 'all' ? undefined : status, page });

  return (
    <div className="max-w-5xl">
      <PageHeader title="Disputes" description="Review evidence and the mediation thread, then resolve with a refund, release or split." />
      <StatusTabs label="Filter disputes" value={status} onChange={(s) => { setStatus(s); setPage(1); }} tabs={[
        { value: 'open', label: 'Open' },
        { value: 'under_review', label: 'Under review' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'closed', label: 'Closed' },
        { value: 'all', label: 'All' },
      ]} />
      <QueryState isLoading={disputes.isLoading} isError={disputes.isError} error={disputes.error} onRetry={() => disputes.refetch()} isEmpty={!disputes.data?.items.length} empty={{ icon: <AlertTriangle className="w-8 h-8" />, title: 'No disputes here', description: 'Disputes opened by clients or freelancers appear here.' }}>
        <div className="space-y-3">
          {disputes.data?.items.map((d) => (
            <Link key={d._id} to={`/admin/disputes/${d._id}`} className="block glass-card rounded-2xl border border-slate-800 p-5 hover:border-slate-700">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-white truncate">{d.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {populated<{ _id: string; title: string }>(d.gig as { _id: string; title: string })?.title} · {fullName(populated<UserSummary>(d.raisedBy as UserSummary))} vs {fullName(populated<UserSummary>(d.against as UserSummary))} · {formatTimeAgo(d.createdAt)}
                    {` · ${d.evidence.length} evidence · ${d.messages?.length ?? 0} messages`}
                  </p>
                </div>
                <Badge variant={DISPUTE_STATUS_META[d.status].variant} className="shrink-0">{DISPUTE_STATUS_META[d.status].label}</Badge>
              </div>
            </Link>
          ))}
        </div>
        {disputes.data && <div className="mt-6"><Pagination currentPage={page} totalPages={disputes.data.pagination.pages} onPageChange={setPage} /></div>}
      </QueryState>
    </div>
  );
}

// ───────────────────────── Analytics & fraud ─────────────────────────

export function AnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('12m');
  const analytics = useAdminAnalytics(period);
  const a = analytics.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Platform analytics" description="Revenue, activity and marketplace health." actions={
        <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="12m">Last 12 months</option>
        </select>
      } />
      <QueryState isLoading={analytics.isLoading} isError={analytics.isError} error={analytics.error} onRetry={() => analytics.refetch()}>
        {a && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Platform revenue', formatCurrency(a.totalRevenue)],
                ['Active freelancers (30d)', a.activeFreelancers],
                ['Job success rate', `${a.jobSuccessRate}%`],
                ['Completed / cancelled / disputed', `${a.jobOutcomes.completed} / ${a.jobOutcomes.cancelled} / ${a.jobOutcomes.disputed}`],
              ].map(([label, value]) => (
                <div key={label} className="glass-card rounded-2xl border border-slate-800 p-4">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="text-xl font-bold text-white mt-1">{value}</div>
                </div>
              ))}
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <section className="glass-card p-6 rounded-2xl border border-slate-800">
                <h2 className="font-semibold text-white mb-4">Revenue and GMV by month</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={a.revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis dataKey="month" stroke={chartTheme.axis} fontSize={12} />
                      <YAxis stroke={chartTheme.axis} fontSize={12} tickFormatter={inrTick} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={chartTheme.tooltip} />
                      <Line type="monotone" dataKey="gmv" name="GMV" stroke={chartTheme.series[1]} strokeWidth={2} />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke={chartTheme.series[0]} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="glass-card p-6 rounded-2xl border border-slate-800">
                <h2 className="font-semibold text-white mb-4">Top categories</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={a.topCategories} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis type="number" stroke={chartTheme.axis} fontSize={12} allowDecimals={false} />
                      <YAxis type="category" dataKey="category" stroke={chartTheme.axis} fontSize={11} width={120} />
                      <Tooltip contentStyle={chartTheme.tooltip} formatter={(v, name) => (name === 'GMV' ? formatCurrency(Number(v)) : v)} />
                      <Bar dataKey="gigs" name="Gigs" fill={chartTheme.series[2]} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>
          </>
        )}
      </QueryState>
      <FraudSection />
    </div>
  );
}

/** Quick suspend from the fraud report (indefinite, with a fixed reason; adjust from Users). */
function SuspendLink({ user }: { user: { _id: string; isBanned: boolean } }) {
  const suspend = useSuspendUser();
  if (user.isBanned) return <span className="text-xs text-rose-300">suspended</span>;
  return (
    <button
      type="button"
      disabled={suspend.isPending}
      onClick={() =>
        suspend.mutate(
          { id: user._id, reason: 'Suspended after fraud review' },
          { onSuccess: () => toast.success('User suspended'), onError: (e) => toast.error(getErrorMessage(e)) }
        )
      }
      className="text-xs text-rose-400 hover:underline"
    >
      Suspend
    </button>
  );
}

function FraudSection() {
  const fraud = useFraudReport();
  const visibility = useSetReviewVisibility();
  const f = fraud.data;
  const decide = (id: string, isVisible: boolean) =>
    visibility.mutate({ id, isVisible }, { onSuccess: () => toast.success(isVisible ? 'Review shown' : 'Review hidden'), onError: (e) => toast.error(getErrorMessage(e)) });

  return (
    <section id="fraud" className="glass-card p-6 rounded-2xl border border-slate-800 space-y-6">
      <h2 className="font-semibold text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> Fraud detection</h2>
      <QueryState isLoading={fraud.isLoading} isError={fraud.isError} error={fraud.error}>
        {f && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Flagged reviews ({f.flaggedReviews.length})</h3>
              {f.flaggedReviews.length ? (
                <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                  {f.flaggedReviews.map((r) => (
                    <li key={r._id} className="p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0 text-sm">
                        <p className="text-white">{r.rating.toFixed(1)}★ “{r.comment}”</p>
                        <p className="text-xs text-slate-500">{fullName(populated<UserSummary>(r.reviewer as UserSummary))} → {fullName(populated<UserSummary>(r.reviewee as UserSummary))} · {r.flagReason ?? 'Reported by users'} · {r.isVisible ? 'visible' : 'hidden'}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="secondary" icon={<Eye className="w-4 h-4" />} onClick={() => decide(r._id, true)}>Show</Button>
                        <Button size="sm" variant="danger" icon={<EyeOff className="w-4 h-4" />} onClick={() => decide(r._id, false)}>Hide</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">Nothing flagged.</p>}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Users with repeated disputes</h3>
                {f.disputedUsers.length ? (
                  <ul className="text-sm space-y-1">{f.disputedUsers.map((u) => <li key={u._id} className="text-slate-300 flex gap-2 items-center flex-wrap">{fullName(u.user)} ({u.user.email}) · {u.disputes} disputes <SuspendLink user={{ _id: u._id, isBanned: u.user.isBanned }} /></li>)}</ul>
                ) : <p className="text-sm text-slate-500">None.</p>}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Clients with many refunds</h3>
                {f.refundHeavyClients.length ? (
                  <ul className="text-sm space-y-1">{f.refundHeavyClients.map((u) => <li key={u._id} className="text-slate-300 flex gap-2 items-center flex-wrap">{fullName(u.user)} · {u.refunds} refunds · {formatCurrency(u.amount)} <SuspendLink user={{ _id: u._id, isBanned: u.user.isBanned }} /></li>)}</ul>
                ) : <p className="text-sm text-slate-500">None.</p>}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Accounts sharing an IP address</h3>
                {f.sharedIps.length ? (
                  <ul className="text-sm space-y-2">
                    {f.sharedIps.map((group) => (
                      <li key={group.ip} className="rounded-lg border border-slate-800 p-2">
                        <p className="text-xs text-slate-500 mb-1 font-mono">{group.ip}</p>
                        {group.users.map((u) => (
                          <p key={u._id} className="text-slate-300 flex gap-2 items-center flex-wrap">
                            {fullName(u)} <span className="text-xs text-slate-500">({u.role}, {u.email})</span> <SuspendLink user={u} />
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-500">None.</p>}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Repeated failed payments</h3>
                {f.failedPayers.length ? (
                  <ul className="text-sm space-y-1">{f.failedPayers.map((u) => <li key={u._id} className="text-slate-300 flex gap-2 items-center flex-wrap">{fullName(u.user)} · {u.failures} failures · {formatCurrency(u.amount)} <SuspendLink user={{ _id: u._id, isBanned: u.user.isBanned }} /></li>)}</ul>
                ) : <p className="text-sm text-slate-500">None.</p>}
              </div>
            </div>
            <p className="text-xs text-slate-500">Suspend accounts from <Link to="/admin/users" className="text-indigo-400 hover:underline">Users</Link>.</p>
          </>
        )}
      </QueryState>
    </section>
  );
}

// ───────────────────────── Audit logs ─────────────────────────

const ACTIONS = ['user_ban', 'user_unban', 'gig_approve', 'gig_reject', 'dispute_resolve', 'review_visibility', 'freelancer_verify', 'freelancer_reject_verification', 'payment_refund'];

export function AdminLogsPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const logs = useAdminLogs({ action: action || undefined, page });

  return (
    <div className="max-w-5xl">
      <PageHeader title="Audit logs" description="Every admin action with who did it and from where." actions={
        <select aria-label="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
      } />
      <QueryState isLoading={logs.isLoading} isError={logs.isError} error={logs.error} onRetry={() => logs.refetch()} isEmpty={!logs.data?.items.length} empty={{ icon: <ScrollText className="w-8 h-8" />, title: 'No admin actions yet', description: 'Approvals, suspensions and resolutions are recorded here.' }}>
        <ul className="glass-card rounded-2xl border border-slate-800 divide-y divide-slate-800">
          {logs.data?.items.map((log) => (
            <li key={log._id} className="p-4 text-sm flex flex-col sm:flex-row sm:items-center gap-2">
              <Badge variant="secondary" className="capitalize shrink-0">{log.action.replace(/_/g, ' ')}</Badge>
              <span className="flex-1 text-slate-300">{log.details}</span>
              <span className="text-xs text-slate-500 shrink-0">{fullName(log.admin)} · {log.ipAddress ?? '—'} · {formatTimeAgo(log.createdAt)}</span>
            </li>
          ))}
        </ul>
        {logs.data && <div className="mt-6"><Pagination currentPage={page} totalPages={logs.data.pagination.pages} onPageChange={setPage} /></div>}
      </QueryState>
    </div>
  );
}
