import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { StarRating } from '../common/StarRating';
import { reviewApi } from '../../api/reviewApi';
import type { ReviewCategories } from '../../types';
import { getErrorMessage } from '../../utils/helpers';

/** Same weights as the server (Review model): quality 30 %, communication 20 %, timeliness 20 %, professionalism 15 %, value 15 %. */
const CATEGORIES: { key: keyof ReviewCategories; label: string; weight: number }[] = [
  { key: 'quality', label: 'Quality of work', weight: 0.3 },
  { key: 'communication', label: 'Communication', weight: 0.2 },
  { key: 'timeliness', label: 'Timeliness', weight: 0.2 },
  { key: 'professionalism', label: 'Professionalism', weight: 0.15 },
  { key: 'value', label: 'Value for money', weight: 0.15 },
];

/** Review for the other party of a completed gig (the reviewee is derived on the server). */
export function WriteReviewModal({ isOpen, onClose, gigId, revieweeName }: { isOpen: boolean; onClose: () => void; gigId: string; revieweeName: string }) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState<ReviewCategories>({ quality: 5, communication: 5, timeliness: 5, professionalism: 5, value: 5 });
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const overall = CATEGORIES.reduce((sum, c) => sum + scores[c.key] * c.weight, 0);

  const submit = async () => {
    if (comment.trim().length < 20) return toast.error('Write at least a couple of sentences (20+ characters)');
    setSaving(true);
    try {
      const review = await reviewApi.create({ gigId, categories: scores, comment: comment.trim() });
      toast.success(review.isVisible ? 'Thanks for your review!' : 'Thanks — your review will appear after a quick moderation check.');
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['gigs'] }), queryClient.invalidateQueries({ queryKey: ['reviews'] })]);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Review ${revieweeName}`} size="md">
      <div className="space-y-4">
        <ul className="space-y-2">
          {CATEGORIES.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300">{c.label}</span>
              <StarRating rating={scores[c.key]} interactive onChange={(value) => setScores({ ...scores, [c.key]: value })} />
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-400">
          Overall (weighted): <span className="text-white font-semibold">{overall.toFixed(2)}</span> / 5
        </p>
        <label htmlFor="review-comment" className="block text-sm font-medium text-dark-300">Your review</label>
        <textarea
          id="review-comment"
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What went well? What could be better?"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Later</Button>
          <Button onClick={submit} isLoading={saving}>Submit review</Button>
        </div>
      </div>
    </Modal>
  );
}
