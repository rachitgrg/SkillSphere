import axiosInstance from './axiosInstance';
import { data } from './request';
import type { ApiResponse, Review, ReviewBreakdown, ReviewCategories } from '../types';

export const reviewApi = {
  /** Only the client or hired freelancer of a completed gig; the reviewee is derived server-side. */
  create: (input: { gigId: string; categories: ReviewCategories; comment: string }) =>
    data(axiosInstance.post<ApiResponse<Review>>('/reviews', input)),

  getForUser: (userId: string) => data(axiosInstance.get<ApiResponse<Review[]>>(`/reviews/user/${userId}`)),

  getBreakdown: (userId: string) =>
    data(axiosInstance.get<ApiResponse<ReviewBreakdown>>(`/reviews/user/${userId}/breakdown`)),

  reply: (reviewId: string, response: string) =>
    data(axiosInstance.post<ApiResponse<Review>>(`/reviews/${reviewId}/reply`, { response })),

  report: (reviewId: string, reason: string) => axiosInstance.post(`/reviews/${reviewId}/report`, { reason }),
};
