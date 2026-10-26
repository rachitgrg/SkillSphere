import { useState } from 'react';
import toast from 'react-hot-toast';
import { Flag } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { reviewApi } from '../../api/reviewApi';
import { getErrorMessage } from '../../utils/helpers';

/** Report a review as fake or abusive; it is hidden for admin moderation. */
export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (reason.trim().length < 5) return toast.error('Tell us what is wrong with this review');
    setSending(true);
    try {
      await reviewApi.report(reviewId, reason.trim());
      toast.success('Thanks — an admin will look at it');
      setOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-xs text-slate-500 hover:text-rose-300 flex items-center gap-1">
        <Flag className="w-3 h-3" /> Report
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Report review" size="sm">
        <label htmlFor={`report-${reviewId}`} className="block text-sm font-medium text-dark-300 mb-1.5">Why is this review fake or abusive?</label>
        <textarea id={`report-${reviewId}`} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mb-4" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={send} isLoading={sending}>Report</Button>
        </div>
      </Modal>
    </>
  );
}
