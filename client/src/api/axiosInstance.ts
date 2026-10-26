import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const axiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  withCredentials: true, // sends the httpOnly refresh cookie to /auth/*
  // No default Content-Type: axios sends JSON for objects and multipart (with boundary) for FormData.
});

/**
 * Hooks the store provides at startup (see main.tsx). Kept as injected callbacks so
 * this module doesn't import the store and create an import cycle.
 */
interface AuthHooks {
  getToken: () => string | null;
  onRefreshed: (data: { token: string; user: unknown }) => void;
  onAuthFailure: () => void;
}

let hooks: AuthHooks = {
  getToken: () => null,
  onRefreshed: () => {},
  onAuthFailure: () => {},
};

export const configureAuth = (authHooks: AuthHooks) => {
  hooks = authHooks;
};

/** Single-flight: concurrent 401s share one refresh request. */
let refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = axiosInstance
      .post('/auth/refresh')
      .then((res) => {
        const data = res.data.data as { token: string; user: unknown };
        hooks.onRefreshed(data);
        return data.token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

axiosInstance.interceptors.request.use((config) => {
  const token = hooks.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthRequest = config?.url?.startsWith('/auth/');

    if (error.response?.status === 401 && config && !isAuthRequest && !config._retried) {
      config._retried = true;
      try {
        const token = await refreshAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(config);
      } catch {
        hooks.onAuthFailure();
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
