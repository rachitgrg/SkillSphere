import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Changing this (e.g. the route path) clears the error, so navigating away recovers. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/** A failed lazy chunk usually means a new deploy replaced the old files; a reload fixes it. */
const isChunkError = (error: Error) => /dynamically imported module|Loading chunk|Importing a module script failed/i.test(error.message);

/** Catches render errors anywhere below it and shows a recoverable error page instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkError(error);
    return (
      <div role="alert" className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="glass-card-static max-w-md w-full p-8 text-center rounded-2xl border border-red-500/20">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">{chunk ? 'A new version is available' : 'Something went wrong'}</h1>
          <p className="text-sm text-slate-400 mb-6">
            {chunk ? 'Reload the page to get the latest version of SkillSphere.' : 'This page hit an unexpected error. Reloading usually fixes it; if not, go back to your dashboard.'}
          </p>
          <div className="flex justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> <span>Reload</span>
            </button>
            {!chunk && (
              <a href="/" className="btn-ghost px-4 py-2 text-sm">
                Home
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }
}
