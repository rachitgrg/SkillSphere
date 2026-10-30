import toast from 'react-hot-toast';
import { useAcceptOfferMutation } from '../../hooks/queries/useProposals';
import type { Proposal } from '../../types';
import { getErrorMessage } from '../../utils/helpers';

/** The latest amount on the table (last counter-offer, or the original bid). */
export const currentOffer = (proposal: Proposal) => proposal.finalAmount ?? proposal.proposedAmount;

/** Who made the last counter-offer, if any. */
export const lastOfferBy = (proposal: Proposal) => proposal.negotiationHistory.at(-1)?.proposedBy;

/** The freelancer accepts the client's last counter-offer; the client can then hire at that amount. */
export function useAcceptOffer() {
  const acceptOffer = useAcceptOfferMutation();
  return {
    isPending: acceptOffer.isPending,
    accept: async (proposal: Proposal) => {
      try {
        await acceptOffer.mutateAsync(proposal._id);
        toast.success('Offer accepted. The client can now hire you at this amount.');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Could not accept the offer'));
      }
    },
  };
}
