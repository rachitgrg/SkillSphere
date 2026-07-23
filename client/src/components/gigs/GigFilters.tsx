import React from 'react';
import { Filter, X, Check } from 'lucide-react';

interface GigFiltersProps {
  selectedTypes: { fixed: boolean; hourly: boolean };
  onTypeChange: (type: 'fixed' | 'hourly') => void;
  minBudget: string;
  maxBudget: string;
  onMinBudgetChange: (val: string) => void;
  onMaxBudgetChange: (val: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedSkills: string[];
  onToggleSkill: (skill: string) => void;
  availableSkills: string[];
  availableCategories: string[];
  onClearAll: () => void;
  activeCount: number;
}

export const GigFilters: React.FC<GigFiltersProps> = ({
  selectedTypes,
  onTypeChange,
  minBudget,
  maxBudget,
  onMinBudgetChange,
  onMaxBudgetChange,
  selectedCategory,
  onCategoryChange,
  selectedSkills,
  onToggleSkill,
  availableSkills,
  availableCategories,
  onClearAll,
  activeCount,
}) => {
  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 sticky top-24">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" /> Filters
          {activeCount > 0 && (
            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full font-normal">
              {activeCount}
            </span>
          )}
        </h3>
        <button 
          onClick={onClearAll}
          className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer font-medium underline-offset-4 hover:underline"
        >
          Clear All
        </button>
      </div>

      <div className="space-y-6">
        {/* Category */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-2">Category</h4>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Project Type */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Project Type</h4>
          <div className="space-y-2.5">
            <label className="flex items-center cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={selectedTypes.fixed}
                onChange={() => onTypeChange('fixed')}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 accent-indigo-500"
              />
              <span className="ml-2.5 text-sm text-slate-300 group-hover:text-white transition-colors">
                Fixed Price
              </span>
            </label>
            <label className="flex items-center cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={selectedTypes.hourly}
                onChange={() => onTypeChange('hourly')}
                className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-950 accent-indigo-500"
              />
              <span className="ml-2.5 text-sm text-slate-300 group-hover:text-white transition-colors">
                Hourly Rate
              </span>
            </label>
          </div>
        </div>

        {/* Budget Range */}
        <div>
          <h4 className="text-sm font-medium text-slate-300 mb-3">Budget Range ($)</h4>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minBudget}
              onChange={(e) => onMinBudgetChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-600"
            />
            <span className="text-slate-600 font-bold">-</span>
            <input
              type="number"
              placeholder="Max"
              value={maxBudget}
              onChange={(e) => onMaxBudgetChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Skills Needed */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-slate-300">Skills Needed</h4>
            {selectedSkills.length > 0 && (
              <span className="text-xs text-indigo-400">{selectedSkills.length} selected</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableSkills.map((skill) => {
              const isSelected = selectedSkills.includes(skill);
              return (
                <button
                  key={skill}
                  onClick={() => onToggleSkill(skill)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border border-indigo-500 shadow-sm shadow-indigo-500/20'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {skill}
                  {isSelected ? (
                    <X className="w-3 h-3 text-indigo-200 hover:text-white" />
                  ) : (
                    <span className="text-[10px] text-slate-600">+</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
