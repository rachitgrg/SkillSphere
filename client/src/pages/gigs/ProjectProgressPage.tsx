import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCircle2, Clock, FileText, MessageSquare, Paperclip, Play, Send, Undo2 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Avatar } from '../../components/common/Avatar';
import { FileUpload } from '../../components/common/FileUpload';
import { MilestoneTimeline } from '../../components/gigs/MilestoneTimeline';
import { TransactionCard } from '../../components/payments/TransactionCard';
import { FundButton } from '../../components/payments/FundButton';
import { WriteReviewModal } from '../../components/reviews/WriteReviewModal';
import { usePaymentConfig, useProjectMutation, useProjectProgress } from '../../hooks/queries/useProject';
import { useConfig } from '../../hooks/queries/useConfig';
import { useStartConversation } from '../../hooks/queries/useChat';
import { gigApi } from '../../api/gigApi';
import { paymentApi } from '../../api/paymentApi';
import type { Attachment, Milestone, Payment, ProjectProgress } from '../../types';
import { formatCurrency, formatDate, formatTimeAgo, fullName, getErrorMessage } from '../../utils/helpers';

const fieldClass = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500';
const DAY = 86_400_000;

const Files = ({ files }: { files: Attachment[] }) =>
  files.length ? (
    <ul className="mt-2 flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f._id ?? f.url}>
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-indigo-300 hover:border-slate-500">
            <Paperclip className="w-3 h-3" /> {f.name}
          </a>
        </li>
      ))}
    </ul>
  ) : null;

const Bar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div>
    <div className="flex justify-between text-xs text-slate-400 mb-1">
      <span>{label}</span>
      <span className="text-white font-medium">{value}%</span>
    </div>
    <div className="h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

/** /projects/:gigId — milestones with role-specific actions, escrow, progress logs and payments. */
export function ProjectProgressPage() {
  const { gigId } = useParams();
  const navigate = useNavigate();
  const project = useProjectProgress(gigId);
  const startConversation = useStartConversation();
  const complete = useProjectMutation(() => gigApi.completeGig(gigId!));
  const [params] = useSearchParams();
  const [reviewing, setReviewing] = useState(params.get('review') === '1');

  const openChat = async (data: ProjectProgress) => {
    const other = data.party === 'client' ? data.gig.selectedFreelancer : data.gig.client;
    try {
      const conversation = await startConversation.mutateAsync({ participantId: other._id, gigId: data.gig._id });
      navigate(`/chat?c=${conversation._id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const data = project.data;
  return (
    <div className="max-w-6xl">
      <QueryState isLoading={project.isLoading} isError={project.isError} error={project.error} onRetry={() => project.refetch()}>
        {data && (
          <>
            <Link to={data.party === 'freelancer' ? '/freelancer/projects' : data.party === 'client' ? '/client/gigs' : '/admin/payments'} className="text-sm text-slate-400 hover:text-white mb-3 inline-block">
              ← Back
            </Link>
            <PageHeader
              title={data.gig.title}
              description={`${fullName(data.gig.client)} (client) · ${fullName(data.gig.selectedFreelancer)} (freelancer) · ${data.gig.status.replace('_', ' ')}`}
              actions={
                <div className="flex flex-wrap gap-2">
                  {data.party !== 'admin' && (
                    <Button size="sm" variant="secondary" icon={<MessageSquare className="w-4 h-4" />} onClick={() => openChat(data)}>
                      Chat
                    </Button>
                  )}
                  <Link to={`/gigs/${data.gig._id}`} className="btn-ghost px-3 py-1.5 text-sm">View gig</Link>
                  {data.party !== 'admin' && data.gig.status === 'in_progress' && (
                    <Link to={`/disputes/new?gig=${data.gig._id}`} className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1 text-rose-300">
                      <AlertTriangle className="w-4 h-4" /> Dispute
                    </Link>
                  )}
                </div>
              }
            />

            {data.gig.status === 'completed' && (
              <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 flex flex-wrap items-center gap-3">
                <CheckCircle2 className="w-4 h-4" />
                <span className="flex-1">Project completed {data.gig.completedAt && formatDate(data.gig.completedAt)}.</span>
                {data.party !== 'admin' && !data.reviewed && (
                  <Button size="sm" onClick={() => setReviewing(true)}>Leave a review</Button>
                )}
                {data.reviewed && <span className="text-xs text-emerald-300">You reviewed this project</span>}
              </div>
            )}

            <section className="glass-card rounded-2xl border border-slate-800 p-5 mb-6 grid sm:grid-cols-2 gap-4">
              <Bar label="Work progress" value={data.progress.progressPercent} color="bg-indigo-500" />
              <Bar label={`Paid out (${formatCurrency(data.progress.approvedAmount)} of ${formatCurrency(data.progress.total)})`} value={data.progress.paidPercent} color="bg-emerald-500" />
            </section>

            <div className="grid lg:grid-cols-5 gap-6">
              <section className="lg:col-span-3 space-y-4">
                <h2 className="text-lg font-semibold text-white">Milestones</h2>
                {data.gig.milestones.length ? (
                  <MilestoneTimeline milestones={data.gig.milestones} renderActions={(m) => <MilestoneActions data={data} milestone={m} />} />
                ) : (
                  <NoMilestones data={data} />
                )}
                {data.party === 'client' && data.gig.status === 'in_progress' && data.gig.milestones.length > 0 && data.gig.milestones.every((m) => m.status === 'approved') && (
                  <Button onClick={() => complete.mutateAsync(undefined).then(() => toast.success('Project completed'), (e) => toast.error(getErrorMessage(e)))} isLoading={complete.isPending}>
                    Complete project
                  </Button>
                )}
              </section>

              <aside className="lg:col-span-2 space-y-6">
                <ProgressLogs data={data} />
                <section>
                  <h2 className="text-lg font-semibold text-white mb-3">Payments</h2>
                  {data.payments.length ? (
                    <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
                      {data.payments.map((p) => (
                        <TransactionCard key={p._id} payment={{ ...p, gig: { _id: data.gig._id, title: milestoneTitle(data, p) } }} viewerRole={data.party === 'freelancer' ? 'freelancer' : 'client'} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No payments yet.</p>
                  )}
                </section>
              </aside>
            </div>
            {data.party !== 'admin' && data.gig.status === 'completed' && !data.reviewed && (
              <WriteReviewModal
                isOpen={reviewing}
                onClose={() => setReviewing(false)}
                gigId={data.gig._id}
                revieweeName={fullName(data.party === 'client' ? data.gig.selectedFreelancer : data.gig.client)}
              />
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}

const milestoneTitle = (data: ProjectProgress, p: Payment) => data.gig.milestones.find((m) => m._id === p.milestone)?.title ?? data.gig.title;

/** Gigs hired without milestones: the client funds an amount, then completes the project. */
function NoMilestones({ data }: { data: ProjectProgress }) {
  const [amount, setAmount] = useState('');
  const complete = useProjectMutation(() => gigApi.completeGig(data.gig._id));
  if (data.party !== 'client' || data.gig.status !== 'in_progress') return <p className="text-sm text-slate-500">This project has no milestones.</p>;
  const value = Number(amount);
  return (
    <div className="glass-card rounded-2xl border border-slate-800 p-5 space-y-3">
      <p className="text-sm text-slate-300">No milestones were defined. Fund the agreed amount into escrow, then complete the project to release it.</p>
      <div className="flex flex-wrap gap-2 items-center">
        <label htmlFor="fund-amount" className="sr-only">Amount (₹)</label>
        <input id="fund-amount" type="number" min={1} placeholder="₹ amount" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${fieldClass} w-40`} />
        {value > 0 && <FundButton input={{ gigId: data.gig._id, amount: value }} amount={value} label="Fund escrow" gigTitle={data.gig.title} />}
        <Button size="sm" variant="secondary" isLoading={complete.isPending} onClick={() => complete.mutateAsync(undefined).then(() => toast.success('Project completed'), (e) => toast.error(getErrorMessage(e)))}>
          Complete project
        </Button>
      </div>
    </div>
  );
}

function MilestoneActions({ data, milestone }: { data: ProjectProgress; milestone: Milestone }) {
  const gigId = data.gig._id;
  const mid = milestone._id!;
  const active = data.gig.status === 'in_progress';
  const payment = data.payments.find((p) => p.milestone === mid && ['escrow', 'disputed'].includes(p.status));
  const autoDays = usePaymentConfig().data?.autoReleaseDays ?? 7;
  const [percent, setPercent] = useState(milestone.percent ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [changes, setChanges] = useState(false);

  const act = useProjectMutation((action: 'start' | 'approve') => gigApi.milestoneAction(gigId, mid, action));
  const saveProgress = useProjectMutation((value: number) => gigApi.setMilestoneProgress(gigId, mid, value));
  const refund = useProjectMutation((paymentId: string) => paymentApi.refund(paymentId, 'Refunded before work started'));
  const run = (p: Promise<unknown>, ok: string) => p.then(() => toast.success(ok), (e) => toast.error(getErrorMessage(e)));

  const submission = milestone.submission && (milestone.submission.note || milestone.submission.attachments.length > 0) && (
    <div className="w-full rounded-lg bg-slate-900/60 border border-slate-800 p-3 text-xs text-slate-300">
      <p className="text-slate-400 mb-1">Delivery {milestone.submittedAt && `· ${formatTimeAgo(milestone.submittedAt)}`}</p>
      {milestone.submission.note && <p className="whitespace-pre-line">{milestone.submission.note}</p>}
      <Files files={milestone.submission.attachments} />
    </div>
  );
  const changeNote = milestone.status === 'changes_requested' && milestone.changeRequest && (
    <p className="w-full text-xs text-rose-300">Changes requested: {milestone.changeRequest.note}</p>
  );
  const dispute = payment && data.party !== 'admin' && active && !['approved'].includes(milestone.status) && (
    <Link to={`/disputes/new?gig=${gigId}&payment=${payment._id}`} className="text-xs text-rose-300 hover:underline self-center">
      {payment.status === 'disputed' ? 'Under dispute' : 'Raise dispute'}
    </Link>
  );

  if (!active) return <>{submission}</>;

  if (data.party === 'client') {
    return (
      <>
        {changeNote}
        {submission}
        {milestone.status === 'pending' && <FundButton input={{ gigId, milestoneId: mid }} amount={milestone.amount} gigTitle={data.gig.title} />}
        {milestone.status === 'funded' && payment && (
          <>
            <span className="text-xs text-cyan-300 self-center">Funded — waiting for the freelancer to start</span>
            <Button size="sm" variant="ghost" icon={<Undo2 className="w-4 h-4" />} isLoading={refund.isPending} onClick={() => run(refund.mutateAsync(payment._id), 'Refunded')}>
              Refund
            </Button>
          </>
        )}
        {milestone.status === 'submitted' && (
          <>
            <Button size="sm" icon={<CheckCircle2 className="w-4 h-4" />} isLoading={act.isPending} onClick={() => run(act.mutateAsync('approve'), 'Approved — payment released')}>
              Approve & release {formatCurrency(milestone.amount)}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setChanges(true)}>Request changes</Button>
            {milestone.submittedAt && (
              <span className="text-[11px] text-slate-500 self-center flex items-center gap-1">
                <Clock className="w-3 h-3" /> auto-approves {formatDate(new Date(new Date(milestone.submittedAt).getTime() + autoDays * DAY).toISOString())}
              </span>
            )}
          </>
        )}
        {dispute}
        <RequestChangesModal isOpen={changes} onClose={() => setChanges(false)} gigId={gigId} milestone={milestone} />
      </>
    );
  }

  if (data.party === 'freelancer') {
    const working = ['in_progress', 'changes_requested'].includes(milestone.status);
    return (
      <>
        {changeNote}
        {submission}
        {milestone.status === 'pending' && <span className="text-xs text-slate-500">Waiting for the client to fund this milestone</span>}
        {milestone.status === 'funded' && (
          <Button size="sm" icon={<Play className="w-4 h-4" />} isLoading={act.isPending} onClick={() => run(act.mutateAsync('start'), 'Milestone started')}>
            Start work
          </Button>
        )}
        {working && (
          <>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Progress
              <input type="range" min={0} max={100} step={5} value={percent} onChange={(e) => setPercent(Number(e.target.value))} aria-label="Milestone progress" />
              <span className="w-8 text-white">{percent}%</span>
            </label>
            {percent !== (milestone.percent ?? 0) && (
              <Button size="sm" variant="ghost" isLoading={saveProgress.isPending} onClick={() => run(saveProgress.mutateAsync(percent), 'Progress saved')}>
                Save
              </Button>
            )}
            <Button size="sm" icon={<Send className="w-4 h-4" />} onClick={() => setSubmitting(true)}>
              {milestone.status === 'changes_requested' ? 'Resubmit' : 'Submit for review'}
            </Button>
          </>
        )}
        {milestone.status === 'submitted' && <span className="text-xs text-amber-300">Awaiting the client's review (auto-approved after {autoDays} days)</span>}
        {dispute}
        <SubmitModal isOpen={submitting} onClose={() => setSubmitting(false)} gigId={gigId} milestone={milestone} />
      </>
    );
  }
  return <>{submission}</>;
}

function SubmitModal({ isOpen, onClose, gigId, milestone }: { isOpen: boolean; onClose: () => void; gigId: string; milestone: Milestone }) {
  const uploadsEnabled = useConfig().data?.uploads ?? false;
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const submit = useProjectMutation(() => gigApi.submitMilestone(gigId, milestone._id!, { note: note.trim() || undefined, files }));
  const send = async () => {
    if (files.length > 5) return toast.error('Attach at most 5 files');
    try {
      await submit.mutateAsync(undefined);
      toast.success('Submitted — the client has been notified');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Submit “${milestone.title}”`} size="lg">
      <div className="space-y-4">
        <label htmlFor="delivery-note" className="block text-sm font-medium text-dark-300">Delivery note</label>
        <textarea id="delivery-note" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} placeholder="What you delivered, how to review it, links…" />
        {uploadsEnabled ? (
          <FileUpload multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip" maxSize={10 * 1024 * 1024} label="Deliverables (up to 5 files)" onFilesSelected={setFiles} />
        ) : (
          <p className="text-xs text-slate-500">File uploads are not configured; include links in the note.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} isLoading={submit.isPending}>Submit</Button>
        </div>
      </div>
    </Modal>
  );
}

function RequestChangesModal({ isOpen, onClose, gigId, milestone }: { isOpen: boolean; onClose: () => void; gigId: string; milestone: Milestone }) {
  const [note, setNote] = useState('');
  const request = useProjectMutation(() => gigApi.requestChanges(gigId, milestone._id!, note.trim()));
  const send = async () => {
    if (note.trim().length < 3) return toast.error('Say what needs to change');
    try {
      await request.mutateAsync(undefined);
      toast.success('Sent back to the freelancer');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Request changes · ${milestone.title}`} size="sm">
      <label htmlFor="changes-note" className="block text-sm font-medium text-dark-300 mb-1.5">What needs to change?</label>
      <textarea id="changes-note" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={`${fieldClass} mb-4`} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={send} isLoading={request.isPending}>Send</Button>
      </div>
    </Modal>
  );
}

function ProgressLogs({ data }: { data: ProjectProgress }) {
  const uploadsEnabled = useConfig().data?.uploads ?? false;
  const [message, setMessage] = useState('');
  const [milestoneId, setMilestoneId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const post = useProjectMutation(() => gigApi.addProgressLog(data.gig._id, { message: message.trim(), milestoneId: milestoneId || undefined, files }));
  const logs = [...data.gig.progressLogs].reverse();
  const canPost = data.party !== 'admin' && data.gig.status === 'in_progress';

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      await post.mutateAsync(undefined);
      setMessage('');
      setFiles([]);
      setShowFiles(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Progress log</h2>
      {canPost && (
        <form onSubmit={send} className="glass-card rounded-2xl border border-slate-800 p-4 space-y-3 mb-4">
          <label htmlFor="log-message" className="sr-only">Update</label>
          <textarea id="log-message" rows={3} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} className={fieldClass} placeholder={data.party === 'freelancer' ? 'Share progress, blockers, previews…' : 'Comment on the progress…'} />
          <div className="flex flex-wrap gap-2 items-center">
            <label htmlFor="log-milestone" className="sr-only">Milestone</label>
            <select id="log-milestone" value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className={`${fieldClass} w-auto flex-1`}>
              <option value="">General</option>
              {data.gig.milestones.map((m) => <option key={m._id} value={m._id}>{m.title}</option>)}
            </select>
            {uploadsEnabled && (
              <button type="button" onClick={() => setShowFiles(!showFiles)} className="p-2 text-slate-400 hover:text-white" aria-label="Attach files">
                <Paperclip className="w-4 h-4" />
              </button>
            )}
            <Button size="sm" type="submit" isLoading={post.isPending} disabled={!message.trim()}>Post</Button>
          </div>
          {showFiles && <FileUpload multiple accept="image/*,.pdf,.doc,.docx,.txt,.zip" maxSize={10 * 1024 * 1024} label="Up to 5 files" onFilesSelected={setFiles} />}
        </form>
      )}
      {logs.length ? (
        <ol className="space-y-3">
          {logs.map((log) => (
            <li key={log._id} className="flex gap-3">
              <Avatar src={log.author.avatar} firstName={log.author.firstName} lastName={log.author.lastName} size="sm" />
              <div className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-400">
                  <span className="text-slate-200 font-medium">{fullName(log.author)}</span> · {formatTimeAgo(log.createdAt)}
                  {log.milestone && ` · ${data.gig.milestones.find((m) => m._id === log.milestone)?.title ?? 'milestone'}`}
                </p>
                <p className="text-sm text-slate-200 mt-1 whitespace-pre-line break-words">{log.message}</p>
                <Files files={log.attachments} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-500 flex items-center gap-2"><FileText className="w-4 h-4" /> No updates yet.</p>
      )}
    </section>
  );
}
