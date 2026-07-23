import React from 'react';
import { Link } from 'react-router';
import { motion } from 'framer-motion';

export const VerifyEmailPage: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 px-4">
    <motion.div className="max-w-md w-full glass-card p-8 rounded-2xl text-center">
      <h2 className="text-2xl font-bold text-white mb-4">Verify your email</h2>
      <p className="text-slate-400 mb-6">We've sent a verification link to your email address. Please check your inbox.</p>
      <Link to="/login" className="btn-primary w-full inline-block py-2 rounded-lg">Back to Login</Link>
    </motion.div>
  </div>
);

export const ForgotPasswordPage: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 px-4">
    <motion.div className="max-w-md w-full glass-card p-8 rounded-2xl">
      <h2 className="text-2xl font-bold text-white mb-2">Forgot Password</h2>
      <p className="text-slate-400 mb-6">Enter your email to receive a reset link.</p>
      <input type="email" placeholder="Email address" className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white mb-4" />
      <button className="btn-primary w-full py-3 rounded-lg mb-4">Send Reset Link</button>
      <div className="text-center">
        <Link to="/login" className="text-indigo-400 text-sm">Back to Login</Link>
      </div>
    </motion.div>
  </div>
);

export const ResetPasswordPage: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 px-4">
    <motion.div className="max-w-md w-full glass-card p-8 rounded-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Set New Password</h2>
      <input type="password" placeholder="New Password" className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white mb-4" />
      <input type="password" placeholder="Confirm Password" className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white mb-6" />
      <button className="btn-primary w-full py-3 rounded-lg">Reset Password</button>
    </motion.div>
  </div>
);

export const TwoFactorPage: React.FC = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 px-4">
    <motion.div className="max-w-md w-full glass-card p-8 rounded-2xl text-center">
      <h2 className="text-2xl font-bold text-white mb-4">Two-Factor Authentication</h2>
      <p className="text-slate-400 mb-6">Enter the 6-digit code sent to your device.</p>
      <div className="flex gap-2 justify-center mb-6">
        {[1,2,3,4,5,6].map(i => (
          <input key={i} type="text" maxLength={1} className="w-12 h-14 text-center text-xl font-bold bg-slate-800 border border-slate-700 rounded-lg text-white" />
        ))}
      </div>
      <button className="btn-primary w-full py-3 rounded-lg">Verify</button>
    </motion.div>
  </div>
);
