import axiosInstance from './axiosInstance';
import { data } from './request';
import type { ApiResponse, PlatformConfig } from '../types';

export const configApi = {
  get: () => data(axiosInstance.get<ApiResponse<PlatformConfig>>('/config')),
};
