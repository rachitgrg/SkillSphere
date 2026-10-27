import axiosInstance from './axiosInstance';
import { data, paginated, toParams, withFiles } from './request';
import type { ApiResponse, CreateDisputeInput, Dispute, DisputeStatus, Evidence, ResolveDisputeInput } from '../types';

export const disputeApi = {
  /** Only the gig's client or hired freelancer; the other party is derived server-side. */
  create: (input: CreateDisputeInput) => data(axiosInstance.post<ApiResponse<Dispute>>('/disputes', input)),

  /** Parties see their own disputes; admins see all. */
  list: (params?: { status?: DisputeStatus; gig?: string; page?: number; limit?: number }) =>
    paginated(axiosInstance.get<ApiResponse<Dispute[]>>('/disputes', { params: toParams(params) })),

  get: (id: string) => data(axiosInstance.get<ApiResponse<Dispute>>(`/disputes/${id}`)),

  /** Parties only; up to 5 files per call. 503 when uploads are not configured. */
  addEvidence: (id: string, files: File[], description?: string) =>
    data(axiosInstance.post<ApiResponse<Evidence[]>>(`/disputes/${id}/evidence`, withFiles({ files, description }))),

  /** Mediation thread (parties and admins), optionally with up to 3 files. */
  addMessage: (id: string, input: { content: string; files?: File[] }) =>
    data(axiosInstance.post<ApiResponse<Pick<Dispute, '_id' | 'messages' | 'status'>>>(`/disputes/${id}/messages`, withFiles(input))),

  /** Admin only: mark under review, or close without moving money. */
  setStatus: (id: string, input: { status: 'under_review' | 'closed'; note?: string }) =>
    data(axiosInstance.put<ApiResponse<Dispute>>(`/disputes/${id}/status`, input)),

  /** Admin only. */
  resolve: (id: string, input: ResolveDisputeInput) =>
    data(axiosInstance.put<ApiResponse<Dispute>>(`/disputes/${id}/resolve`, input)),
};
