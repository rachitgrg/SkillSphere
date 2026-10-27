import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Spinner } from '../common/Spinner';
import { useAppSelector } from '../../hooks/useRedux';
import type { UserRole } from '../../types';
import { getDashboardPath } from '../../utils/routes';

/**
 * Waits for the session bootstrap, then sends signed-out users to /login, Google sign-ups without a
 * role to /choose-role, and users of another role to their own dashboard.
 */
export function ProtectedRoute({ children, role }: { children: ReactNode; role?: UserRole }) {
  const { isAuthenticated, user, isBootstrapping } = useAppSelector((state) => state.auth);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.needsRoleSelection) return <Navigate to="/choose-role" replace />;
  if (role && user.role !== role) return <Navigate to={getDashboardPath(user.role)} replace />;
  return <>{children}</>;
}
