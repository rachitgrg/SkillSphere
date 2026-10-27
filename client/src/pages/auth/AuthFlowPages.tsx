import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { CheckCircle2, MailCheck, ShieldCheck, XCircle } from 'lucide-react';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Spinner } from '../../components/common/Spinner';
import { authApi } from '../../api/authApi';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { setCredentials, updateUser } from '../../store/slices/authSlice';
import { getDashboardPath } from '../../utils/routes';
import { getErrorMessage } from '../../utils/helpers';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4">
    <Link to="/" className="text-2xl font-bold text-white mb-6">SkillSphere</Link>
    <div className="max-w-md w-full glass-card p-8 rounded-2xl border border-slate-800">{children}</div>
  </div>
);

export const strongPassword = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[a-z]/, 'Add a lowercase letter')
  .regex(/[0-9]/, 'Add a number');

// ───────────── Verify email ─────────────

/** /verify-email?token=… (link from the verification email). */
export const VerifyEmailPage: React.FC = () => {
  useDocumentTitle('Verify email');
  const [params] = useSearchParams();
  const token = params.get('token');
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // StrictMode runs effects twice; the token is single-use
    authApi
      .verifyEmail(token)
      .then(() => {
        setState('ok');
        dispatch(updateUser({ isVerified: true }));
      })
      .catch((error) => {
        setState('error');
        setMessage(getErrorMessage(error));
      });
  }, [token, dispatch]);

  return (
    <Shell>
      <div className="text-center">
        {state === 'loading' && <Spinner size="lg" />}
        {state === 'ok' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Email verified</h1>
            <p className="text-slate-400 mb-6">You can now post gigs, apply and pay.</p>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Link not valid</h1>
            <p className="text-slate-400 mb-6">{message || 'This link is missing or has expired.'} Request a new one from the banner after you sign in.</p>
          </>
        )}
        <Link to={user ? getDashboardPath(user.role) : '/login'} className="btn-primary w-full inline-block py-2.5 text-sm">
          <span>Continue</span>
        </Link>
      </div>
    </Shell>
  );
};

// ───────────── Forgot / reset password ─────────────

const forgotSchema = z.object({ email: z.string().trim().email('Enter a valid email') });

export const ForgotPasswordPage: React.FC = () => {
  useDocumentTitle('Forgot password');
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async ({ email }: z.infer<typeof forgotSchema>) => {
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Shell>
      {sent ? (
        <div className="text-center">
          <MailCheck className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
          <p className="text-slate-400 mb-6">If an account exists for that email, a reset link (valid for 1 hour) is on its way.</p>
          <Link to="/login" className="text-indigo-400 text-sm">Back to login</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <h1 className="text-2xl font-bold text-white">Forgot password</h1>
          <p className="text-slate-400 text-sm">Enter your email and we&apos;ll send you a reset link.</p>
          <Input label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
          <Button type="submit" fullWidth isLoading={formState.isSubmitting}>Send reset link</Button>
          <p className="text-center"><Link to="/login" className="text-indigo-400 text-sm">Back to login</Link></p>
        </form>
      )}
    </Shell>
  );
};

const resetSchema = z
  .object({ password: strongPassword, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });

export const ResetPasswordPage: React.FC = () => {
  useDocumentTitle('Reset password');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token');
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async ({ password }: z.infer<typeof resetSchema>) => {
    try {
      await authApi.resetPassword(token!, password);
      toast.success('Password updated. Please log in.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not reset your password'));
    }
  };

  if (!token) {
    return (
      <Shell>
        <p className="text-slate-300 mb-4">This reset link is incomplete.</p>
        <Link to="/forgot-password" className="text-indigo-400 text-sm">Request a new link</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Set a new password</h1>
        <Input label="New password" type="password" autoComplete="new-password" error={formState.errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register('confirm')} />
        <Button type="submit" fullWidth isLoading={formState.isSubmitting}>Update password</Button>
      </form>
    </Shell>
  );
};

// ───────────── Two-factor login step ─────────────

/** Six digit boxes with auto-advance and paste support. */
export function OtpInput({ value, onChange, onComplete }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  const setAt = (index: number, char: string) => {
    const next = (value.slice(0, index) + char + value.slice(index + 1)).slice(0, 6);
    onChange(next);
    if (char && index < 5) refs.current[index + 1]?.focus();
    if (next.length === 6 && /^\d{6}$/.test(next)) onComplete?.(next);
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={(e) => {
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (pasted) {
        e.preventDefault();
        onChange(pasted);
        refs.current[Math.min(pasted.length, 5)]?.focus();
        if (pasted.length === 6) onComplete?.(pasted);
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          maxLength={1}
          value={d}
          onChange={(e) => setAt(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus();
          }}
          className="w-11 h-14 text-center text-xl font-bold bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-indigo-500 outline-none"
        />
      ))}
    </div>
  );
}

export const TwoFactorPage: React.FC = () => {
  useDocumentTitle('Two-factor sign-in');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const tempToken = (useLocation().state as { tempToken?: string } | null)?.tempToken;
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [busy, setBusy] = useState(false);

  const verify = async (value = code) => {
    if (!tempToken) return;
    setBusy(true);
    try {
      const session = await authApi.verifyTwoFactor(tempToken, value);
      dispatch(setCredentials(session));
      navigate(getDashboardPath(session.user.role), { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Code not accepted'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  if (!tempToken) {
    return (
      <Shell>
        <p className="text-slate-300 mb-4">Your sign-in session expired.</p>
        <Link to="/login" className="text-indigo-400 text-sm">Back to login</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="text-center space-y-6">
        <ShieldCheck className="w-12 h-12 text-indigo-400 mx-auto" />
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Two-factor authentication</h1>
          <p className="text-slate-400 text-sm">
            {useBackup ? 'Enter one of your backup codes.' : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        </div>
        {useBackup ? (
          <Input aria-label="Backup code" value={code} onChange={(e) => setCode(e.target.value.trim())} autoFocus />
        ) : (
          <OtpInput value={code} onChange={setCode} onComplete={verify} />
        )}
        <Button type="submit" fullWidth isLoading={busy} disabled={useBackup ? code.length < 6 : code.length !== 6}>Verify</Button>
        <button type="button" onClick={() => { setUseBackup(!useBackup); setCode(''); }} className="text-sm text-indigo-400 hover:text-indigo-300">
          {useBackup ? 'Use authenticator code' : 'Use a backup code instead'}
        </button>
      </form>
    </Shell>
  );
};

// ───────────── First Google login: choose a role ─────────────

export const ChooseRolePage: React.FC = () => {
  useDocumentTitle('Choose your role');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const [busy, setBusy] = useState<'client' | 'freelancer' | null>(null);

  const choose = async (role: 'client' | 'freelancer') => {
    setBusy(role);
    try {
      const session = await authApi.chooseRole(role);
      dispatch(setCredentials(session));
      navigate(getDashboardPath(session.user.role), { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
      setBusy(null);
    }
  };

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-white mb-2 text-center">Welcome{user ? `, ${user.firstName}` : ''}!</h1>
      <p className="text-slate-400 text-sm text-center mb-6">How will you use SkillSphere? You can&apos;t change this later.</p>
      <div className="space-y-3">
        <Button fullWidth variant="secondary" isLoading={busy === 'freelancer'} disabled={busy !== null} onClick={() => choose('freelancer')}>I&apos;m a freelancer</Button>
        <Button fullWidth isLoading={busy === 'client'} disabled={busy !== null} onClick={() => choose('client')}>I&apos;m hiring (client)</Button>
      </div>
    </Shell>
  );
};
