import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { m } from 'framer-motion';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { clearError, loginUser } from '../../store/slices/authSlice';
import { getDashboardPath } from '../../utils/routes';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';


export const LoginPage: React.FC = () => {
  useDocumentTitle('Sign in');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const result = await dispatch(loginUser({ email, password })).unwrap();
      if ('twoFactorRequired' in result) {
        navigate('/2fa', { state: { tempToken: result.tempToken } });
        return;
      }
      navigate(getDashboardPath(result.user.role), { replace: true });
    } catch {
      // The error message is stored in the auth slice and rendered by the form.
    }
  };

  const clearLoginError = () => {
    if (error) dispatch(clearError());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />

      <m.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-card p-8 rounded-3xl border border-slate-800 relative z-10"
      >
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-white mb-2 block">SkillSphere</Link>
          <p className="text-slate-400">Welcome back! Please enter your details.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => { setEmail(event.target.value); clearLoginError(); }}
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => { setPassword(event.target.value); clearLoginError(); }}
            error={error || undefined}
            required
          />

          <div className="flex items-center justify-end text-sm">
            <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300">Forgot password?</Link>
          </div>

          <Button type="submit" size="lg" fullWidth isLoading={isLoading}>Sign In</Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-900/80 text-slate-500">Or continue with</span></div>
          </div>

          <GoogleButton />
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Don't have an account? <Link to="/register" className="text-indigo-400 font-medium hover:text-indigo-300">Sign up</Link>
        </p>
      </m.div>
    </div>
  );
};
