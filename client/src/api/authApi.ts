import axiosInstance from './axiosInstance';

export const authApi = {
  login: (data: { email: string; password: string }) =>
    axiosInstance.post('/auth/login', data),

  register: (data: { firstName: string; lastName: string; email: string; password: string; role: string }) =>
    axiosInstance.post('/auth/register', data),

  getMe: () =>
    axiosInstance.get('/auth/me'),

  verifyEmail: (token: string) =>
    axiosInstance.get(`/auth/verify-email/${token}`),

  forgotPassword: (email: string) =>
    axiosInstance.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    axiosInstance.post(`/auth/reset-password/${token}`, { password }),

  verifyTwoFactor: (code: string) =>
    axiosInstance.post('/auth/verify-2fa', { code }),

  enableTwoFactor: () =>
    axiosInstance.post('/auth/enable-2fa'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    axiosInstance.put('/auth/change-password', data),

  googleAuth: (tokenId: string) =>
    axiosInstance.post('/auth/google', { tokenId }),

  refresh: () =>
    axiosInstance.post('/auth/refresh'),

  logout: () =>
    axiosInstance.post('/auth/logout'),
};
