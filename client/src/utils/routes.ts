import type { UserRole } from '../types';

/** Landing page after sign-in for each role. */
export const getDashboardPath = (role: UserRole) => {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'freelancer') return '/freelancer/dashboard';
  return '/client/dashboard';
};

/** Where "my profile" lives for each role. */
export const getProfilePath = (role: UserRole) => {
  if (role === 'freelancer') return '/freelancer/profile';
  if (role === 'client') return '/client/profile';
  return getDashboardPath(role);
};
