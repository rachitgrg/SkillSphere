import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { gigApi } from '../../api/gigApi';
import { searchApi } from '../../api/searchApi';
import type { GigFilters } from '../../types';
import { keys } from './keys';

/** Public marketplace listing with server-side filters; keeps the previous page while loading the next. */
export const useGigs = (filters: GigFilters) =>
  useQuery({
    queryKey: keys.gigs.list(filters),
    queryFn: () => gigApi.getGigs(filters),
    placeholderData: keepPreviousData,
  });

export const useGig = (id: string | undefined) =>
  useQuery({
    queryKey: keys.gigs.detail(id ?? ''),
    queryFn: () => gigApi.getGig(id!),
    enabled: Boolean(id),
  });

export const useCategories = () =>
  useQuery({ queryKey: keys.search.categories, queryFn: searchApi.getCategories, staleTime: 5 * 60_000 });

export const useTrendingSkills = () =>
  useQuery({ queryKey: keys.search.trending, queryFn: () => searchApi.getTrendingSkills({ limit: 20 }), staleTime: 10 * 60_000 });
