import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck, Star, Users } from 'lucide-react';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { StatusTabs } from '../../components/common/StatusTabs';
import { QueryState } from '../../components/common/QueryState';
import { Pagination } from '../../components/common/Pagination';
import { Avatar } from '../../components/common/Avatar';
import { GigCard } from '../../components/gigs/GigCard';
import { SkillBadge } from '../../components/profile/SkillBadge';
import { searchApi } from '../../api/searchApi';
import { keys } from '../../hooks/queries/keys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { FreelancerFilters, FreelancerSort, GigFilters } from '../../types';
import { formatCurrency, fullName } from '../../utils/helpers';

type Tab = 'gigs' | 'freelancers';
const selectClass = 'bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white';

/** /search?tab=gigs|freelancers&q=… — every filter lives in the URL. */
export function SearchResultsPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'freelancers' ? 'freelancers' : 'gigs';
  const [query, setQuery] = useState(params.get('q') ?? '');
  const debounced = useDebouncedValue(query);

  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if ((params.get('q') ?? '') !== debounced.trim()) set({ q: debounced.trim() || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to the debounced query
  }, [debounced]);

  const page = Number(params.get('page')) || 1;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navbar />
      <main className="flex-grow pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <h1 className="text-3xl font-bold text-white mb-6">Search</h1>
        <div className="relative max-w-3xl mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="search"
            autoFocus
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'gigs' ? 'Search gigs by title, skill or description…' : 'Search freelancers by skill or title…'}
            className="w-full bg-[#081426] border border-slate-700/80 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <StatusTabs label="Search in" value={tab} onChange={(t) => set({ tab: t })} tabs={[{ value: 'gigs', label: 'Gigs' }, { value: 'freelancers', label: 'Freelancers' }]} />
        {tab === 'gigs' ? <GigResults params={params} page={page} onPage={(p) => set({ page: String(p) })} /> : <FreelancerResults params={params} page={page} set={set} />}
      </main>
      <Footer />
    </div>
  );
}

function GigResults({ params, page, onPage }: { params: URLSearchParams; page: number; onPage: (p: number) => void }) {
  const filters: GigFilters = { q: params.get('q') || undefined, page, limit: 12 };
  const results = useQuery({ queryKey: keys.search.gigs(filters), queryFn: () => searchApi.searchGigs(filters), placeholderData: keepPreviousData });
  return (
    <QueryState isLoading={results.isLoading} isError={results.isError} error={results.error} onRetry={() => results.refetch()} isEmpty={!results.data?.items.length} empty={{ title: 'No gigs found', description: 'Try other keywords, or browse the marketplace with filters.' }}>
      <p className="text-sm text-slate-400 mb-4">{results.data?.pagination.total} gigs · <Link to={`/gigs${params.get('q') ? `?q=${encodeURIComponent(params.get('q')!)}` : ''}`} className="text-indigo-400 hover:underline">more filters in the marketplace</Link></p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{results.data?.items.map((g) => <GigCard key={g._id} gig={g} />)}</div>
      {results.data && <div className="mt-8"><Pagination currentPage={page} totalPages={results.data.pagination.pages} onPageChange={onPage} /></div>}
    </QueryState>
  );
}

function FreelancerResults({ params, page, set }: { params: URLSearchParams; page: number; set: (patch: Record<string, string | undefined>) => void }) {
  const filters: FreelancerFilters = useMemo(() => ({
    q: params.get('q') || undefined,
    skills: params.get('skills')?.split(',').filter(Boolean),
    minRate: params.get('minRate') ? Number(params.get('minRate')) : undefined,
    maxRate: params.get('maxRate') ? Number(params.get('maxRate')) : undefined,
    minRating: params.get('minRating') ? Number(params.get('minRating')) : undefined,
    experience: (params.get('experience') as FreelancerFilters['experience']) || undefined,
    sort: (params.get('sort') as FreelancerSort) || undefined,
    page,
    limit: 12,
  }), [params, page]);
  const results = useQuery({ queryKey: keys.search.freelancers(filters), queryFn: () => searchApi.searchFreelancers(filters), placeholderData: keepPreviousData });

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="lg:w-64 shrink-0 glass-card rounded-2xl border border-slate-800 p-4 space-y-4 h-fit">
        <div>
          <label htmlFor="f-skills" className="block text-xs text-slate-400 mb-1">Skills (comma separated)</label>
          <input id="f-skills" defaultValue={params.get('skills') ?? ''} onBlur={(e) => set({ skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean).join(',') || undefined })} className={`${selectClass} w-full`} placeholder="React, Node.js" />
        </div>
        <fieldset>
          <legend className="text-xs text-slate-400 mb-1">Hourly rate (₹)</legend>
          <div className="flex gap-2">
            <input aria-label="Minimum rate" type="number" min={0} defaultValue={params.get('minRate') ?? ''} onBlur={(e) => set({ minRate: e.target.value || undefined })} className={`${selectClass} w-full`} placeholder="Min" />
            <input aria-label="Maximum rate" type="number" min={0} defaultValue={params.get('maxRate') ?? ''} onBlur={(e) => set({ maxRate: e.target.value || undefined })} className={`${selectClass} w-full`} placeholder="Max" />
          </div>
        </fieldset>
        <div>
          <label htmlFor="f-rating" className="block text-xs text-slate-400 mb-1">Minimum rating</label>
          <select id="f-rating" value={params.get('minRating') ?? ''} onChange={(e) => set({ minRating: e.target.value || undefined })} className={`${selectClass} w-full`}>
            <option value="">Any</option><option value="3">3+</option><option value="4">4+</option><option value="4.5">4.5+</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-exp" className="block text-xs text-slate-400 mb-1">Experience</label>
          <select id="f-exp" value={params.get('experience') ?? ''} onChange={(e) => set({ experience: e.target.value || undefined })} className={`${selectClass} w-full`}>
            <option value="">Any</option><option value="intermediate">2+ years</option><option value="expert">5+ years</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-sort" className="block text-xs text-slate-400 mb-1">Sort by</label>
          <select id="f-sort" value={params.get('sort') ?? ''} onChange={(e) => set({ sort: e.target.value || undefined })} className={`${selectClass} w-full`}>
            <option value="">Best match</option><option value="rating">Rating</option><option value="rate_low">Rate: low to high</option><option value="rate_high">Rate: high to low</option><option value="experience">Most jobs done</option>
          </select>
        </div>
      </aside>
      <div className="flex-1">
        <QueryState isLoading={results.isLoading} isError={results.isError} error={results.error} onRetry={() => results.refetch()} isEmpty={!results.data?.items.length} empty={{ icon: <Users className="w-8 h-8" />, title: 'No freelancers found', description: 'Widen your filters.' }}>
          <div className="grid sm:grid-cols-2 gap-4">
            {results.data?.items.map((f) => (
              <Link key={f._id} to={`/freelancers/${f.user._id}`} className="glass-card rounded-2xl border border-slate-800 p-5 hover:border-slate-700 block">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar src={f.user.avatar} firstName={f.user.firstName} lastName={f.user.lastName} size="md" />
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate flex items-center gap-1">{fullName(f.user)}{f.user.isVerified && <ShieldCheck className="w-4 h-4 text-emerald-400" aria-label="Verified" />}</p>
                    <p className="text-xs text-slate-400 truncate">{f.title}{f.user.address?.city ? ` · ${f.user.address.city}` : ''}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">{f.skills.slice(0, 4).map((s) => <SkillBadge key={s.name} skill={s} />)}</div>
                <div className="flex justify-between text-sm">
                  <span className="text-white font-medium">{f.hourlyRate ? `${formatCurrency(f.hourlyRate)}/hr` : 'Rate on request'}</span>
                  <span className="flex items-center gap-1 text-slate-300"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />{f.totalReviews ? `${f.averageRating.toFixed(1)} (${f.totalReviews})` : 'New'}</span>
                </div>
              </Link>
            ))}
          </div>
          {results.data && <div className="mt-8"><Pagination currentPage={page} totalPages={results.data.pagination.pages} onPageChange={(p) => set({ page: String(p) })} /></div>}
        </QueryState>
      </div>
    </div>
  );
}
