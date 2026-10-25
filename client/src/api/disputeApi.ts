import axiosInstance from './axiosInstance';
import { data, paginated, toParams } from './request';
import type { ApiResponse, CreateDisputeInput, Dispute, DisputeStatus, ResolveDisputeInput } from '../types';

export const disputeApi = {
  /** Only the gig's client or hired freelancer; the other party is derived server-side. */
  create: (input: CreateDisputeInput) => data(axiosInstance.post<ApiResponse<Dispute>>('/disputes', input)),

  /** Parties see their own disputes; admins see all. */
  list: (params?: { status?: DisputeStatus; gig?: string; page?: number; limit?: number }) =>
    paginated(axiosInstance.get<ApiResponse<Dispute[]>>('/disputes', { params: toParams(params) })),

  get: (id: string) => data(axiosInstance.get<ApiResponse<Dispute>>(`/disputes/${id}`)),

  /** Admin only. */
  resolve: (id: string, input: ResolveDisputeInput) =>
    data(axiosInstance.put<ApiResponse<Dispute>>(`/disputes/${id}/resolve`, input)),
};
