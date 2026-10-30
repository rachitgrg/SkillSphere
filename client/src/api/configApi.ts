import axiosInstance from './axiosInstance';
import { data } from './request';
import type { ApiResponse, PlatformConfig, PlatformStats } from '../types';

export const configApi = {
  get: () => data(axiosInstance.get<ApiResponse<PlatformConfig>>('/config')),
  stats: () => data(axiosInstance.get<ApiResponse<PlatformStats>>('/config/stats')),
};
