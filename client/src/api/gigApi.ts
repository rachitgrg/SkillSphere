import axiosInstance from './axiosInstance';
import { data, paginated, toParams } from './request';
import type { ApiResponse, Gig, GigFilters, GigInput, GigStatus } from '../types';

export const gigApi = {
  /** Public marketplace: open, public gigs only. */
  getGigs: (filters?: GigFilters) =>
    paginated(axiosInstance.get<ApiResponse<Gig[]>>('/gigs', { params: toParams(filters) })),

  getGig: (id: string) => data(axiosInstance.get<ApiResponse<Gig>>(`/gigs/${id}`)),

  /** The signed-in client's gigs in every status. */
  getMyGigs: (params?: { status?: GigStatus[]; page?: number; limit?: number }) =>
    paginated(axiosInstance.get<ApiResponse<Gig[]>>('/gigs/mine', { params: toParams(params) })),

  /** New gigs go to the admin approval queue (`pending_approval`). */
  createGig: (input: GigInput) => data(axiosInstance.post<ApiResponse<Gig>>('/gigs', input)),

  updateGig: (id: string, input: Partial<GigInput>) => data(axiosInstance.put<ApiResponse<Gig>>(`/gigs/${id}`, input)),

  cancelGig: (id: string) => data(axiosInstance.put<ApiResponse<Gig>>(`/gigs/${id}/cancel`)),

  deleteGig: (id: string) => axiosInstance.delete(`/gigs/${id}`),
};
