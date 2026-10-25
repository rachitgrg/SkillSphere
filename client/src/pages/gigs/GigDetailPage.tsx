import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  IndianRupee,
  MapPin,
  MessageSquare,
  Paperclip,
  Share2,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Avatar } from '../../components/common/Avatar';
import { Badge } from '../../components/common/Badge';
import { Spinner } from '../../components/common/Spinner';
import { MilestoneTimeline } from '../../components/gigs/MilestoneTimeline';
import { ApplyModal } from './ApplyModal';
import { useGig } from '../../hooks/queries/useMarketplace';
import { useMyProposals } from '../../hooks/queries/useProposals';
import { useClientProfile } from '../../hooks/queries/useProfiles';
import { useStartConversation } from '../../hooks/queries/useChat';
import { useAppSelector } from '../../hooks/useRedux';
import type { Proposal, UserSummary } from '../../types';
import {
  EXPERIENCE_LABELS,
  LOCATION_TYPE_LABELS,
  formatBudget,
  formatCurrency,
  formatDate,
  formatTimeAgo,
  fullName,
  getErrorMessage,
  populated,
  refId,
} from '../../utils/helpers';

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Awaiting admin approval',
  rejected: 'Not approved',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
};

export const GigDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);
  const [isApplyOpen, setIsApplyOpen] = useState(false);

  const gigQuery = useGig(id);
  const gig = gigQuery.data;
  const client = populated<UserSummary>(gig?.client);
  const clientProfile = useClientProfile(refId(gig?.client));

  const isFreelancer = user?.role === 'freelancer';
  const isOwner = Boolean(user && gig && refId(gig.client) === user._id);
  const isHired = Boolean(user && gig && refId(gig.selectedFreelancer) === user._id);
  const myProposals = useMyProposals({ limit: 50 }, isFreelancer);
  const myProposal: Proposal | undefined = myProposals.data?.items.find((p) => refId(p.gig as { _id: string }) === id);
  const startConversation = useStartConversation();

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const messageClient = async () => {
    if (!gig || !client) return;
    try {
      const conversation = await startConversation.mutateAsync({ participantId: client._id, gigId: gig._id });
      navigate(`/chat?c=${conversation._id}`);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not open the conversation'));
    }
  };

  if (gigQuery.isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (gigQuery.isError || !gig) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950">
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center px-4 text-center pt-16">
          <AlertTriangle className="w-10 h-10 text-amber-400 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Gig not found</h1>
          <p className="text-slate-400 mb-6">It may have been removed, filled, or isn&apos;t public yet.</p>
          <Link to="/gigs" className="btn-primary px-5 py-2.5 text-sm">
            <span>Browse open gigs</span>
          </Link>
        </main>
      </div>
    );
  }

  const location = gig.locationType === 'remote' ? 'Remote' : `${LOCATION_TYPE_LABELS[gig.locationType]}${client?.address?.city ? ` · ${client.address.city}` : ''}`;

  /** Primary call to action for the current viewer. */
  const renderAction = () => {
    if (!user) {
      return (
        <Link to="/login" state={{ from: `/gigs/${gig._id}` }} className="btn-primary w-full py-3 text-sm block text-center">
          <span>Log in to apply</span>
        </Link>
      );
    }
    if (isOwner) {
      return (
        <div className="space-y-3">
          <Link to={`/client/gigs/${gig._id}/proposals`} className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2">
            <Users className="w-4 h-4" />
            <span>View proposals ({gig.totalProposals})</span>
          </Link>
          {['in_progress', 'completed'].includes(gig.status) && (
            <Link to={`/projects/${gig._id}`} className="btn-secondary w-full py-3 text-sm block text-center">
              Open project
            </Link>
          )}
        </div>
      );
    }
    if (isHired) {
      return (
        <Link to={`/projects/${gig._id}`} className="btn-primary w-full py-3 text-sm block text-center">
          <span>Open project</span>
        </Link>
      );
    }
    if (isFreelancer && myProposal) {
      return (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-emerald-300">
            <CheckCircle2 className="w-4 h-4" /> Already applied
          </p>
          <p className="text-slate-400 mt-1">
            Your bid: {formatCurrency(myProposal.proposedAmount)} · status <span className="capitalize">{myProposal.status}</span>
          </p>
          <Link to="/freelancer/proposals" className="text-indigo-400 hover:underline text-xs mt-2 inline-block">
            Manage my proposals
          </Link>
        </div>
      );
    }
    if (isFreelancer && gig.status === 'open') {
      return (
        <button onClick={() => setIsApplyOpen(true)} className="btn-primary w-full py-3 text-sm">
          <span>Apply now</span>
        </button>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />
      <main className="flex-grow pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <Link to="/gigs" className="text-sm text-slate-400 hover:text-white mb-4 inline-block">
          ← Back to gigs
        </Link>

        {gig.status !== 'open' && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {STATUS_LABELS[gig.status] ?? gig.status}
            {gig.status === 'rejected' && gig.rejectionReason ? `: ${gig.rejectionReason}` : ''}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <article className="glass-card p-6 sm:p-8 rounded-3xl border border-slate-800">
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-indigo-400 mb-2">
                    {gig.category}
                    {gig.subCategory ? ` · ${gig.subCategory}` : ''}
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{gig.title}</h1>
                </div>
                <button onClick={share} aria-label="Copy link" className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 focus-ring">
                  <Share2 className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6 text-sm text-slate-300">
                <span className="flex items-center"><Clock className="w-4 h-4 mr-1.5 text-indigo-400" /> Posted {formatTimeAgo(gig.createdAt)}</span>
                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-cyan-400" /> {location}</span>
                <span className="flex items-center"><Eye className="w-4 h-4 mr-1.5 text-slate-400" /> {gig.views} {gig.views === 1 ? 'view' : 'views'}</span>
                <span className="flex items-center"><Users className="w-4 h-4 mr-1.5 text-slate-400" /> {gig.totalProposals} {gig.totalProposals === 1 ? 'proposal' : 'proposals'}</span>
              </div>

              <section className="border-t border-slate-800 py-6">
                <h2 className="text-lg font-semibold text-white mb-3">Project description</h2>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{gig.description}</p>
              </section>

              <section className="border-t border-slate-800 py-6">
                <h2 className="text-lg font-semibold text-white mb-3">Skills required</h2>
                <div className="flex flex-wrap gap-2">
                  {gig.skills.map((skill) => (
                    <Link key={skill} to={`/gigs?skills=${encodeURIComponent(skill)}`}>
                      <Badge className="bg-slate-800 text-slate-300 px-3 py-1 text-sm hover:bg-slate-700">{skill}</Badge>
                    </Link>
                  ))}
                </div>
              </section>

              {gig.milestones.length > 0 && (
                <section className="border-t border-slate-800 py-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Milestones</h2>
                  <MilestoneTimeline milestones={gig.milestones} />
                </section>
              )}

              {gig.attachments.length > 0 && (
                <section className="border-t border-slate-800 pt-6">
                  <h2 className="text-lg font-semibold text-white mb-3">Attachments</h2>
                  <ul className="space-y-2">
                    {gig.attachments.map((url) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-indigo-400 hover:underline">
                          <Paperclip className="w-4 h-4" /> {decodeURIComponent(url.split('/').pop() ?? 'Attachment')}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </article>
          </div>

          <aside className="lg:col-span-1 space-y-6">
            <div className="glass-card p-6 rounded-3xl border border-slate-800">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="col-span-2 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <div className="text-slate-400 text-xs flex items-center mb-1">
                    <IndianRupee className="w-3 h-3 mr-1" /> {gig.budgetType === 'hourly' ? 'Hourly rate' : 'Fixed budget'}
                  </div>
                  <div className="text-xl font-bold text-white">{formatBudget(gig)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <div className="text-slate-400 text-xs flex items-center mb-1"><Calendar className="w-3 h-3 mr-1" /> Duration</div>
                  <div className="text-sm font-semibold text-white">{gig.duration}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                  <div className="text-slate-400 text-xs flex items-center mb-1"><Briefcase className="w-3 h-3 mr-1" /> Level</div>
                  <div className="text-sm font-semibold text-white">{EXPERIENCE_LABELS[gig.experienceLevel]}</div>
                </div>
                {gig.deadline && (
                  <div className="col-span-2 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="text-slate-400 text-xs flex items-center mb-1"><FileText className="w-3 h-3 mr-1" /> Deadline</div>
                    <div className="text-sm font-semibold text-white">{formatDate(gig.deadline)}</div>
                  </div>
                )}
              </div>
              {renderAction()}
            </div>

            {client && (
              <div className="glass-card p-6 rounded-3xl border border-slate-800">
                <h2 className="font-semibold text-white mb-4">About the client</h2>
                <div className="flex items-center gap-3 mb-4">
                  <Avatar src={client.avatar} firstName={client.firstName} lastName={client.lastName} size="md" />
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">{fullName(client)}</div>
                    {clientProfile.data?.companyName && <div className="text-xs text-slate-400 truncate">{clientProfile.data.companyName}</div>}
                  </div>
                </div>
                {clientProfile.data && (
                  <dl className="space-y-3 text-sm text-slate-300">
                    {clientProfile.data.paymentVerified && (
                      <div className="flex items-center gap-2 text-emerald-400"><ShieldCheck className="w-4 h-4" /> Payment verified</div>
                    )}
                    <div className="flex justify-between"><dt>Rating</dt><dd className="flex items-center gap-1 text-white">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      {clientProfile.data.totalReviews ? `${clientProfile.data.averageRating.toFixed(1)} (${clientProfile.data.totalReviews})` : 'No reviews yet'}
                    </dd></div>
                    <div className="flex justify-between"><dt>Gigs posted</dt><dd className="font-medium text-white">{clientProfile.data.postedGigs}</dd></div>
                    <div className="flex justify-between"><dt>Total spent</dt><dd className="font-medium text-white">{formatCurrency(clientProfile.data.totalSpent)}</dd></div>
                    {client.address?.city && <div className="flex justify-between"><dt>Location</dt><dd className="text-white">{client.address.city}</dd></div>}
                    <div className="flex justify-between"><dt>Member since</dt><dd className="text-white">{formatDate(clientProfile.data.user.createdAt)}</dd></div>
                  </dl>
                )}
                {user && !isOwner && user.role !== 'admin' && (
                  <button
                    onClick={messageClient}
                    disabled={startConversation.isPending}
                    className="btn-secondary w-full py-2.5 text-sm mt-5 flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" /> Message client
                  </button>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>
      <Footer />

      {isFreelancer && (
        <ApplyModal isOpen={isApplyOpen} onClose={() => setIsApplyOpen(false)} gig={gig} />
      )}
    </div>
  );
};
