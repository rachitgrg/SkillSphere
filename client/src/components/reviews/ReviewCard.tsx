import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { StarRating } from '../common/StarRating';
import { Avatar } from '../common/Avatar';
import type { Review, UserSummary } from '../../types';
import { formatTimeAgo, fullName, populated } from '../../utils/helpers';

export const ReviewCard: React.FC<{ review: Review; footer?: React.ReactNode }> = ({ review, footer }) => {
  const reviewer = populated<UserSummary>(review.reviewer as UserSummary);
  const gig = populated<{ _id: string; title: string }>(review.gig as { _id: string; title: string });

  return (
    <article className="glass-card p-5 rounded-2xl border border-slate-800">
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={reviewer?.avatar} firstName={reviewer?.firstName} lastName={reviewer?.lastName} size="sm" />
          <div className="min-w-0">
            <h4 className="font-medium text-white truncate">{fullName(reviewer)}</h4>
            <p className="text-xs text-slate-400">{formatTimeAgo(review.createdAt)}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <StarRating rating={review.rating} size="sm" />
          <span className="text-xs text-slate-400">{review.rating.toFixed(1)}</span>
        </div>
      </div>

      {gig && (
        <p className="text-xs text-emerald-400 flex items-center gap-1 mb-2">
          <BadgeCheck className="w-3.5 h-3.5" /> Verified hire · {gig.title}
        </p>
      )}
      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{review.comment}</p>

      {review.response && (
        <div className="mt-3 border-l-2 border-indigo-500/40 pl-3">
          <p className="text-xs text-slate-500 mb-0.5">Response</p>
          <p className="text-sm text-slate-300">{review.response}</p>
        </div>
      )}
      {footer}
    </article>
  );
};
