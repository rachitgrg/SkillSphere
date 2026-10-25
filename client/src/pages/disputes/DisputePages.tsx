import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useDispute, useResolveDispute } from '../../hooks/queries/useAdmin';
import { useGig } from '../../hooks/queries/useMarketplace';
import { disputeApi } from '../../api/disputeApi';
import { useAppSelector } from '../../hooks/useRedux';
import type { DisputePaymentAction, Payment, UserSummary } from '../../types';
import { formatCurrency, formatDay, fullName, getErrorMessage, PAYMENT_STATUS_META, populated } from '../../utils/helpers';

const fieldClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500';

/** /disputes/new?gig=<id>&payment=<id> — opened from a project page. Evidence upload arrives with plan 4.13. */
export function CreateDisputePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const gigId = params.get('gig') ?? undefined;
  const paymentId = params.get('payment') ?? undefined;
  const gig = useGig(gigId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gigId) return;
    setSaving(true);
    try {
      const dispute = await disputeApi.create({ gigId, paymentId, title, description });
      toast.success('Dispute opened; an admin will review it');
      navigate(`/disputes/${dispute._id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not open the dispute'));
    } finally {
      setSaving(false);
    }
  };

  if (!gigId) {
    return <PageHeader title="Open a dispute" description="Open disputes from the project page of the gig in question." />;
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Open a dispute" description={gig.data ? `About “${gig.data.title}”` : undefined} />
      <form onSubmit={submit} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {paymentId ? 'The escrowed payment is frozen until an admin resolves the dispute.' : 'An admin will mediate between you and the other party.'}
        </div>
        <Input label="Summary" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Milestone delivered incomplete" />
        <div>
          <label htmlFor="dispute-description" className="block text-sm font-medium text-dark-300 mb-1.5">What happened?</label>
          <textarea id="dispute-description" required rows={6} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" variant="danger" isLoading={saving}>Open dispute</Button>
        </div>
      </form>
    </div>
  );
}

export function DisputeDetailPage() {
  const { id } = useParams();
  const me = useAppSelector((s) => s.auth.user);
  const dispute = useDispute(id);
  const d = dispute.data;
  const payment = populated<Payment & { _id: string }>(d?.payment as Payment);
  const gig = populated<{ _id: string; title: string }>(d?.gig as { _id: string; title: string });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Dispute" description={gig ? <Link to={`/projects/${gig._id}`} className="text-indigo-400 hover:underline">{gig.title}</Link> : undefined} />
      <QueryState isLoading={dispute.isLoading} isError={dispute.isError} error={dispute.error} onRetry={() => dispute.refetch()}>
        {d && (
          <>
            <section className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{d.title}</h2>
                <Badge variant={d.status === 'resolved' ? 'success' : 'warning'} className="capitalize shrink-0">{d.status.replace('_', ' ')}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                Opened by {fullName(populated<UserSummary>(d.raisedBy as UserSummary))} against {fullName(populated<UserSummary>(d.against as UserSummary))} · {formatDay(d.createdAt)}
              </p>
              <p className="text-sm text-slate-300 whitespace-pre-line">{d.description}</p>
              {payment && (
                <p className="text-sm text-slate-400">
                  Payment: {formatCurrency(payment.amount)} · {PAYMENT_STATUS_META[payment.status].label}
                </p>
              )}
            </section>

            {d.status === 'resolved' ? (
              <section className="glass-card p-6 rounded-2xl border border-emerald-500/30">
                <h3 className="font-semibold text-white mb-2">Resolution</h3>
                <p className="text-sm text-slate-300">{d.resolution}</p>
                {d.adminNotes && <p className="text-xs text-slate-500 mt-2">Notes: {d.adminNotes}</p>}
              </section>
            ) : me?.role === 'admin' ? (
              <ResolveForm disputeId={d._id} payment={payment} />
            ) : (
              <p className="text-sm text-slate-400">An admin is reviewing this dispute. You&apos;ll be notified when it is resolved.</p>
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}

function ResolveForm({ disputeId, payment }: { disputeId: string; payment?: Payment }) {
  const resolve = useResolveDispute();
  const [resolution, setResolution] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [action, setAction] = useState<'' | DisputePaymentAction>('');
  const [refundAmount, setRefundAmount] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await resolve.mutateAsync({
        id: disputeId,
        input: {
          resolution,
          adminNotes: adminNotes || undefined,
          paymentAction: action || undefined,
          refundAmount: action === 'split' ? Number(refundAmount) : undefined,
        },
      });
      toast.success('Dispute resolved; both parties were notified');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not resolve'));
    }
  };

  return (
    <form onSubmit={submit} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
      <h3 className="font-semibold text-white">Resolve</h3>
      {payment && (
        <fieldset className="space-y-2 text-sm text-slate-300">
          <legend className="text-sm font-medium text-dark-300 mb-1">Payment ({formatCurrency(payment.amount)})</legend>
          {[
            ['', 'No payment change'],
            ['refund', 'Refund the client in full'],
            ['release', 'Release to the freelancer'],
            ['split', 'Split: refund part, release the rest'],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input type="radio" name="payment-action" value={value} checked={action === value} onChange={() => setAction(value as typeof action)} /> {label}
            </label>
          ))}
          {action === 'split' && (
            <Input label="Refund to client (₹)" type="number" min={1} max={payment.amount - 1} required value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
          )}
        </fieldset>
      )}
      <div>
        <label htmlFor="resolution" className="block text-sm font-medium text-dark-300 mb-1.5">Decision (shared with both parties)</label>
        <textarea id="resolution" required rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="admin-notes" className="block text-sm font-medium text-dark-300 mb-1.5">Internal notes</label>
        <textarea id="admin-notes" rows={2} value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className={fieldClass} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" isLoading={resolve.isPending}>Resolve dispute</Button>
      </div>
    </form>
  );
}
