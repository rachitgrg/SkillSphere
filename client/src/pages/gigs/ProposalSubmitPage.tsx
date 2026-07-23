import React from 'react';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

export const ProposalSubmitPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold text-white mb-4">Submit a Proposal</h1>
      <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6">
        <Input label="Bid Amount ($)" type="number" placeholder="5000"  required />
        <Input label="Estimated Timeline" placeholder="e.g. 4 weeks"  required />
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">Cover Letter</label>
          <textarea rows={6} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none" placeholder="Explain why you are the best fit..."></textarea>
        </div>
        <Button size="lg" >Submit Proposal</Button>
      </div>
    </div>
  );
};
