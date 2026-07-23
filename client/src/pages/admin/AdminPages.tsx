import React from 'react';

export const GigApproval: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Gig Approval Queue</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <p className="text-slate-400">No gigs waiting for approval.</p>
      </div>
    </div>
  );
};

export const PaymentMonitoring: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Payment Monitoring</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <p className="text-slate-400">Recent transactions will appear here.</p>
      </div>
    </div>
  );
};

export const DisputeManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Dispute Management</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <p className="text-slate-400">Active disputes will appear here.</p>
      </div>
    </div>
  );
};

export const AnalyticsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Platform Analytics</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <p className="text-slate-400">Platform-wide charts and analytics.</p>
      </div>
    </div>
  );
};
