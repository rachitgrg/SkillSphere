import React from 'react';
import { Link } from 'react-router';
import { Sparkles, Star } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';
import type { GigProposal } from '../../types';
import { formatCurrency, formatTimeAgo, fullName, PROPOSAL_STATUS_VARIANT } from '../../utils/helpers';

interface ProposalCardProps {
  proposal: GigProposal;
  /** AI match score (0–100) for this freelancer on the gig, when available. */
  matchScore?: number;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, matchScore, actions, children }) => {
  const { freelancer, freelancerProfile: profile } = proposal;
  const amount = proposal.finalAmount ?? proposal.proposedAmount;

  return (
    <article className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-5">
      <div className="flex flex-col items-center text-center w-full md:w-52 shrink-0">
        <Avatar src={freelancer.avatar} firstName={freelancer.firstName} lastName={freelancer.lastName} size="lg" className="mb-3" />
        <Link to={`/freelancers/${freelancer._id}`} className="font-medium text-white hover:text-indigo-400">
          {fullName(freelancer)}
        </Link>
        {profile?.title && <p className="text-xs text-slate-400 mb-2">{profile.title}</p>}
        {profile && (
          <p className="flex items-center gap-1 text-xs text-slate-300 mb-3">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            {profile.totalReviews ? `${profile.averageRating.toFixed(1)} (${profile.totalReviews})` : 'New'} · {profile.completedGigs} jobs
          </p>
        )}
        {matchScore !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs px-2.5 py-1 mb-3">
            <Sparkles className="w-3 h-3" /> {Math.round(matchScore)}% match
          </span>
        )}
        <div className="w-full grid grid-cols-2 gap-2 text-sm border-t border-slate-800 pt-3">
          <div>
            <div className="text-slate-500 text-xs">{proposal.finalAmount !== undefined ? 'Offer' : 'Bid'}</div>
            <div className="text-emerald-400 font-semibold">{formatCurrency(amount)}</div>
          </div>
          <div>
            <div className="text-slate-500 text-xs">Time</div>
            <div className="text-white font-semibold">{proposal.estimatedDuration}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-5 flex flex-col min-w-0">
        <div className="flex justify-between items-start mb-3 gap-3">
          <h3 className="font-semibold text-white">Cover letter</h3>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500">{formatTimeAgo(proposal.createdAt)}</span>
            <Badge variant={PROPOSAL_STATUS_VARIANT[proposal.status]} className="capitalize">
              {proposal.status}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-line">{proposal.coverLetter}</p>
        {proposal.milestones.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Proposed milestones</h4>
            <ul className="text-sm text-slate-300 space-y-1">
              {proposal.milestones.map((m, i) => (
                <li key={m._id ?? i} className="flex justify-between gap-3">
                  <span>{i + 1}. {m.title}</span>
                  <span className="text-slate-400">{formatCurrency(m.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {children}
        {actions && <div className="flex flex-wrap justify-end gap-2 mt-auto pt-4">{actions}</div>}
      </div>
    </article>
  );
};
