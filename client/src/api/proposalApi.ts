import axiosInstance from './axiosInstance';
import type { ProposalFormData } from '../types';

export const proposalApi = {
  submitProposal: (gigId: string, data: ProposalFormData) =>
    axiosInstance.post(`/proposals/gig/${gigId}`, data),

  getProposalsForGig: (gigId: string) =>
    axiosInstance.get(`/proposals/gig/${gigId}`),

  getMyProposals: (params?: { status?: string; page?: number; limit?: number }) =>
    axiosInstance.get('/proposals/my-proposals', { params }),

  getProposalById: (id: string) =>
    axiosInstance.get(`/proposals/${id}`),

  updateProposalStatus: (id: string, status: string, note?: string) =>
    axiosInstance.put(`/proposals/${id}/status`, { status, note }),

  withdrawProposal: (id: string) =>
    axiosInstance.put(`/proposals/${id}/withdraw`),

  getReceivedProposals: (params?: { status?: string; page?: number; limit?: number }) =>
    axiosInstance.get('/proposals/received', { params }),
};
