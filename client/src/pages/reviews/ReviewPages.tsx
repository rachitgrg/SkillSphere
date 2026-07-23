import React from 'react';
import { ReviewCard } from '../../components/reviews/ReviewCard';

export const ReviewPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Reviews</h1>
      <div className="grid gap-4">
        <ReviewCard review={{ author: { name: 'Client A' }, rating: 5, projectTitle: 'App Dev', comment: 'Great job!' }} />
      </div>
    </div>
  );
};

export const WriteReviewPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Write a Review</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <p className="text-slate-400">Review form goes here.</p>
      </div>
    </div>
  );
};
