import axiosInstance from './axiosInstance';
import { data } from './request';
import type { ApiResponse, CareerReport, GigRecommendation, MatchScore } from '../types';

export const aiApi = {
  /** Client: ranked freelancers for one of their gigs. */
  getGigMatches: (gigId: string, limit = 10) =>
    data(axiosInstance.get<ApiResponse<MatchScore[]>>(`/ai/gigs/${gigId}/matches`, { params: { limit } })),

  /** Freelancer: open gigs ranked for them. */
  getRecommendations: (limit = 10) =>
    data(axiosInstance.get<ApiResponse<GigRecommendation[]>>('/ai/recommendations', { params: { limit } })),

  analyzeCareer: (resumeText: string) =>
    data(axiosInstance.post<ApiResponse<CareerReport>>('/ai/career-analysis', { resumeText })),

  /** Analyses an uploaded PDF/TXT, or the resume stored on the profile when `file` is omitted. */
  analyzeResume: (file?: File) => {
    const form = new FormData();
    if (file) form.append('resume', file);
    return data(axiosInstance.post<ApiResponse<CareerReport>>('/ai/resume-analysis', form));
  },
};
