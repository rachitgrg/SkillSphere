import React from 'react';

export const CreateDisputePage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Open a Dispute</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <p className="text-slate-400">Dispute form goes here.</p>
      </div>
    </div>
  );
};

export const DisputeDetailPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white mb-4">Dispute Details</h1>
      <div className="glass-card p-6 rounded-2xl border border-slate-800">
        <p className="text-slate-400">Dispute details and chat go here.</p>
      </div>
    </div>
  );
};
