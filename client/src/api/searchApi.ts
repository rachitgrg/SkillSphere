import axiosInstance from './axiosInstance';
import { data, paginated, toParams } from './request';
import type {
  ApiResponse,
  FreelancerFilters,
  FreelancerSearchResult,
  Gig,
  GigFilters,
  SearchSuggestions,
  TrendingSkill,
} from '../types';

export const searchApi = {
  searchGigs: (filters?: GigFilters) =>
    paginated(axiosInstance.get<ApiResponse<Gig[]>>('/search/gigs', { params: toParams(filters) })),

  searchFreelancers: (filters?: FreelancerFilters) =>
    paginated(
      axiosInstance.get<ApiResponse<FreelancerSearchResult[]>>('/search/freelancers', { params: toParams(filters) })
    ),

  getTrendingSkills: (params?: { days?: number; limit?: number }) =>
    data(axiosInstance.get<ApiResponse<TrendingSkill[]>>('/search/trending-skills', { params: toParams(params) })),

  getCategories: () => data(axiosInstance.get<ApiResponse<{ category: string; count: number }[]>>('/search/categories')),

  getSuggestions: (q: string) =>
    data(axiosInstance.get<ApiResponse<SearchSuggestions>>('/search/suggestions', { params: { q } })),
};
