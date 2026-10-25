import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';
import { getErrorMessage } from '../../utils/helpers';

interface QueryStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  empty?: { title: string; description: string; icon?: ReactNode; action?: { label: string; onClick: () => void } };
  children: ReactNode;
}

/** Loading spinner → error card with retry → empty state → content. */
export function QueryState({ isLoading, isError, error, onRetry, isEmpty, empty, children }: QueryStateProps) {
  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center border border-red-500/20" role="alert">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-white font-medium mb-1">Something went wrong</p>
        <p className="text-sm text-slate-400 mb-5">{getErrorMessage(error)}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn-secondary px-4 py-2 text-sm">
            Try again
          </button>
        )}
      </div>
    );
  }
  if (isEmpty && empty) {
    return (
      <div className="glass-card rounded-2xl border border-slate-800">
        <EmptyState {...empty} />
      </div>
    );
  }
  return <>{children}</>;
}
