import { Link } from 'react-router';
import { CheckCircle2, FileText, IndianRupee, Lock, MailPlus, Sparkles } from 'lucide-react';
import { StatCard } from '../../components/dashboard/StatCard';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { MilestoneTimeline } from '../../components/gigs/MilestoneTimeline';
import { ResumeMatcher } from '../../components/freelancer/ResumeMatcher';
import { useFreelancerAnalytics, useMyGigs, useRecommendations } from '../../hooks/queries/useDashboard';
import { useAppSelector } from '../../hooks/useRedux';
import { useMe } from '../../hooks/queries/useProfiles';
import { useMyInvitations } from '../../hooks/queries/useMarketplace';
import type { FreelancerProfile, UserSummary } from '../../types';
import { formatBudget, formatCurrency, fullName, populated } from '../../utils/helpers';

export function FreelancerDashboard() {
  const user = useAppSelector((s) => s.auth.user);
  const analytics = useFreelancerAnalytics('12m');
  const projects = useMyGigs({ status: ['in_progress'], limit: 3 });
  const recommendations = useRecommendations();
  const me = useMe();
  const invitations = useMyInvitations();
  const pendingInvites = (invitations.data ?? []).filter((i) => i.invitation.status === 'pending');
  const a = analytics.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi, ${user?.firstName ?? ''}`}
        description="Your work, earnings and matches."
        actions={
          <Link to="/gigs" className="btn-primary px-4 py-2 text-sm">
            <span>Find work</span>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Earned" value={a ? formatCurrency(a.earnings.released) : '—'} icon={<IndianRupee className="w-6 h-6" />} color="emerald" />
        <StatCard title="In escrow" value={a ? formatCurrency(a.earnings.pending) : '—'} icon={<Lock className="w-6 h-6" />} color="cyan" />
        <StatCard title="Proposals sent" value={a?.proposals.sent ?? '—'} icon={<FileText className="w-6 h-6" />} color="indigo" />
        <StatCard title="Acceptance rate" value={a ? `${a.proposals.acceptanceRate}%` : '—'} icon={<CheckCircle2 className="w-6 h-6" />} color="violet" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="glass-card p-6 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-white">Active projects</h2>
              <Link to="/freelancer/projects" className="text-xs text-indigo-400 hover:text-indigo-300">View all</Link>
            </div>
            <QueryState
              isLoading={projects.isLoading}
              isError={projects.isError}
              error={projects.error}
              isEmpty={!projects.data?.items.length}
              empty={{ title: 'No active projects', description: 'When a client hires you, the project and its milestones show up here.' }}
            >
              <div className="space-y-6">
                {projects.data?.items.map((gig) => (
                  <div key={gig._id}>
                    <div className="flex justify-between items-baseline mb-3 gap-3">
                      <Link to={`/projects/${gig._id}`} className="font-medium text-white hover:text-indigo-400">{gig.title}</Link>
                      <span className="text-xs text-slate-500 shrink-0">for {fullName(populated<UserSummary>(gig.client as UserSummary))}</span>
                    </div>
                    {gig.milestones.length ? <MilestoneTimeline milestones={gig.milestones} /> : <p className="text-sm text-slate-500">No milestones defined.</p>}
                  </div>
                ))}
              </div>
            </QueryState>
          </section>

          <ResumeMatcher hasStoredResume={Boolean((me.data?.profile as FreelancerProfile | null | undefined)?.resume)} />
        </div>

        <div className="space-y-6 h-fit">
        {pendingInvites.length > 0 && (
          <section className="glass-card p-6 rounded-2xl border border-indigo-500/30">
            <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
              <MailPlus className="w-4 h-4 text-indigo-400" /> Invitations
            </h2>
            <p className="text-xs text-slate-500 mb-4">Clients asked you to apply.</p>
            <ul className="space-y-3">
              {pendingInvites.map(({ gig }) => (
                <li key={gig._id} className="border-b border-slate-800 last:border-0 pb-3 last:pb-0">
                  <Link to={`/gigs/${gig._id}`} className="font-medium text-white hover:text-indigo-400 text-sm">{gig.title}</Link>
                  <p className="text-xs text-slate-400 mt-1">{formatBudget(gig)} · from {fullName(populated<UserSummary>(gig.client as UserSummary))}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="glass-card p-6 rounded-2xl border border-slate-800 h-fit">
          <h2 className="font-semibold text-white mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" /> Recommended for you
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Open gigs ranked by skill fit, distance, budget and your experience
            {recommendations.data?.[0] && (recommendations.data[0].source === 'ai' ? ' · AI semantic match' : ' · skill-overlap match (AI unavailable)')}.
          </p>
          <QueryState
            isLoading={recommendations.isLoading}
            isError={recommendations.isError}
            error={recommendations.error}
            isEmpty={!recommendations.data?.length}
            empty={{ title: 'No matches yet', description: 'Add skills to your profile to get recommendations.' }}
          >
            <ul className="space-y-4">
              {recommendations.data?.map(({ gig, score, matchedSkills, distanceKm }) => (
                <li key={gig._id} className="border-b border-slate-800 last:border-0 pb-4 last:pb-0">
                  <Link to={`/gigs/${gig._id}`} className="font-medium text-white hover:text-indigo-400 text-sm">{gig.title}</Link>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatBudget(gig)}
                    {gig.locationType !== 'remote' && distanceKm !== undefined && ` · ${Math.round(distanceKm)} km away`}
                  </p>
                  <p className="text-xs text-indigo-300 mt-1">
                    {Math.round(score)}% match{matchedSkills.length > 0 && ` · ${matchedSkills.join(', ')}`}
                  </p>
                </li>
              ))}
            </ul>
          </QueryState>
        </section>
        </div>
      </div>
    </div>
  );
}
