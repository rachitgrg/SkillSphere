import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { proposalApi } from '../../api/proposalApi';
import type { ProposalFormData } from '../../types';
import toast from 'react-hot-toast';

interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  gigId: string;
}

export const ApplyModal: React.FC<ApplyModalProps> = ({ isOpen, onClose, gigId }) => {
  const [formData, setFormData] = useState<ProposalFormData>({
    coverLetter: '',
    bidAmount: 0,
    estimatedDuration: 1,
    durationUnit: 'weeks',
    milestones: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      toast.success('Application submitted');
      setIsSubmitting(false);
      onClose();
    }, 800);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Apply for Gig" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Cover Letter</label>
          <textarea
            required
            rows={4}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
            value={formData.coverLetter}
            onChange={(e) => setFormData({ ...formData, coverLetter: e.target.value })}
            placeholder="Why are you the best fit for this project?"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bid Amount ($)"
            type="number"
            required
            min={1}
            value={formData.bidAmount}
            onChange={(e) => setFormData({ ...formData, bidAmount: Number(e.target.value) })}
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-300">Duration</label>
            <div className="flex gap-2">
              <input
                type="number"
                required
                min={1}
                className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({ ...formData, estimatedDuration: Number(e.target.value) })}
              />
              <select
                className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white focus:outline-none focus:border-indigo-500"
                value={formData.durationUnit}
                onChange={(e) => setFormData({ ...formData, durationUnit: e.target.value as any })}
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} type="button" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Submit Application
          </Button>
        </div>
      </form>
    </Modal>
  );
};
