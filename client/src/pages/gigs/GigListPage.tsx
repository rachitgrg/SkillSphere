import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, X, Briefcase, RefreshCw, AlertTriangle } from 'lucide-react';
import { GigCard } from '../../components/gigs/GigCard';
import { GigFilters } from '../../components/gigs/GigFilters';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { Pagination } from '../../components/common/Pagination';
import { useCategories, useGigs, useTrendingSkills } from '../../hooks/queries/useMarketplace';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { GigFilters as Filters, GigSort } from '../../types';
import { getErrorMessage } from '../../utils/helpers';

const PAGE_SIZE = 12;
const SORTS: { value: GigSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'budget_high', label: 'Budget: high to low' },
  { value: 'budget_low', label: 'Budget: low to high' },
  { value: 'popular', label: 'Most proposals' },
];

/** URL ⇄ filters, so searches are shareable and survive reloads. */
const readFilters = (params: URLSearchParams): Filters => {
  const num = (key: string) => (params.get(key) ? Number(params.get(key)) : undefined);
  const skills = params.get('skills');
  return {
    q: params.get('q') || undefined,
    category: params.get('category') || undefined,
    skills: skills ? skills.split(',').filter(Boolean) : undefined,
    budgetMin: num('budgetMin'),
    budgetMax: num('budgetMax'),
    budgetType: (params.get('budgetType') as Filters['budgetType']) || undefined,
    experienceLevel: (params.get('experienceLevel') as Filters['experienceLevel']) || undefined,
    locationType: (params.get('locationType') as Filters['locationType']) || undefined,
    lat: num('lat'),
    lng: num('lng'),
    radiusKm: num('radiusKm'),
    sort: (params.get('sort') as GigSort) || undefined,
    page: num('page'),
  };
};

const writeFilters = (filters: Filters): URLSearchParams => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return params;
};

export const GigListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const update = (patch: Partial<Filters>, resetPage = true) =>
    setSearchParams(writeFilters({ ...filters, ...patch, ...(resetPage && { page: undefined }) }), { replace: true });

  // Free-text inputs are edited locally and pushed to the URL once typing pauses.
  const [query, setQuery] = useState(filters.q ?? '');
  const [budgetDraft, setBudgetDraft] = useState({
    min: filters.budgetMin?.toString() ?? '',
    max: filters.budgetMax?.toString() ?? '',
  });
  const debouncedQuery = useDebouncedValue(query);
  const debouncedBudget = useDebouncedValue(budgetDraft);

  useEffect(() => {
    if ((debouncedQuery || undefined) !== filters.q) update({ q: debouncedQuery.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text
  }, [debouncedQuery]);

  useEffect(() => {
    const min = debouncedBudget.min ? Number(debouncedBudget.min) : undefined;
    const max = debouncedBudget.max ? Number(debouncedBudget.max) : undefined;
    if (min !== filters.budgetMin || max !== filters.budgetMax) update({ budgetMin: min, budgetMax: max });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced budget
  }, [debouncedBudget]);

  const gigsQuery = useGigs({ ...filters, limit: PAGE_SIZE });
  const categories = useCategories();
  const trending = useTrendingSkills();

  const activeCount = [
    filters.q,
    filters.category,
    filters.budgetType,
    filters.experienceLevel,
    filters.locationType,
    filters.budgetMin,
    filters.budgetMax,
    filters.lat,
  ].filter((v) => v !== undefined).length + (filters.skills?.length ?? 0);

  const clearAll = () => {
    setQuery('');
    setBudgetDraft({ min: '', max: '' });
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const gigs = gigsQuery.data?.items ?? [];
  const pagination = gigsQuery.data?.pagination;

  return (
    <div className="min-h-screen flex flex-col bg-[#020b16] text-white">
      <Navbar />

      <main className="flex-grow pt-28 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Find freelance work</h1>
              <p className="text-sm text-slate-400 mt-1">
                {pagination ? (
                  <>
                    <span className="text-indigo-400 font-semibold">{pagination.total}</span> open{' '}
                    {pagination.total === 1 ? 'project' : 'projects'} from verified clients
                  </>
                ) : (
                  'Open projects from verified clients'
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="gig-sort" className="text-xs text-slate-400">
                Sort by
              </label>
              <select
                id="gig-sort"
                value={filters.sort ?? 'newest'}
                onChange={(e) => update({ sort: e.target.value as GigSort })}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="relative max-w-3xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="search"
              aria-label="Search gigs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, skill (e.g. React, Flutter) or description…"
              className="w-full bg-[#081426] border border-slate-700/80 rounded-2xl py-3.5 pl-12 pr-10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-lg shadow-black/20"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="w-full lg:w-1/4 flex-shrink-0">
            <GigFilters
              value={filters}
              onChange={(patch) => update(patch)}
              onClearAll={clearAll}
              activeCount={activeCount}
              categories={categories.data ?? []}
              trendingSkills={trending.data ?? []}
              budgetDraft={budgetDraft}
              onBudgetDraftChange={setBudgetDraft}
            />
          </aside>

          <section className="w-full lg:w-3/4" aria-live="polite" aria-busy={gigsQuery.isFetching}>
            <div className="flex items-center justify-between mb-4 text-xs text-slate-400 min-h-5">
              {pagination && pagination.total > 0 && (
                <span>
                  Showing <strong className="text-white">{(pagination.page - 1) * pagination.limit + 1}</strong>–
                  <strong className="text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</strong> of{' '}
                  <strong className="text-slate-300">{pagination.total}</strong>
                </span>
              )}
              {activeCount > 0 && (
                <button onClick={clearAll} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium cursor-pointer">
                  <RefreshCw className="w-3 h-3" /> Reset filters
                </button>
              )}
            </div>

            {gigsQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="glass-card rounded-2xl p-5 border border-slate-800 h-72 animate-pulse">
                    <div className="h-5 w-3/4 bg-slate-800 rounded mb-3" />
                    <div className="h-3 w-1/3 bg-slate-800 rounded mb-6" />
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-800 rounded" />
                      <div className="h-3 bg-slate-800 rounded" />
                      <div className="h-3 w-2/3 bg-slate-800 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : gigsQuery.isError ? (
              <div className="glass-card rounded-2xl p-12 text-center border border-red-500/20">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-white mb-2">Couldn&apos;t load gigs</h2>
                <p className="text-sm text-slate-400 mb-6">{getErrorMessage(gigsQuery.error)}</p>
                <button onClick={() => gigsQuery.refetch()} className="btn-primary px-5 py-2.5 rounded-xl text-xs">
                  <span>Try again</span>
                </button>
              </div>
            ) : gigs.length > 0 ? (
              <>
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity ${gigsQuery.isFetching ? 'opacity-60' : ''}`}>
                  {gigs.map((gig) => (
                    <GigCard key={gig._id} gig={gig} />
                  ))}
                </div>
                {pagination && (
                  <div className="mt-8">
                    <Pagination
                      currentPage={pagination.page}
                      totalPages={pagination.pages}
                      onPageChange={(page) => {
                        update({ page }, false);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="glass-card rounded-2xl p-12 text-center border border-slate-800 my-4">
                <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-white mb-2">
                  {activeCount ? 'No matching projects found' : 'No open projects yet'}
                </h2>
                <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                  {activeCount
                    ? 'Try a different search, fewer skills, or a wider budget range.'
                    : 'New gigs appear here once an admin approves them.'}
                </p>
                {activeCount > 0 && (
                  <button onClick={clearAll} className="btn-primary px-5 py-2.5 rounded-xl text-xs">
                    <span>Clear all filters</span>
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};
