import toast from 'react-hot-toast';
import { useNegotiateProposal } from '../../hooks/queries/useProposals';
import type { Proposal } from '../../types';
import { getErrorMessage } from '../../utils/helpers';

/** The latest amount on the table (last counter-offer, or the original bid). */
export const currentOffer = (proposal: Proposal) => proposal.finalAmount ?? proposal.proposedAmount;

/** Who made the last counter-offer, if any. */
export const lastOfferBy = (proposal: Proposal) => proposal.negotiationHistory.at(-1)?.proposedBy;

/** Accepts the other party's last counter by echoing it back (it then becomes the agreed amount). */
export function useAcceptOffer() {
  const negotiate = useNegotiateProposal();
  return {
    isPending: negotiate.isPending,
    accept: async (proposal: Proposal) => {
      try {
        await negotiate.mutateAsync({ id: proposal._id, amount: currentOffer(proposal), message: 'Offer accepted' });
        toast.success('Offer accepted. The client can now hire you at this amount.');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Could not accept the offer'));
      }
    },
  };
}
