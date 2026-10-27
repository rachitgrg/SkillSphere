import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { AlertTriangle, FileText, Paperclip, Send, ShieldCheck, Upload } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Avatar } from '../../components/common/Avatar';
import { FileUpload } from '../../components/common/FileUpload';
import { useAddDisputeEvidence, useAddDisputeMessage, useDispute, useResolveDispute, useSetDisputeStatus } from '../../hooks/queries/useAdmin';
import { useGig } from '../../hooks/queries/useMarketplace';
import { useConfig } from '../../hooks/queries/useConfig';
import { disputeApi } from '../../api/disputeApi';
import { useAppSelector } from '../../hooks/useRedux';
import type { Dispute, DisputeMessage, DisputePaymentAction, DisputeStatus, Payment, UserSummary } from '../../types';
import { DISPUTE_STATUS_META, formatCurrency, formatDay, formatTimeAgo, fullName, getErrorMessage, PAYMENT_STATUS_META, populated, refId } from '../../utils/helpers';

const fieldClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500';
const FILE_TYPES = 'image/*,.pdf,.doc,.docx,.txt,.zip';
const MB = 1024 * 1024;
const MAX_EVIDENCE_FILES = 10;
const REASONS = ['Work not delivered', 'Work does not match the agreed scope', 'Poor quality deliverables', 'Missed deadline', 'Payment not released', 'Unresponsive party'];
const ACTIVE: DisputeStatus[] = ['open', 'under_review'];

/** Uploads in batches of 5 (the per-request limit). */
const uploadEvidence = async (upload: (files: File[]) => Promise<unknown>, files: File[]) => {
  for (let i = 0; i < files.length; i += 5) await upload(files.slice(i, i + 5));
};

/** /disputes/new?gig=<id>&payment=<id> — opened from a project page; evidence uploads right after creation. */
export function CreateDisputePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const gigId = params.get('gig') ?? undefined;
  const paymentId = params.get('payment') ?? undefined;
  const gig = useGig(gigId);
  const uploadsEnabled = useConfig().data?.uploads ?? false;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [evidenceNote, setEvidenceNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gigId) return;
    if (files.length > MAX_EVIDENCE_FILES) return toast.error(`Attach at most ${MAX_EVIDENCE_FILES} files`);
    setSaving(true);
    try {
      const dispute = await disputeApi.create({ gigId, paymentId, title, description });
      if (files.length) {
        try {
          await uploadEvidence((batch) => disputeApi.addEvidence(dispute._id, batch, evidenceNote.trim() || undefined), files);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Dispute opened, but the evidence did not upload. Add it from the dispute page.'));
        }
      }
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
        <Input label="Reason" required maxLength={200} list="dispute-reasons" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Pick a common reason or describe it briefly" />
        <datalist id="dispute-reasons">
          {REASONS.map((r) => <option key={r} value={r} />)}
        </datalist>
        <div>
          <label htmlFor="dispute-description" className="block text-sm font-medium text-dark-300 mb-1.5">What happened?</label>
          <textarea id="dispute-description" required rows={6} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} />
        </div>
        {uploadsEnabled ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-dark-300">Evidence (optional)</p>
            <FileUpload multiple accept={FILE_TYPES} maxSize={10 * MB} label={`Screenshots, chat exports, files (up to ${MAX_EVIDENCE_FILES})`} onFilesSelected={setFiles} />
            {files.length > 0 && <Input label="What do these files show?" maxLength={500} value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} />}
          </div>
        ) : (
          <p className="text-xs text-slate-500">File uploads are not configured on this server; describe your evidence in the text above.</p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" variant="danger" isLoading={saving}>Open dispute</Button>
        </div>
      </form>
    </div>
  );
}

/** Shared by parties (/disputes/:id) and admins (/admin/disputes/:id). */
export function DisputeDetailPage() {
  const { id } = useParams();
  const me = useAppSelector((s) => s.auth.user);
  const dispute = useDispute(id);
  const d = dispute.data;
  const payment = populated<Payment & { _id: string }>(d?.payment as Payment);
  const gig = populated<{ _id: string; title: string }>(d?.gig as { _id: string; title: string });
  const isAdmin = me?.role === 'admin';
  const active = d ? ACTIVE.includes(d.status) : false;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Dispute" description={gig ? <Link to={`/projects/${gig._id}`} className="text-indigo-400 hover:underline">{gig.title}</Link> : undefined} />
      <QueryState isLoading={dispute.isLoading} isError={dispute.isError} error={dispute.error} onRetry={() => dispute.refetch()}>
        {d && (
          <>
            <section className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{d.title}</h2>
                <Badge variant={DISPUTE_STATUS_META[d.status].variant} className="shrink-0">{DISPUTE_STATUS_META[d.status].label}</Badge>
              </div>
              <StatusSteps status={d.status} />
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

            <EvidenceSection dispute={d} canAdd={active && !isAdmin} />
            <MessageThread dispute={d} myId={me?._id} canPost={active} />

            {!active ? (
              <section className={`glass-card p-6 rounded-2xl border ${d.status === 'resolved' ? 'border-emerald-500/30' : 'border-slate-700'}`}>
                <h3 className="font-semibold text-white mb-2">{d.status === 'resolved' ? 'Resolution' : 'Closed'}</h3>
                <p className="text-sm text-slate-300">{d.resolution}</p>
                {d.resolvedAt && <p className="text-xs text-slate-500 mt-2">{formatDay(d.resolvedAt)}</p>}
                {isAdmin && d.adminNotes && <p className="text-xs text-slate-500 mt-2">Notes: {d.adminNotes}</p>}
              </section>
            ) : isAdmin ? (
              <>
                <StatusActions dispute={d} />
                <ResolveForm disputeId={d._id} payment={payment} />
              </>
            ) : (
              <p className="text-sm text-slate-400">
                {d.status === 'open' ? 'An admin will pick this dispute up shortly.' : 'An admin is reviewing this dispute.'} You&apos;ll be notified when it is resolved.
              </p>
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}

function StatusSteps({ status }: { status: DisputeStatus }) {
  const steps: DisputeStatus[] = ['open', 'under_review', status === 'closed' ? 'closed' : 'resolved'];
  const current = steps.indexOf(status);
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Dispute progress">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          {i > 0 && <span className={`h-px w-6 ${i <= current ? 'bg-indigo-400' : 'bg-slate-700'}`} />}
          <span className={i <= current ? 'text-indigo-300 font-medium' : 'text-slate-500'}>{DISPUTE_STATUS_META[s].label}</span>
        </li>
      ))}
    </ol>
  );
}

function EvidenceSection({ dispute, canAdd }: { dispute: Dispute; canAdd: boolean }) {
  const uploadsEnabled = useConfig().data?.uploads ?? false;
  const add = useAddDisputeEvidence();
  const [picking, setPicking] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState('');

  const upload = async () => {
    if (!files.length) return;
    if (files.length > MAX_EVIDENCE_FILES) return toast.error(`Attach at most ${MAX_EVIDENCE_FILES} files at a time`);
    try {
      await uploadEvidence((batch) => add.mutateAsync({ id: dispute._id, files: batch, description: description.trim() || undefined }), files);
      toast.success('Evidence added');
      setFiles([]);
      setDescription('');
      setPicking(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const showAdd = canAdd && uploadsEnabled;
  if (!dispute.evidence.length && !showAdd) return null;

  return (
    <section className="glass-card p-6 rounded-2xl border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">Evidence</h3>
        {showAdd && !picking && (
          <button type="button" onClick={() => setPicking(true)} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
            <Upload className="w-4 h-4" /> Add evidence
          </button>
        )}
      </div>
      {dispute.evidence.length ? (
        <ul className="space-y-3">
          {dispute.evidence.map((e) => (
            <li key={e._id ?? e.fileUrl} className="text-sm">
              <a href={e.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-indigo-400 hover:underline min-w-0">
                <Paperclip className="w-4 h-4 shrink-0" /> <span className="truncate">{e.name || 'Evidence file'}</span>
              </a>
              <p className="text-xs text-slate-500 mt-0.5">
                {fullName(populated<UserSummary>(e.uploadedBy as UserSummary))} · {formatTimeAgo(e.uploadedAt)}
                {e.description && ` · ${e.description}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No evidence yet.</p>
      )}
      {picking && (
        <div className="mt-4 space-y-3">
          <FileUpload multiple accept={FILE_TYPES} maxSize={10 * MB} label={`Up to ${MAX_EVIDENCE_FILES} files`} onFilesSelected={setFiles} />
          <Input label="What do these files show?" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setPicking(false); setFiles([]); }}>Cancel</Button>
            <Button size="sm" onClick={upload} isLoading={add.isPending} disabled={!files.length}>Upload</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function MessageThread({ dispute, myId, canPost }: { dispute: Dispute; myId?: string; canPost: boolean }) {
  const uploadsEnabled = useConfig().data?.uploads ?? false;
  const send = useAddDisputeMessage();
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showFiles, setShowFiles] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (files.length > 3) return toast.error('Attach at most 3 files');
    try {
      await send.mutateAsync({ id: dispute._id, content: content.trim(), files });
      setContent('');
      setFiles([]);
      setShowFiles(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <section className="glass-card p-6 rounded-2xl border border-slate-800">
      <h3 className="font-semibold text-white mb-1">Mediation thread</h3>
      <p className="text-xs text-slate-500 mb-4">Visible to both parties and SkillSphere support.</p>
      {dispute.messages.length ? (
        <ol className="space-y-3 mb-4">
          {dispute.messages.map((m) => <MessageItem key={m._id} message={m} mine={refId(m.sender as UserSummary) === myId} />)}
        </ol>
      ) : (
        <p className="text-sm text-slate-500 flex items-center gap-2 mb-4"><FileText className="w-4 h-4" /> No messages yet.</p>
      )}
      {canPost && (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="dispute-message" className="sr-only">Message</label>
          <textarea id="dispute-message" rows={3} maxLength={3000} value={content} onChange={(e) => setContent(e.target.value)} className={fieldClass} placeholder="Explain your side, answer questions, propose a settlement…" />
          <div className="flex justify-end gap-2">
            {uploadsEnabled && (
              <button type="button" onClick={() => setShowFiles(!showFiles)} className="p-2 text-slate-400 hover:text-white" aria-label="Attach files">
                <Paperclip className="w-4 h-4" />
              </button>
            )}
            <Button size="sm" type="submit" isLoading={send.isPending} disabled={!content.trim()} icon={<Send className="w-4 h-4" />}>Send</Button>
          </div>
          {showFiles && <FileUpload multiple accept={FILE_TYPES} maxSize={10 * MB} label="Up to 3 files" onFilesSelected={setFiles} />}
        </form>
      )}
    </section>
  );
}

function MessageItem({ message, mine }: { message: DisputeMessage; mine: boolean }) {
  const sender = populated<UserSummary>(message.sender as UserSummary);
  const fromAdmin = sender?.role === 'admin';
  return (
    <li className="flex gap-3">
      <Avatar src={sender?.avatar} firstName={sender?.firstName} lastName={sender?.lastName} size="sm" />
      <div className={`min-w-0 flex-1 rounded-xl border p-3 ${fromAdmin ? 'border-indigo-500/40 bg-indigo-500/10' : mine ? 'border-slate-700 bg-slate-800/50' : 'border-slate-800 bg-slate-900/40'}`}>
        <p className="text-xs text-slate-400 flex items-center gap-1">
          {fromAdmin && <ShieldCheck className="w-3 h-3 text-indigo-300" />}
          <span className="text-slate-200 font-medium">{fromAdmin ? 'SkillSphere support' : mine ? 'You' : fullName(sender)}</span> · {formatTimeAgo(message.createdAt)}
        </p>
        <p className="text-sm text-slate-200 mt-1 whitespace-pre-line break-words">{message.content}</p>
        {message.attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((f) => (
              <li key={f.url}>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-indigo-300 hover:border-slate-500">
                  <Paperclip className="w-3 h-3" /> {f.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/** Admin: take the dispute under review, or close it without a payment decision. */
function StatusActions({ dispute }: { dispute: Dispute }) {
  const setStatus = useSetDisputeStatus();
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState('');

  const run = async (status: 'under_review' | 'closed') => {
    try {
      await setStatus.mutateAsync({ id: dispute._id, status, note: status === 'closed' ? note.trim() || undefined : undefined });
      toast.success(status === 'closed' ? 'Dispute closed; both parties were notified' : 'Marked under review');
      setClosing(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <section className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
      <h3 className="font-semibold text-white">Status</h3>
      <div className="flex flex-wrap gap-2">
        {dispute.status === 'open' && (
          <Button size="sm" variant="secondary" isLoading={setStatus.isPending && !closing} onClick={() => run('under_review')}>Mark under review</Button>
        )}
        {!closing && <Button size="sm" variant="ghost" onClick={() => setClosing(true)}>Close without payment decision</Button>}
      </div>
      {closing && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">Closing dismisses the dispute. A frozen payment goes back to escrow; no money moves.</p>
          <label htmlFor="close-note" className="block text-sm font-medium text-dark-300">Reason (shared with both parties)</label>
          <textarea id="close-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} placeholder="e.g. Parties settled privately" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setClosing(false)}>Cancel</Button>
            <Button size="sm" variant="danger" isLoading={setStatus.isPending} onClick={() => run('closed')}>Close dispute</Button>
          </div>
        </div>
      )}
    </section>
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
