import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="min-h-screen flex flex-col bg-dark-950">
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-center px-4 text-center pt-16">
        <div className="w-16 h-16 rounded-2xl bg-dark-800/60 flex items-center justify-center mb-6 text-primary-400">
          <Compass className="w-8 h-8" />
        </div>
        <p className="text-sm font-semibold text-primary-400 mb-2">404</p>
        <h1 className="text-3xl font-bold text-white mb-3">This page doesn&apos;t exist</h1>
        <p className="text-dark-400 max-w-md mb-8">The link may be broken, or the page may have moved.</p>
        <div className="flex gap-3">
          <Link to="/" className="btn-secondary px-5 py-2.5 text-sm">
            Go home
          </Link>
          <Link to="/gigs" className="btn-primary px-5 py-2.5 text-sm">
            <span>Browse gigs</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
