import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import toast from 'react-hot-toast';
import { Spinner } from '../../components/common/Spinner';
import { useAppDispatch } from '../../hooks/useRedux';
import { bootstrapSession } from '../../store/slices/authSlice';
import { store } from '../../store/store';
import { getDashboardPath } from '../../utils/routes';

/**
 * Google OAuth lands here after the server has set the refresh cookie. We exchange it for an
 * access token, then continue to the dashboard (or the login page with an error).
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [params] = useSearchParams();

  useEffect(() => {
    const error = params.get('error');
    if (error) {
      toast.error(error);
      navigate('/login', { replace: true });
      return;
    }

    dispatch(bootstrapSession()).then(() => {
      const user = store.getState().auth.user;
      if (user) {
        navigate(user.needsRoleSelection ? '/choose-role' : getDashboardPath(user.role), { replace: true });
      } else {
        toast.error('Google sign-in failed. Please try again.');
        navigate('/login', { replace: true });
      }
    });
  }, [dispatch, navigate, params]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-dark-950 text-dark-300">
      <Spinner size="lg" />
      <p>Signing you in…</p>
    </div>
  );
}
