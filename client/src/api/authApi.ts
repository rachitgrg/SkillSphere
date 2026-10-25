import axiosInstance from './axiosInstance';
import { data } from './request';
import type { ApiResponse, AuthResponse, LoginResult, RegisterInput, TwoFactorSetup, User } from '../types';

export const authApi = {
  register: (input: RegisterInput) =>
    data(axiosInstance.post<ApiResponse<AuthResponse>>('/auth/register', input)),

  /** Returns a session, or `{ twoFactorRequired, tempToken }` when 2FA is on. */
  login: (input: { email: string; password: string }) =>
    data(axiosInstance.post<ApiResponse<LoginResult>>('/auth/login', input)),

  /** Exchanges the httpOnly refresh cookie for a new access token. */
  refresh: () => data(axiosInstance.post<ApiResponse<AuthResponse>>('/auth/refresh')),

  logout: () => axiosInstance.post('/auth/logout'),

  getMe: () => data(axiosInstance.get<ApiResponse<User>>('/auth/me')),

  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    data(axiosInstance.put<ApiResponse<{ token: string }>>('/auth/change-password', input)),

  verifyEmail: (token: string) => data(axiosInstance.get<ApiResponse<{ email: string }>>(`/auth/verify-email/${token}`)),

  resendVerification: () => axiosInstance.post('/auth/resend-verification'),

  forgotPassword: (email: string) => axiosInstance.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) => axiosInstance.post(`/auth/reset-password/${token}`, { password }),

  setupTwoFactor: () => data(axiosInstance.post<ApiResponse<TwoFactorSetup>>('/auth/2fa/setup')),

  enableTwoFactor: (code: string) =>
    data(axiosInstance.post<ApiResponse<{ backupCodes: string[] }>>('/auth/2fa/enable', { code })),

  disableTwoFactor: (password: string, code: string) => axiosInstance.post('/auth/2fa/disable', { password, code }),

  /** Second login step. */
  verifyTwoFactor: (tempToken: string, code: string) =>
    data(axiosInstance.post<ApiResponse<AuthResponse>>('/auth/2fa/verify', { tempToken, code })),

  getProviders: () => data(axiosInstance.get<ApiResponse<{ google: boolean }>>('/auth/providers')),

  /** First Google login: pick a role; returns a fresh session. */
  chooseRole: (role: 'client' | 'freelancer') =>
    data(axiosInstance.post<ApiResponse<AuthResponse>>('/auth/choose-role', { role })),
};
