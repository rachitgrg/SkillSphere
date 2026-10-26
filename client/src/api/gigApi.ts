import axiosInstance from './axiosInstance';
import { data, paginated, toParams } from './request';
import type { ApiResponse, Gig, GigFilters, GigInput, GigInvitation, GigStatus, MyInvitation } from '../types';

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

  /** Up to 5 files per call (10 per gig). */
  addAttachments: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return data(axiosInstance.post<ApiResponse<Gig>>(`/gigs/${id}/attachments`, form));
  },

  removeAttachment: (id: string, attachmentId: string) =>
    data(axiosInstance.delete<ApiResponse<Gig>>(`/gigs/${id}/attachments/${attachmentId}`)),

  invite: (id: string, freelancerId: string, message?: string) =>
    data(axiosInstance.post<ApiResponse<GigInvitation[]>>(`/gigs/${id}/invite`, { freelancerId, message })),

  /** Freelancer: open gigs I was invited to. */
  getInvitations: () => data(axiosInstance.get<ApiResponse<MyInvitation[]>>('/gigs/invitations')),

  declineInvitation: (id: string) => data(axiosInstance.put<ApiResponse<void>>(`/gigs/${id}/invitation`, { status: 'declined' })),
};
