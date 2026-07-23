import React from 'react';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';

export const CreateGigPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Post a New Gig</h1>
      
      <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6">
        <div>
          <h3 className="text-xl font-semibold text-white mb-4">1. Basic Details</h3>
          <Input label="Job Title" placeholder="e.g. Senior Frontend Developer Needed"  required />
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
            <textarea 
              rows={5} 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-1 focus:ring-indigo-500 outline-none"
              placeholder="Describe the project in detail..."
            ></textarea>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-xl font-semibold text-white mb-4">2. Budget & Timeline</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Budget ($)" type="number" placeholder="5000"  required />
            <Input label="Estimated Duration" placeholder="e.g. 2 months"  required />
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-6">
          <h3 className="text-xl font-semibold text-white mb-4">3. Skills Required</h3>
          <Input placeholder="Type a skill and press Enter..."  />
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded-full">React ✕</span>
            <span className="px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded-full">TypeScript ✕</span>
          </div>
        </div>
        
        <div className="border-t border-slate-800 pt-6 flex justify-end gap-4">
          <Button variant="ghost" className="border-slate-700 hover:bg-slate-800 text-white">Save Draft</Button>
          <Button>Post Gig</Button>
        </div>
      </div>
    </div>
  );
};
