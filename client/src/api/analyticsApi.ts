import axiosInstance from './axiosInstance';
import { data } from './request';
import type { AnalyticsPeriod, ApiResponse, ClientAnalytics, FreelancerAnalytics } from '../types';

export const analyticsApi = {
  getFreelancer: (period: AnalyticsPeriod = '12m') =>
    data(axiosInstance.get<ApiResponse<FreelancerAnalytics>>('/analytics/freelancer', { params: { period } })),

  getClient: (period: AnalyticsPeriod = '12m') =>
    data(axiosInstance.get<ApiResponse<ClientAnalytics>>('/analytics/client', { params: { period } })),
};
