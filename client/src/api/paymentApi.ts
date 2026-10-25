import axiosInstance from './axiosInstance';
import { data, paginated, toParams } from './request';
import type {
  ApiResponse,
  CreateOrderInput,
  OrderResult,
  Payment,
  PaymentConfig,
  PaymentStatus,
  PaymentSummary,
  VerifyPaymentInput,
} from '../types';

export const paymentApi = {
  getConfig: () => data(axiosInstance.get<ApiResponse<PaymentConfig>>('/payments/config')),

  /** Creates a Razorpay order (test mode) for a milestone or amount; opens Checkout with the result. */
  createOrder: (input: CreateOrderInput) => data(axiosInstance.post<ApiResponse<OrderResult>>('/payments/orders', input)),

  /** Sends Checkout's success payload; the payment moves into escrow. */
  verify: (input: VerifyPaymentInput) => data(axiosInstance.post<ApiResponse<Payment>>('/payments/verify', input)),

  release: (paymentId: string) => data(axiosInstance.post<ApiResponse<Payment>>(`/payments/${paymentId}/release`)),

  refund: (paymentId: string, reason?: string) =>
    data(axiosInstance.post<ApiResponse<Payment>>(`/payments/${paymentId}/refund`, { reason })),

  getHistory: (params?: { status?: PaymentStatus; gig?: string; page?: number; limit?: number }) =>
    paginated(axiosInstance.get<ApiResponse<Payment[]>>('/payments', { params: toParams(params) })),

  getSummary: () => data(axiosInstance.get<ApiResponse<PaymentSummary>>('/payments/summary')),
};
