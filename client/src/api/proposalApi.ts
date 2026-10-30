import axiosInstance from './axiosInstance';
import { data, paginated, toParams } from './request';
import type { ApiResponse, GigProposal, Proposal, ProposalInput, ProposalStatus } from '../types';

export const proposalApi = {
  submit: (input: ProposalInput) => data(axiosInstance.post<ApiResponse<Proposal>>('/proposals', input)),

  /** The signed-in freelancer's proposals (gig populated). */
  getMine: (params?: { status?: ProposalStatus[]; page?: number; limit?: number }) =>
    paginated(axiosInstance.get<ApiResponse<Proposal[]>>('/proposals/mine', { params: toParams(params) })),

  /** Gig owner (or admin): all proposals for a gig. */
  getForGig: (gigId: string) => data(axiosInstance.get<ApiResponse<GigProposal[]>>(`/proposals/gig/${gigId}`)),

  getProposal: (id: string) => data(axiosInstance.get<ApiResponse<Proposal>>(`/proposals/${id}`)),

  /** Client: accept (hires the freelancer), reject, or mark as negotiating. */
  updateStatus: (id: string, status: 'accepted' | 'rejected' | 'negotiating', clientNotes?: string) =>
    data(axiosInstance.put<ApiResponse<Proposal>>(`/proposals/${id}/status`, { status, clientNotes })),

  /** Either party counters; the latest amount becomes finalAmount. */
  negotiate: (id: string, amount: number, message: string) =>
    data(axiosInstance.post<ApiResponse<Proposal>>(`/proposals/${id}/negotiate`, { amount, message })),
  /** Freelancer accepts the client's last counter-offer. */
  acceptOffer: (id: string) => data(axiosInstance.post<ApiResponse<Proposal>>(`/proposals/${id}/accept-offer`)),

  withdraw: (id: string) => data(axiosInstance.put<ApiResponse<Proposal>>(`/proposals/${id}/withdraw`)),
};
