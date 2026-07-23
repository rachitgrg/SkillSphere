import axiosInstance from './axiosInstance';

export const reviewApi = {
  createReview: (data: {
    gigId: string;
    rating: number;
    title: string;
    comment: string;
    categories: { communication: number; quality: number; timeliness: number; value: number };
  }) =>
    axiosInstance.post('/reviews', data),

  getReviewsForUser: (userId: string, params?: { page?: number; limit?: number }) =>
    axiosInstance.get(`/reviews/user/${userId}`, { params }),

  getReviewsForGig: (gigId: string) =>
    axiosInstance.get(`/reviews/gig/${gigId}`),

  respondToReview: (reviewId: string, comment: string) =>
    axiosInstance.post(`/reviews/${reviewId}/respond`, { comment }),

  markHelpful: (reviewId: string) =>
    axiosInstance.post(`/reviews/${reviewId}/helpful`),

  getMyReviews: (params?: { type?: 'given' | 'received'; page?: number }) =>
    axiosInstance.get('/reviews/my-reviews', { params }),
};
