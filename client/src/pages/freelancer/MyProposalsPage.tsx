import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import toast from 'react-hot-toast';
import { FileText } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { StatusTabs } from '../../components/common/StatusTabs';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { CounterOfferModal, NegotiationThread } from '../../components/proposals/Negotiation';
import { currentOffer, lastOfferBy, useAcceptOffer } from '../../components/proposals/offers';
import { useMyProposals, useWithdrawProposal } from '../../hooks/queries/useProposals';
import { useAppSelector } from '../../hooks/useRedux';
import type { Gig, Proposal, ProposalStatus } from '../../types';
import { formatCurrency, formatTimeAgo, getErrorMessage, populated, PROPOSAL_STATUS_VARIANT } from '../../utils/helpers';

type Filter = 'all' | ProposalStatus;

const TABS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export function MyProposalsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const query = useMyProposals({ status: filter === 'all' ? undefined : [filter], limit: 50 });
  const proposals = query.data?.items ?? [];
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl">
      <PageHeader title="My proposals" description="Track your applications, respond to counter-offers and withdraw bids." />
      <StatusTabs label="Filter proposals" tabs={TABS} value={filter} onChange={setFilter} />
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => query.refetch()}
        isEmpty={proposals.length === 0}
        empty={{
          icon: <FileText className="w-8 h-8" />,
          title: filter === 'all' ? 'No proposals yet' : `No ${filter} proposals`,
          description: 'Find a gig that matches your skills and send your first proposal.',
          action: { label: 'Browse gigs', onClick: () => navigate('/gigs') },
        }}
      >
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <MyProposalRow key={proposal._id} proposal={proposal} />
          ))}
        </div>
      </QueryState>
    </div>
  );
}

function MyProposalRow({ proposal }: { proposal: Proposal }) {
  const me = useAppSelector((s) => s.auth.user?._id);
  const gig = populated<Gig>(proposal.gig as Gig);
  const withdraw = useWithdrawProposal();
  const acceptOffer = useAcceptOffer();
  const [counterOpen, setCounterOpen] = useState(false);
  const open = proposal.status === 'pending' || proposal.status === 'negotiating';
  const agreed = proposal.status === 'negotiating' && Boolean(proposal.agreedAt);
  const theirMove = proposal.status === 'negotiating' && lastOfferBy(proposal) !== me && !agreed;

  const onWithdraw = async () => {
    try {
      await withdraw.mutateAsync(proposal._id);
      toast.success('Proposal withdrawn');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <article className="glass-card rounded-2xl border border-slate-800 p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          {gig ? (
            <Link to={`/gigs/${gig._id}`} className="font-semibold text-white hover:text-indigo-400">
              {gig.title}
            </Link>
          ) : (
            <span className="font-semibold text-white">Gig</span>
          )}
          <p className="text-xs text-slate-500 mt-1">Submitted {formatTimeAgo(proposal.createdAt)} · {proposal.estimatedDuration}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs text-slate-500">{proposal.finalAmount !== undefined ? 'Current offer' : 'Your bid'}</div>
            <div className="font-semibold text-emerald-400">{formatCurrency(currentOffer(proposal))}</div>
          </div>
          <Badge variant={PROPOSAL_STATUS_VARIANT[proposal.status]} className="capitalize">
            {proposal.status}
          </Badge>
        </div>
      </div>

      <p className="text-sm text-slate-300 mt-3 line-clamp-2">{proposal.coverLetter}</p>

      {proposal.negotiationHistory.length > 0 && (
        <div className="mt-4">
          <NegotiationThread proposal={proposal} meId={me} otherLabel="Client" />
        </div>
      )}

      {theirMove && (
        <p className="mt-3 text-sm text-amber-300">The client sent a counter-offer — accept it or reply with your own.</p>
      )}
      {agreed && (
        <p className="mt-3 text-sm text-emerald-300">
          You agreed to {formatCurrency(currentOffer(proposal))}. Waiting for the client to hire you.
        </p>
      )}

      {(open || proposal.status === 'accepted') && (
        <div className="mt-4 flex flex-wrap gap-2">
          {theirMove && (
            <Button size="sm" onClick={() => acceptOffer.accept(proposal)} isLoading={acceptOffer.isPending}>
              Accept {formatCurrency(currentOffer(proposal))}
            </Button>
          )}
          {open && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setCounterOpen(true)}>
                Counter-offer
              </Button>
              <Button size="sm" variant="ghost" onClick={onWithdraw} isLoading={withdraw.isPending}>
                Withdraw
              </Button>
            </>
          )}
          {proposal.status === 'accepted' && gig && (
            <Link to={`/projects/${gig._id}`} className="btn-primary px-4 py-1.5 text-sm">
              <span>Open project</span>
            </Link>
          )}
        </div>
      )}

      <CounterOfferModal proposal={proposal} isOpen={counterOpen} onClose={() => setCounterOpen(false)} />
    </article>
  );
}
