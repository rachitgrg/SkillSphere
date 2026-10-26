import axiosInstance from './axiosInstance';
import { data, paginated, toParams } from './request';
import type { ApiResponse, Gig, GigFilters, GigInput, GigInvitation, GigStatus, MyInvitation, ProgressLog, ProjectProgress } from '../types';

/** JSON when there are no files, multipart (field `files`) otherwise. */
const withFiles = ({ files = [], ...fields }: { files?: File[]; [key: string]: string | File[] | undefined }) => {
  if (!files.length) return fields;
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (typeof value === 'string' && value) form.append(key, value);
  files.forEach((f) => form.append('files', f));
  return form;
};

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

  getProgress: (id: string) => data(axiosInstance.get<ApiResponse<ProjectProgress>>(`/gigs/${id}/progress`)),

  addProgressLog: (id: string, input: { message: string; milestoneId?: string; files?: File[] }) =>
    data(axiosInstance.post<ApiResponse<ProgressLog>>(`/gigs/${id}/progress-logs`, withFiles(input))),

  milestoneAction: (id: string, milestoneId: string, action: 'start' | 'approve') =>
    data(axiosInstance.put<ApiResponse<Gig>>(`/gigs/${id}/milestones/${milestoneId}/${action}`)),

  setMilestoneProgress: (id: string, milestoneId: string, percent: number) =>
    data(axiosInstance.put<ApiResponse<Gig>>(`/gigs/${id}/milestones/${milestoneId}/progress`, { percent })),

  submitMilestone: (id: string, milestoneId: string, input: { note?: string; files?: File[] }) =>
    data(axiosInstance.put<ApiResponse<Gig>>(`/gigs/${id}/milestones/${milestoneId}/submit`, withFiles(input))),

  requestChanges: (id: string, milestoneId: string, note: string) =>
    data(axiosInstance.put<ApiResponse<Gig>>(`/gigs/${id}/milestones/${milestoneId}/request-changes`, { note })),

  completeGig: (id: string) => data(axiosInstance.put<ApiResponse<Gig>>(`/gigs/${id}/complete`)),

  declineInvitation: (id: string) => data(axiosInstance.put<ApiResponse<void>>(`/gigs/${id}/invitation`, { status: 'declined' })),
};
