import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { secureStorage } from '@/utils/secure-storage';
import type { SessionBoundRequestConfig } from '../types/session-bound-request';
import { refreshAccessToken } from './refresh-token';

const PREEMPTIVE_REFRESH_MS = 2 * 60 * 1000;

export const requestInterceptor = {
  onFulfilled: async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const expectedUserId = (config as SessionBoundRequestConfig).expectedAuthUserId;
    const state = useAuthStore.getState();
    if (expectedUserId && state.user?.id !== expectedUserId) {
      throw new Error('Authenticated User changed before the request was sent');
    }
    let token = state.token;

    if (token && state.expiresAt) {
      const remaining = state.expiresAt - Date.now();
      if (remaining < PREEMPTIVE_REFRESH_MS) {
        try {
          const refreshToken = await secureStorage.getRefreshToken();
          if (refreshToken) {
            const tokens = await refreshAccessToken(refreshToken, expectedUserId);
            token = tokens.accessToken;
          }
        } catch {
          // will be caught by error interceptor
        }
      }
    }

    if (expectedUserId && useAuthStore.getState().user?.id !== expectedUserId) {
      throw new Error('Authenticated User changed before the request was sent');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  onRejected: (error: AxiosError): Promise<never> => Promise.reject(error),
};
