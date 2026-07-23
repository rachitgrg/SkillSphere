import axiosInstance from './axiosInstance';

export const paymentApi = {
  createPayment: (data: { gigId: string; milestoneId?: string; amount: number; paymentMethod: string }) =>
    axiosInstance.post('/payments', data),

  getPaymentHistory: (params?: { page?: number; limit?: number; status?: string }) =>
    axiosInstance.get('/payments/history', { params }),

  getPaymentById: (id: string) =>
    axiosInstance.get(`/payments/${id}`),

  getEarnings: (params?: { period?: string }) =>
    axiosInstance.get('/payments/earnings', { params }),

  requestPayout: (data: { amount: number; method: string }) =>
    axiosInstance.post('/payments/payout', data),

  getEscrowBalance: () =>
    axiosInstance.get('/payments/escrow'),

  releaseEscrow: (paymentId: string) =>
    axiosInstance.post(`/payments/${paymentId}/release`),

  refundPayment: (paymentId: string, reason: string) =>
    axiosInstance.post(`/payments/${paymentId}/refund`, { reason }),
};
