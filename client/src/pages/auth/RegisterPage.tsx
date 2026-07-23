import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Briefcase, User } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [role, setRole] = useState<'freelancer' | 'client' | null>(null);
  const navigate = useNavigate();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-12 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none"></div>
      
      <motion.div 
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
            <div 
              onClick={() => setRole('freelancer')}
              className="glass-card p-6 rounded-xl border border-slate-700 cursor-pointer hover:border-indigo-500 hover:bg-slate-800 transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-lg">I'm a Freelancer</h4>
                <p className="text-sm text-slate-400">Looking for projects to work on</p>
              </div>
            </div>
            
            <div 
              onClick={() => setRole('client')}
              className="glass-card p-6 rounded-xl border border-slate-700 cursor-pointer hover:border-cyan-500 hover:bg-slate-800 transition-all flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Briefcase className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white font-semibold text-lg">I'm a Client</h4>
                <p className="text-sm text-slate-400">Looking to hire top talent</p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <button type="button" onClick={() => setRole(null)} className="text-sm text-indigo-400 hover:text-indigo-300">&larr; Back</button>
              <span className="text-sm text-slate-500">Signing up as {role === 'freelancer' ? 'Freelancer' : 'Client'}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" required  />
              <Input label="Last Name" required  />
            </div>
            <Input label="Email" type="email" required  />
            <Input label="Password" type="password" required  />
            
            <Button type="submit"  size="lg">Create Account</Button>
          </form>
        )}
        
        <p className="text-center text-sm text-slate-400 mt-8">
          Already have an account? <Link to="/login" className="text-indigo-400 font-medium hover:text-indigo-300">Log in</Link>
        </p>
      </motion.div>
    </div>
  );
};
