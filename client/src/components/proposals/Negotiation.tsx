import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useNegotiateProposal } from '../../hooks/queries/useProposals';
import type { Proposal } from '../../types';
import { formatCurrency, formatTimeAgo, getErrorMessage } from '../../utils/helpers';

/** The latest amount on the table (last counter-offer, or the original bid). */
export const currentOffer = (proposal: Proposal) => proposal.finalAmount ?? proposal.proposedAmount;

/** Who made the last counter-offer, if any. */
export const lastOfferBy = (proposal: Proposal) => proposal.negotiationHistory.at(-1)?.proposedBy;

/** Chronological list of counter-offers. `meId` labels "You" vs the other party. */
export function NegotiationThread({ proposal, meId, otherLabel }: { proposal: Proposal; meId?: string; otherLabel: string }) {
  if (proposal.negotiationHistory.length === 0) return null;
  return (
    <ol className="space-y-2 border-l-2 border-slate-800 pl-4">
      {proposal.negotiationHistory.map((entry, i) => {
        const mine = entry.proposedBy === meId;
        return (
          <li key={entry._id ?? i} className="text-sm">
            <p className="text-slate-300">
              <span className={mine ? 'text-indigo-300 font-medium' : 'text-amber-300 font-medium'}>{mine ? 'You' : otherLabel}</span>{' '}
              offered <span className="font-semibold text-white">{formatCurrency(entry.amount)}</span>
              <span className="text-xs text-slate-500"> · {formatTimeAgo(entry.createdAt)}</span>
            </p>
            {entry.message && <p className="text-slate-400 text-xs mt-0.5">“{entry.message}”</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function CounterOfferModal({ proposal, isOpen, onClose }: { proposal: Proposal; isOpen: boolean; onClose: () => void }) {
  const negotiate = useNegotiateProposal();
  const [amount, setAmount] = useState(String(currentOffer(proposal)));
  const [message, setMessage] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return toast.error('Enter an amount');
    if (!message.trim()) return toast.error('Add a short message');
    try {
      await negotiate.mutateAsync({ id: proposal._id, amount: value, message: message.trim() });
      toast.success('Counter-offer sent');
      setMessage('');
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not send the offer'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Counter-offer" size="sm">
      <p className="text-sm text-slate-400 mb-4">Current offer: {formatCurrency(currentOffer(proposal))}</p>
      <form onSubmit={submit} className="space-y-4">
        <Input label="Your offer (₹)" type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div>
          <label htmlFor="counter-message" className="block text-sm font-medium text-dark-300 mb-1.5">
            Message
          </label>
          <textarea
            id="counter-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Explain the scope or price change"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={negotiate.isPending}>
            Send offer
          </Button>
        </div>
      </form>
    </Modal>
  );
}

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
