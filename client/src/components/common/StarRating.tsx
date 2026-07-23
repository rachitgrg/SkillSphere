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

export function StarRating({ rating, maxRating = 5, size = 'md', interactive = false, onChange, showValue = false }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxRating }, (_, i) => (
        <button
          key={i}
          type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(i + 1)}
          className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
        >
          <Star
            className={`
              ${sizeClasses[size]}
              ${i < rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-none text-dark-600'}
              transition-colors
            `}
          />
        </button>
      ))}
      {showValue && (
        <span className="text-sm font-medium text-dark-300 ml-1">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
