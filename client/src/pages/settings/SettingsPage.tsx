import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Bell, CheckCircle2, KeyRound, Mail, ShieldCheck, ShieldOff } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../api/userApi';
import { PageHeader } from '../../components/common/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { authApi } from '../../api/authApi';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { updateUser, setCredentials } from '../../store/slices/authSlice';
import { OtpInput, strongPassword } from '../auth/AuthFlowPages';
import type { NotificationCategory, TwoFactorSetup } from '../../types';
import { getErrorMessage } from '../../utils/helpers';

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <section className="glass-card p-6 rounded-2xl border border-slate-800">
    <h2 className="font-semibold text-white mb-4 flex items-center gap-2">{icon}{title}</h2>
    {children}
  </section>
);

export function SettingsPage() {
  const user = useAppSelector((s) => s.auth.user)!;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Security and account preferences." />
      <EmailStatus verified={user.isVerified} email={user.email} />
      <TwoFactorSettings enabled={user.twoFactorEnabled} />
      <NotificationSettings />
      <ChangePassword />
    </div>
  );
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  proposals: 'Proposals & offers',
  gigs: 'Gigs, invitations & matches',
  projects: 'Milestones, updates & deadlines',
  payments: 'Payments & payouts',
  reviews: 'Reviews',
  messages: 'Chat messages (when offline)',
  disputes: 'Disputes',
};

function NotificationSettings() {
  const queryClient = useQueryClient();
  const prefs = useQuery({ queryKey: ['users', 'notification-preferences'], queryFn: userApi.getNotificationPreferences });
  const save = useMutation({
    mutationFn: userApi.updateNotificationPreferences,
    onSuccess: (data) => queryClient.setQueryData(['users', 'notification-preferences'], data),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Section icon={<Bell className="w-5 h-5 text-indigo-400" />} title="Notifications">
      {!prefs.data ? (
        <p className="text-sm text-slate-500">{prefs.isError ? getErrorMessage(prefs.error) : 'Loading…'}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="font-normal pb-2">Category</th>
              <th className="font-normal pb-2 text-center w-20">In-app</th>
              <th className="font-normal pb-2 text-center w-20">Email</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((category) => (
              <tr key={category} className="border-t border-slate-800">
                <td className="py-2 text-slate-300">{CATEGORY_LABELS[category]}</td>
                {(['inApp', 'email'] as const).map((channel) => (
                  <td key={channel} className="py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${CATEGORY_LABELS[category]} — ${channel === 'email' ? 'email' : 'in-app'}`}
                      checked={prefs.data[channel][category]}
                      disabled={save.isPending}
                      onChange={(e) => save.mutate({ [channel]: { [category]: e.target.checked } })}
                      className="h-4 w-4 accent-indigo-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-slate-500 mt-3">Security emails (verification, password reset) are always sent.</p>
    </Section>
  );
}

function EmailStatus({ verified, email }: { verified: boolean; email: string }) {
  const [sending, setSending] = useState(false);
  const resend = async () => {
    setSending(true);
    try {
      await authApi.resendVerification();
      toast.success(`Verification link sent to ${email}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSending(false);
    }
  };
  return (
    <Section icon={<Mail className="w-5 h-5 text-indigo-400" />} title="Email">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-300">
          {email} ·{' '}
          {verified ? <span className="text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> verified</span> : <span className="text-amber-300">not verified</span>}
        </p>
        {!verified && <Button size="sm" variant="secondary" onClick={resend} isLoading={sending}>Resend link</Button>}
      </div>
    </Section>
  );
}

function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const dispatch = useAppDispatch();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      setSetup(await authApi.setupTwoFactor());
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (value = code) => {
    setBusy(true);
    try {
      const { backupCodes: codes } = await authApi.enableTwoFactor(value);
      setBackupCodes(codes);
      setSetup(null);
      dispatch(updateUser({ twoFactorEnabled: true }));
      toast.success('Two-factor authentication is on');
    } catch (error) {
      toast.error(getErrorMessage(error));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await authApi.disableTwoFactor(password, code);
      dispatch(updateUser({ twoFactorEnabled: false }));
      setCode('');
      setPassword('');
      toast.success('Two-factor authentication is off');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section icon={enabled ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <ShieldOff className="w-5 h-5 text-slate-400" />} title="Two-factor authentication">
      {backupCodes && (
        <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-200 mb-3">Save these backup codes somewhere safe. Each works once, and they won&apos;t be shown again.</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-white">{backupCodes.map((c) => <li key={c}>{c}</li>)}</ul>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigator.clipboard.writeText(backupCodes.join('\n')).then(() => toast.success('Copied'))}>Copy codes</Button>
        </div>
      )}

      {enabled ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">On. You&apos;ll be asked for a code from your authenticator app when you log in.</p>
          <details className="text-sm">
            <summary className="cursor-pointer text-slate-400 hover:text-white">Turn off two-factor authentication</summary>
            <div className="mt-4 space-y-3 max-w-sm">
              <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Input label="Authenticator or backup code" value={code} onChange={(e) => setCode(e.target.value.trim())} />
              <Button variant="danger" size="sm" onClick={disable} isLoading={busy} disabled={code.length < 6}>Turn off</Button>
            </div>
          </details>
        </div>
      ) : setup ? (
        <div className="grid sm:grid-cols-[180px_1fr] gap-6 items-start">
          <img src={setup.qrCode} alt="QR code for your authenticator app" className="w-44 h-44 rounded-xl bg-white p-2" />
          <div className="space-y-4">
            <p className="text-sm text-slate-300">Scan with Google Authenticator, Authy or 1Password, then enter the 6-digit code.</p>
            <p className="text-xs text-slate-500 break-all">Can&apos;t scan? Key: <span className="font-mono text-slate-300">{setup.secret}</span></p>
            <OtpInput value={code} onChange={setCode} onComplete={confirm} />
            <Button onClick={() => confirm()} isLoading={busy} disabled={code.length !== 6}>Turn on</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-300">Add a second step to sign-in with an authenticator app.</p>
          <Button size="sm" onClick={start} isLoading={busy}>Set up</Button>
        </div>
      )}
    </Section>
  );
}

const passwordSchema = z
  .object({ currentPassword: z.string().min(1, 'Required'), newPassword: strongPassword, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

function ChangePassword() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user)!;
  const { register, handleSubmit, reset, formState } = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (v: z.infer<typeof passwordSchema>) => {
    try {
      const { token } = await authApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword });
      dispatch(setCredentials({ user, token }));
      reset();
      toast.success('Password changed. Other devices were signed out.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Section icon={<KeyRound className="w-5 h-5 text-indigo-400" />} title="Change password">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3 max-w-sm">
        <Input label="Current password" type="password" autoComplete="current-password" error={formState.errors.currentPassword?.message} {...register('currentPassword')} />
        <Input label="New password" type="password" autoComplete="new-password" error={formState.errors.newPassword?.message} {...register('newPassword')} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" size="sm" isLoading={formState.isSubmitting}>Update password</Button>
      </form>
    </Section>
  );
}
