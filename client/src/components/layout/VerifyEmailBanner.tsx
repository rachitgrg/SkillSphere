import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { MailWarning } from 'lucide-react';
import { authApi } from '../../api/authApi';
import { useAppSelector } from '../../hooks/useRedux';
import { getErrorMessage } from '../../utils/helpers';

/** Shown until the signed-in user verifies their email (posting, applying and paying need it). */
export function VerifyEmailBanner() {
  const user = useAppSelector((s) => s.auth.user);
  const [sent, setSent] = useState(false);
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: authApi.getProviders, staleTime: Infinity });
  if (!user || user.isVerified || providers.data?.emailVerification === false) return null;

  const resend = async () => {
    try {
      await authApi.resendVerification();
      setSent(true);
      toast.success(`Verification link sent to ${user.email}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div role="status" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex flex-wrap items-center gap-3">
      <MailWarning className="w-4 h-4 shrink-0" />
      <span className="flex-1">Verify your email to post gigs, send proposals and make payments.</span>
      <button onClick={resend} disabled={sent} className="font-medium underline underline-offset-2 disabled:no-underline disabled:opacity-60">
        {sent ? 'Link sent' : 'Resend link'}
      </button>
    </div>
  );
}
