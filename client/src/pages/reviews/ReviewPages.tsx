import { useState } from 'react';
import toast from 'react-hot-toast';
import { MessageSquareReply, Star } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryState } from '../../components/common/QueryState';
import { Button } from '../../components/common/Button';
import { ReviewCard } from '../../components/reviews/ReviewCard';
import { ReviewBreakdownChart } from '../../components/reviews/ReviewBreakdownChart';
import { useReviewBreakdown, useUserReviews } from '../../hooks/queries/useProfiles';
import { useAppSelector } from '../../hooks/useRedux';
import { reviewApi } from '../../api/reviewApi';
import { useQueryClient } from '@tanstack/react-query';
import type { Review } from '../../types';
import { getErrorMessage } from '../../utils/helpers';

/** "Reviews" for clients and freelancers: what others said about me, with replies. */
export function ReviewPage() {
  const me = useAppSelector((s) => s.auth.user);
  const reviews = useUserReviews(me?._id);
  const breakdown = useReviewBreakdown(me?._id);

  return (
    <div className="max-w-5xl">
      <PageHeader title="Reviews" description="Feedback from the people you've worked with. You can reply once to each review." />
      <div className="grid lg:grid-cols-3 gap-6">
        <aside className="lg:col-span-1">
          <div className="glass-card rounded-2xl border border-slate-800 p-5">
            <h2 className="font-semibold text-white mb-4">Rating breakdown</h2>
            {breakdown.data ? <ReviewBreakdownChart breakdown={breakdown.data} /> : <p className="text-sm text-slate-500">Loading…</p>}
          </div>
        </aside>
        <section className="lg:col-span-2">
          <QueryState
            isLoading={reviews.isLoading}
            isError={reviews.isError}
            error={reviews.error}
            onRetry={() => reviews.refetch()}
            isEmpty={!reviews.data?.length}
            empty={{ icon: <Star className="w-8 h-8" />, title: 'No reviews yet', description: 'Reviews appear after a gig is completed.' }}
          >
            <div className="space-y-4">
              {reviews.data?.map((review) => (
                <ReviewCard key={review._id} review={review} footer={!review.response && <ReplyBox review={review} />} />
              ))}
            </div>
          </QueryState>
        </section>
      </div>
    </div>
  );
}

function ReplyBox({ review }: { review: Review }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await reviewApi.reply(review._id, text.trim());
      toast.success('Reply posted');
      await queryClient.invalidateQueries({ queryKey: ['reviews'] });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
        <MessageSquareReply className="w-3.5 h-3.5" /> Reply
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-2">
      <label htmlFor={`reply-${review._id}`} className="sr-only">Your reply</label>
      <textarea
        id={`reply-${review._id}`}
        rows={3}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
        placeholder="Thank them or add context — replies are public."
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" onClick={submit} isLoading={saving}>Post reply</Button>
      </div>
    </div>
  );
}
