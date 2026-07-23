import axiosInstance from './axiosInstance';

export const searchApi = {
  searchGigs: (query: string, filters?: Record<string, unknown>) =>
    axiosInstance.get('/search/gigs', { params: { q: query, ...filters } }),

  searchFreelancers: (query: string, filters?: Record<string, unknown>) =>
    axiosInstance.get('/search/freelancers', { params: { q: query, ...filters } }),

  getSuggestions: (query: string) =>
    axiosInstance.get('/search/suggestions', { params: { q: query } }),

  getPopularSearches: () =>
    axiosInstance.get('/search/popular'),

  getTrendingSkills: () =>
    axiosInstance.get('/search/trending-skills'),
};
