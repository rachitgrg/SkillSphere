import axiosInstance from './axiosInstance';
import { data } from './request';
import type { ApiResponse, AuthResponse, RegisterInput, User } from '../types';

export const authApi = {
  register: (input: RegisterInput) =>
    data(axiosInstance.post<ApiResponse<AuthResponse>>('/auth/register', input)),

  login: (input: { email: string; password: string }) =>
    data(axiosInstance.post<ApiResponse<AuthResponse>>('/auth/login', input)),

  /** Exchanges the httpOnly refresh cookie for a new access token. */
  refresh: () => data(axiosInstance.post<ApiResponse<AuthResponse>>('/auth/refresh')),

  logout: () => axiosInstance.post('/auth/logout'),

  getMe: () => data(axiosInstance.get<ApiResponse<User>>('/auth/me')),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    data(axiosInstance.put<ApiResponse<{ token: string }>>('/auth/change-password', input)),
};
