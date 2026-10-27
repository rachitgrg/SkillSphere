import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showValue?: boolean;
}

const sizeClasses = {
  sm: 'w-3.5 h-3.5',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

/** Read-only: one labelled image ("Rated 4.5 out of 5"). Interactive: one named toggle button per star. */
export function StarRating({ rating, maxRating = 5, size = 'md', interactive = false, onChange, showValue = false }: StarRatingProps) {
  const star = (i: number) => (
    <Star
      aria-hidden="true"
      className={`
        ${sizeClasses[size]}
        ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-dark-600'}
        transition-colors
      `}
    />
  );

  return (
    <div className="flex items-center gap-1">
      {interactive ? (
        <div role="group" aria-label="Rating" className="flex items-center gap-1">
          {Array.from({ length: maxRating }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} star${i === 0 ? '' : 's'}`}
              aria-pressed={Math.round(rating) === i + 1}
              onClick={() => onChange?.(i + 1)}
              className="cursor-pointer hover:scale-110 transition-transform focus-ring rounded"
            >
              {star(i)}
            </button>
          ))}
        </div>
      ) : (
        <span role="img" aria-label={`Rated ${Number(rating.toFixed(1))} out of ${maxRating}`} className="flex items-center gap-1">
          {Array.from({ length: maxRating }, (_, i) => (
            <span key={i}>{star(i)}</span>
          ))}
        </span>
      )}
      {showValue && (
        <span className="text-sm font-medium text-dark-300 ml-1" aria-hidden="true">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
