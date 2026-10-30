import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { m } from 'framer-motion';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Briefcase, User } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../hooks/useRedux';
import { clearError, registerUser } from '../../store/slices/authSlice';
import { getDashboardPath } from '../../utils/routes';
import { GoogleButton } from '../../components/auth/GoogleButton';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';


export const RegisterPage: React.FC = () => {
  useDocumentTitle('Create an account');
  const [role, setRole] = useState<'freelancer' | 'client' | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!role) return;

    try {
      const result = await dispatch(registerUser({ firstName, lastName, email, password, role })).unwrap();
      navigate(getDashboardPath(result.user.role), { replace: true });
    } catch {
      // The error message is stored in the auth slice and rendered by the form.
    }
  };

  const clearRegistrationError = () => {
    if (error) dispatch(clearError());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />

      <m.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg glass-card p-8 rounded-3xl border border-slate-800 relative z-10"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Create an Account</h2>
          <p className="text-slate-400">Join SkillSphere today.</p>
        </div>

        {!role ? (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white text-center mb-6">How do you want to use SkillSphere?</h3>
            <button type="button" onClick={() => setRole('freelancer')} className="glass-card w-full p-6 rounded-xl border border-slate-700 cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition-all flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400"><User className="w-6 h-6" /></div>
              <div><h4 className="text-white font-semibold text-lg">I'm a Freelancer</h4><p className="text-sm text-slate-400">Looking for projects to work on</p></div>
            </button>

            <button type="button" onClick={() => setRole('client')} className="glass-card w-full p-6 rounded-xl border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-800 transition-all flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400"><Briefcase className="w-6 h-6" /></div>
              <div><h4 className="text-white font-semibold text-lg">I'm a Client</h4><p className="text-sm text-slate-400">Looking to hire top talent</p></div>
            </button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-slate-900/80 text-slate-500">or</span></div>
            </div>
            <GoogleButton />
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setRole(null)} className="text-sm text-indigo-400 hover:text-indigo-300">&larr; Back</button>
              <span className="text-sm text-slate-500">Signing up as {role === 'freelancer' ? 'Freelancer' : 'Client'}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" name="firstName" autoComplete="given-name" value={firstName} onChange={(event) => { setFirstName(event.target.value); clearRegistrationError(); }} required />
              <Input label="Last Name" name="lastName" autoComplete="family-name" value={lastName} onChange={(event) => { setLastName(event.target.value); clearRegistrationError(); }} required />
            </div>
            <Input label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); clearRegistrationError(); }} required />
            <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => { setPassword(event.target.value); clearRegistrationError(); }} error={error || undefined} helperText="At least 8 characters with an uppercase letter, a lowercase letter and a number." required />

            <Button type="submit" size="lg" fullWidth isLoading={isLoading}>Create Account</Button>
          </form>
        )}

        <p className="text-center text-sm text-slate-400 mt-8">
          Already have an account? <Link to="/login" className="text-indigo-400 font-medium hover:text-indigo-300">Log in</Link>
        </p>
      </m.div>
    </div>
  );
};
