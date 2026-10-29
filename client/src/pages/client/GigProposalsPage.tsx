import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MessageSquare, Users } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { StatusTabs } from '../../components/common/StatusTabs';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ProposalCard } from '../../components/proposals/ProposalCard';
import { CounterOfferModal, NegotiationThread } from '../../components/proposals/Negotiation';
import { currentOffer, lastOfferBy } from '../../components/proposals/offers';
import { useGig } from '../../hooks/queries/useMarketplace';
import { useGigProposals, useUpdateProposalStatus } from '../../hooks/queries/useProposals';
import { useStartConversation } from '../../hooks/queries/useChat';
import { keys } from '../../hooks/queries/keys';
import { aiApi } from '../../api/aiApi';
import { useAppSelector } from '../../hooks/useRedux';
import type { GigProposal, ProposalStatus } from '../../types';
import { formatBudget, formatCurrency, fullName, getErrorMessage } from '../../utils/helpers';

type Filter = 'open' | ProposalStatus | 'all';

export function GigProposalsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const gig = useGig(id);
  const proposals = useGigProposals(id);
  const matches = useQuery({
    queryKey: keys.ai.matches(id ?? ''),
    queryFn: () => aiApi.getGigMatches(id!, 50),
    enabled: Boolean(id),
    retry: false,
  });
  const [filter, setFilter] = useState<Filter>('open');

  const all = proposals.data ?? [];
  const isOpen = (p: GigProposal) => p.status === 'pending' || p.status === 'negotiating';
  const shown = all.filter((p) => (filter === 'all' ? true : filter === 'open' ? isOpen(p) : p.status === filter));
  const scoreFor = (freelancerId: string) => matches.data?.find((m) => m.freelancerId?._id === freelancerId)?.score;
  const hiring = gig.data?.status === 'open';
  // Fixed-price milestones are scaled to the agreed price on hire (hourly bids are a rate).
  const milestoneTotal = gig.data?.budgetType === 'fixed' && gig.data.milestones.length ? gig.data.milestones.reduce((sum, m) => sum + m.amount, 0) : undefined;

  return (
    <div className="max-w-5xl">
      <Link to="/client/gigs" className="text-sm text-slate-400 hover:text-white mb-3 inline-block">
        ← My gigs
      </Link>
      <PageHeader
        title={gig.data ? `Proposals · ${gig.data.title}` : 'Proposals'}
        description={gig.data && `${formatBudget(gig.data)} · ${gig.data.duration} · ${gig.data.status.replace('_', ' ')}`}
        actions={
          gig.data && (
            <Link to={`/gigs/${gig.data._id}`} className="btn-secondary px-4 py-2 text-sm">
              View gig
            </Link>
          )
        }
      />
      <StatusTabs
        label="Filter proposals"
        value={filter}
        onChange={setFilter}
        tabs={[
          { value: 'open', label: 'Open', count: all.filter(isOpen).length },
          { value: 'accepted', label: 'Hired', count: all.filter((p) => p.status === 'accepted').length },
          { value: 'rejected', label: 'Rejected', count: all.filter((p) => p.status === 'rejected').length },
          { value: 'all', label: 'All', count: all.length },
        ]}
      />
      <QueryState
        isLoading={proposals.isLoading}
        isError={proposals.isError}
        error={proposals.error}
        onRetry={() => proposals.refetch()}
        isEmpty={shown.length === 0}
        empty={{
          icon: <Users className="w-8 h-8" />,
          title: all.length ? 'Nothing in this tab' : 'No proposals yet',
          description: all.length ? 'Try another tab.' : 'Freelancers will appear here as they apply. You can also invite recommended freelancers from the gig page.',
          action: !all.length && gig.data ? { label: 'View gig', onClick: () => navigate(`/gigs/${gig.data!._id}`) } : undefined,
        }}
      >
        <div className="space-y-4">
          {shown.map((proposal) => (
            <ClientProposal key={proposal._id} proposal={proposal} canHire={hiring} matchScore={scoreFor(proposal.freelancer._id)} milestoneTotal={milestoneTotal} />
          ))}
        </div>
      </QueryState>
    </div>
  );
}

function ClientProposal({ proposal, canHire, matchScore, milestoneTotal }: { proposal: GigProposal; canHire: boolean; matchScore?: number; milestoneTotal?: number }) {
  const me = useAppSelector((s) => s.auth.user?._id);
  const navigate = useNavigate();
  const updateStatus = useUpdateProposalStatus();
  const startConversation = useStartConversation();
  const [counterOpen, setCounterOpen] = useState(false);
  const [confirmHire, setConfirmHire] = useState(false);
  const open = proposal.status === 'pending' || proposal.status === 'negotiating';
  const waitingOnFreelancer = proposal.status === 'negotiating' && lastOfferBy(proposal) === me;

  const setStatus = async (status: 'accepted' | 'rejected') => {
    try {
      await updateStatus.mutateAsync({ id: proposal._id, status });
      toast.success(status === 'accepted' ? `${fullName(proposal.freelancer)} is hired` : 'Proposal rejected');
      setConfirmHire(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const message = async () => {
    try {
      const conversation = await startConversation.mutateAsync({ participantId: proposal.freelancer._id, gigId: (proposal.gig as string) });
      navigate(`/chat?c=${conversation._id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <>
      <ProposalCard
        proposal={proposal}
        matchScore={matchScore}
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<MessageSquare className="w-4 h-4" />} onClick={message}>
              Message
            </Button>
            {open && canHire && (
              <>
                <Button size="sm" variant="secondary" onClick={() => setStatus('rejected')} disabled={updateStatus.isPending}>
                  Reject
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setCounterOpen(true)}>
                  Counter-offer
                </Button>
                <Button size="sm" onClick={() => setConfirmHire(true)}>
                  Hire for {formatCurrency(currentOffer(proposal))}
                </Button>
              </>
            )}
          </>
        }
      >
        {proposal.negotiationHistory.length > 0 && (
          <div className="mb-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Negotiation</h4>
            <NegotiationThread proposal={proposal} meId={me} otherLabel={proposal.freelancer.firstName} />
            {waitingOnFreelancer && <p className="text-xs text-slate-500 mt-2">Waiting for the freelancer to respond.</p>}
          </div>
        )}
      </ProposalCard>

      <CounterOfferModal proposal={proposal} isOpen={counterOpen} onClose={() => setCounterOpen(false)} />
      <Modal isOpen={confirmHire} onClose={() => setConfirmHire(false)} title="Hire this freelancer?" size="sm">
        <p className="text-sm text-slate-300 mb-6">
          You&apos;re hiring <strong className="text-white">{fullName(proposal.freelancer)}</strong> for{' '}
          <strong className="text-white">{formatCurrency(currentOffer(proposal))}</strong>. The gig moves to in progress and all
          other open proposals are declined automatically.
          {milestoneTotal !== undefined && Math.abs(milestoneTotal - currentOffer(proposal)) >= 0.01 && (
            <>
              {' '}Your milestones add up to {formatCurrency(milestoneTotal)}, so each one is scaled to add up to{' '}
              {formatCurrency(currentOffer(proposal))}.
            </>
          )}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmHire(false)}>
            Cancel
          </Button>
          <Button onClick={() => setStatus('accepted')} isLoading={updateStatus.isPending}>
            Hire
          </Button>
        </div>
      </Modal>
    </>
  );
}
