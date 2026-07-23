import axiosInstance from './axiosInstance';
import type { GigFilters, GigFormData } from '../types';

export const gigApi = {
  getGigs: (filters?: GigFilters) =>
    axiosInstance.get('/gigs', { params: filters }),

  getGigById: (id: string) =>
    axiosInstance.get(`/gigs/${id}`),

  createGig: (data: GigFormData) =>
    axiosInstance.post('/gigs', data),

  updateGig: (id: string, data: Partial<GigFormData>) =>
    axiosInstance.put(`/gigs/${id}`, data),

  deleteGig: (id: string) =>
    axiosInstance.delete(`/gigs/${id}`),

  getMyGigs: (params?: { status?: string; page?: number; limit?: number }) =>
    axiosInstance.get('/gigs/my-gigs', { params }),

  getCategories: () =>
    axiosInstance.get('/gigs/categories'),

  uploadAttachment: (gigId: string, formData: FormData) =>
    axiosInstance.post(`/gigs/${gigId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateMilestoneStatus: (gigId: string, milestoneId: string, status: string) =>
    axiosInstance.put(`/gigs/${gigId}/milestones/${milestoneId}`, { status }),

  getFeaturedGigs: () =>
    axiosInstance.get('/gigs/featured'),

  getRelatedGigs: (id: string) =>
    axiosInstance.get(`/gigs/${id}/related`),
};
