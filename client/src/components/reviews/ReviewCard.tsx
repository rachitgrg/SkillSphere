import React from 'react';
import { StarRating } from '../common/StarRating';
import { Avatar } from '../common/Avatar';

export interface ReviewCardData {
  author?: { name?: string; avatar?: string };
  date?: string;
  rating?: number;
  projectTitle?: string;
  comment?: string;
}

export const ReviewCard: React.FC<{ review: ReviewCardData }> = ({ review }) => {
  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-800">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <Avatar src={review.author?.avatar}  />
          <div>
            <h4 className="font-medium text-white">{review.author?.name || 'Client Name'}</h4>
            <p className="text-xs text-slate-400">{review.date || '2 weeks ago'}</p>
          </div>
        </div>
        <StarRating rating={review.rating || 5}  size="sm" />
      </div>
      
      <h5 className="font-medium text-slate-200 mb-2">{review.projectTitle || 'E-commerce Website Development'}</h5>
      <p className="text-sm text-slate-300 leading-relaxed">
        {review.comment || 'Excellent work! Delivered on time and exceeded expectations. Will definitely hire again.'}
      </p>
    </div>
  );
};
