import React from 'react';

export const NotificationsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pt-24">
      <h1 className="text-2xl font-bold text-white mb-4">All Notifications</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <p className="text-slate-400">You have no new notifications.</p>
      </div>
    </div>
  );
};
