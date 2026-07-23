import axiosInstance from './axiosInstance';
import type { FreelancerFilters } from '../types';

export const userApi = {
  getProfile: () =>
    axiosInstance.get('/users/profile'),

  updateProfile: (data: Record<string, unknown>) =>
    axiosInstance.put('/users/profile', data),

  uploadAvatar: (formData: FormData) =>
    axiosInstance.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  uploadCover: (formData: FormData) =>
    axiosInstance.post('/users/cover', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  getFreelancerProfile: (id: string) =>
    axiosInstance.get(`/users/freelancers/${id}`),

  getClientProfile: (id: string) =>
    axiosInstance.get(`/users/clients/${id}`),

  searchFreelancers: (filters?: FreelancerFilters) =>
    axiosInstance.get('/users/freelancers', { params: filters }),

  getFreelancerStats: () =>
    axiosInstance.get('/users/freelancer/stats'),

  getClientStats: () =>
    axiosInstance.get('/users/client/stats'),

  updateAvailability: (availability: string) =>
    axiosInstance.put('/users/availability', { availability }),

  getPortfolio: (userId: string) =>
    axiosInstance.get(`/users/${userId}/portfolio`),

  addPortfolioItem: (data: FormData) =>
    axiosInstance.post('/users/portfolio', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  deletePortfolioItem: (id: string) =>
    axiosInstance.delete(`/users/portfolio/${id}`),

  getAnalytics: (period?: string) =>
    axiosInstance.get('/users/analytics', { params: { period } }),
};
