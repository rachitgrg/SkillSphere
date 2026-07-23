import React from 'react';
import { Search, Filter, X } from 'lucide-react';

export const GigFilters: React.FC = () => {
  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
        <h3 className="font-semibold text-white flex items-center">
          <Filter className="w-4 h-4 mr-2 text-indigo-400" /> Filters
        </h3>
        <button className="text-xs text-slate-400 hover:text-white transition-colors">Clear All</button>
      </div>

      <div className="space-y-6">
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Project Type</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input type="checkbox" className="form-checkbox bg-slate-900 border-slate-700 text-indigo-500 rounded focus:ring-indigo-500/50" defaultChecked />
              <span className="ml-2 text-sm text-slate-400">Fixed Price</span>
            </label>
            <label className="flex items-center">
              <input type="checkbox" className="form-checkbox bg-slate-900 border-slate-700 text-indigo-500 rounded focus:ring-indigo-500/50" defaultChecked />
              <span className="ml-2 text-sm text-slate-400">Hourly</span>
            </label>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Budget Range</h4>
          <div className="flex items-center gap-2">
            <input type="number" placeholder="Min" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
            <span className="text-slate-500">-</span>
            <input type="number" placeholder="Max" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Skills Needed</h4>
          <div className="flex flex-wrap gap-2">
            {['React', 'Node.js', 'UI/UX', 'Python'].map(skill => (
              <span key={skill} className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded-md flex items-center border border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors">
                {skill} <X className="w-3 h-3 ml-1 text-slate-500" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
