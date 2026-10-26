import { Star } from 'lucide-react';
import type { ReviewBreakdown } from '../../types';

const CATEGORY_LABELS: Record<keyof ReviewBreakdown['categories'], string> = {
  quality: 'Quality',
  communication: 'Communication',
  timeliness: 'Timeliness',
  professionalism: 'Professionalism',
  value: 'Value',
};

/** Star distribution bars and category averages (weights: quality 30%, communication 20%, timeliness 20%, professionalism 15%, value 15%). */
export function ReviewBreakdownChart({ breakdown }: { breakdown: ReviewBreakdown }) {
  if (!breakdown.totalReviews) return <p className="text-sm text-slate-500">No visible reviews yet.</p>;
  const max = Math.max(...Object.values(breakdown.distribution), 1);

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold text-white">{breakdown.overall.toFixed(1)}</span>
        <span className="text-sm text-slate-400 mb-1">/ 5 · {breakdown.totalReviews} {breakdown.totalReviews === 1 ? 'review' : 'reviews'}</span>
        {breakdown.reputationScore > 0 && (
          <span className="ml-auto text-right" title="Reputation score: Bayesian rating, recent reviews weighted higher, job completion rate and verification">
            <span className="block text-2xl font-bold text-indigo-300">{Math.round(breakdown.reputationScore)}</span>
            <span className="block text-[10px] uppercase tracking-wide text-slate-500">Reputation</span>
          </span>
        )}
      </div>

      <ul className="space-y-1.5" aria-label="Rating distribution">
        {([5, 4, 3, 2, 1] as const).map((stars) => (
          <li key={stars} className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-6 flex items-center gap-0.5">{stars}<Star className="w-3 h-3 text-amber-400 fill-amber-400" /></span>
            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-amber-400/80 rounded-full" style={{ width: `${(breakdown.distribution[stars] / max) * 100}%` }} />
            </div>
            <span className="w-6 text-right">{breakdown.distribution[stars]}</span>
          </li>
        ))}
      </ul>

      <dl className="space-y-2">
        {(Object.keys(CATEGORY_LABELS) as (keyof ReviewBreakdown['categories'])[]).map((key) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <dt className="text-slate-400">{CATEGORY_LABELS[key]}</dt>
            <dd className="text-white font-medium">{breakdown.categories[key].toFixed(1)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
