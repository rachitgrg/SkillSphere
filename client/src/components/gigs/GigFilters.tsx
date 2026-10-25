import React from 'react';
import { Filter, TrendingUp, X } from 'lucide-react';
import type { ExperienceLevel, GigBudgetType, GigFilters as Filters, LocationType } from '../../types';
import { EXPERIENCE_LABELS, LOCATION_TYPE_LABELS } from '../../utils/helpers';

interface GigFiltersProps {
  value: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClearAll: () => void;
  activeCount: number;
  categories: { category: string; count: number }[];
  trendingSkills: { skill: string; growth: number }[];
  /** Budget inputs are edited locally and committed by the page (debounced). */
  budgetDraft: { min: string; max: string };
  onBudgetDraftChange: (draft: { min: string; max: string }) => void;
}

const selectClass =
  'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer';
const inputClass =
  'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-600';

export const GigFilters: React.FC<GigFiltersProps> = ({
  value,
  onChange,
  onClearAll,
  activeCount,
  categories,
  trendingSkills,
  budgetDraft,
  onBudgetDraftChange,
}) => {
  const selectedSkills = value.skills ?? [];
  const toggleSkill = (skill: string) =>
    onChange({
      skills: selectedSkills.includes(skill) ? selectedSkills.filter((s) => s !== skill) : [...selectedSkills, skill],
    });

  // Selected skills that aren't trending right now stay visible so they can be removed.
  const skillOptions = [
    ...selectedSkills.filter((s) => !trendingSkills.some((t) => t.skill === s)).map((skill) => ({ skill, growth: 0 })),
    ...trendingSkills,
  ];

  return (
    <div className="glass-card rounded-2xl p-5 border border-slate-800 lg:sticky lg:top-24">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Filter className="w-4 h-4 text-indigo-400" /> Filters
          {activeCount > 0 && (
            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full font-normal">{activeCount}</span>
          )}
        </h2>
        <button
          onClick={onClearAll}
          className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer font-medium underline-offset-4 hover:underline focus-ring rounded"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="filter-category" className="block text-sm font-medium text-slate-300 mb-2">
            Category
          </label>
          <select
            id="filter-category"
            value={value.category ?? ''}
            onChange={(e) => onChange({ category: e.target.value || undefined })}
            className={selectClass}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {c.category} ({c.count})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-type" className="block text-sm font-medium text-slate-300 mb-2">
            Project type
          </label>
          <select
            id="filter-type"
            value={value.budgetType ?? ''}
            onChange={(e) => onChange({ budgetType: (e.target.value || undefined) as GigBudgetType | undefined })}
            className={selectClass}
          >
            <option value="">Fixed and hourly</option>
            <option value="fixed">Fixed price</option>
            <option value="hourly">Hourly rate</option>
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-300 mb-2">Budget range (₹)</legend>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Minimum budget"
              placeholder="Min"
              value={budgetDraft.min}
              onChange={(e) => onBudgetDraftChange({ ...budgetDraft, min: e.target.value })}
              className={inputClass}
            />
            <span className="text-slate-600 font-bold">–</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              aria-label="Maximum budget"
              placeholder="Max"
              value={budgetDraft.max}
              onChange={(e) => onBudgetDraftChange({ ...budgetDraft, max: e.target.value })}
              className={inputClass}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">Shows gigs whose budget overlaps this range.</p>
        </fieldset>

        <div>
          <label htmlFor="filter-experience" className="block text-sm font-medium text-slate-300 mb-2">
            Experience level
          </label>
          <select
            id="filter-experience"
            value={value.experienceLevel ?? ''}
            onChange={(e) => onChange({ experienceLevel: (e.target.value || undefined) as ExperienceLevel | undefined })}
            className={selectClass}
          >
            <option value="">Any</option>
            {(Object.keys(EXPERIENCE_LABELS) as ExperienceLevel[]).map((level) => (
              <option key={level} value={level}>
                {EXPERIENCE_LABELS[level]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-location" className="block text-sm font-medium text-slate-300 mb-2">
            Work location
          </label>
          <select
            id="filter-location"
            value={value.locationType ?? ''}
            onChange={(e) => onChange({ locationType: (e.target.value || undefined) as LocationType | undefined })}
            className={selectClass}
          >
            <option value="">Anywhere</option>
            {(Object.keys(LOCATION_TYPE_LABELS) as LocationType[]).map((type) => (
              <option key={type} value={type}>
                {LOCATION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Trending skills
            </h3>
            {selectedSkills.length > 0 && <span className="text-xs text-indigo-400">{selectedSkills.length} selected</span>}
          </div>
          {skillOptions.length === 0 ? (
            <p className="text-xs text-slate-500">No skills trending yet.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {skillOptions.map(({ skill }) => {
                const isSelected = selectedSkills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSkill(skill)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all duration-200 cursor-pointer focus-ring ${
                      isSelected
                        ? 'bg-indigo-600 text-white border border-indigo-500 shadow-sm shadow-indigo-500/20'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {skill}
                    {isSelected ? <X className="w-3 h-3 text-indigo-200" /> : <span className="text-[10px] text-slate-600">+</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
