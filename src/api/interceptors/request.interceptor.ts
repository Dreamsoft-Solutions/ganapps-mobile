import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { secureStorage } from '@/utils/secure-storage';
import { refreshAccessToken } from './refresh-token';

const PREEMPTIVE_REFRESH_MS = 2 * 60 * 1000;

export const requestInterceptor = {
  onFulfilled: async (config: InternalAxiosRequestConfig) => {
    const state = useAuthStore.getState();
    let token = state.token;

    if (token && state.expiresAt) {
      const remaining = state.expiresAt - Date.now();
      if (remaining < PREEMPTIVE_REFRESH_MS) {
        try {
          const refreshToken = await secureStorage.getRefreshToken();
          if (refreshToken) {
            const tokens = await refreshAccessToken(refreshToken);
            token = tokens.accessToken;
          }
        } catch {
          // will be caught by error interceptor
        }
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  onRejected: (error: AxiosError) => Promise.reject(error),
};
