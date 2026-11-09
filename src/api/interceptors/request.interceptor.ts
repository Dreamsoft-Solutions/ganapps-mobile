import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { secureStorage } from '@/utils/secure-storage';
import type { SessionBoundRequestConfig } from '../types/session-bound-request';
import { refreshAccessToken } from './refresh-token';

const PREEMPTIVE_REFRESH_MS = 2 * 60 * 1000;

export const requestInterceptor = {
  onFulfilled: async (config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const sessionConfig = config as InternalAxiosRequestConfig & SessionBoundRequestConfig;
    const expectedUserId = sessionConfig.expectedAuthUserId;
    const state = await useAuthStore.getState().getStableSession();
    const requestUserId =
      sessionConfig.requestAuthUserId !== undefined
        ? sessionConfig.requestAuthUserId
        : (expectedUserId ?? state.user?.id ?? null);
    let requestVersion = sessionConfig.requestAuthVersion ?? state.sessionVersion;
    if ((state.user?.id ?? null) !== requestUserId || (expectedUserId && requestUserId !== expectedUserId)) {
      throw new Error('Authenticated User changed before the request was sent');
    }
    let token = state.token;

    if (token && state.expiresAt) {
      const remaining = state.expiresAt - Date.now();
      if (remaining < PREEMPTIVE_REFRESH_MS) {
        try {
          const refreshToken = await secureStorage.getRefreshToken();
          const current = await useAuthStore.getState().getStableSession();
          if ((current.user?.id ?? null) !== requestUserId) {
            throw new Error('Authenticated User changed before token refresh');
          }
          if (current.sessionVersion !== requestVersion) {
            if (requestUserId !== null && current.token && current.token !== token) {
              token = current.token;
              requestVersion = current.sessionVersion;
            } else {
              throw new Error('Authenticated session changed before token refresh');
            }
          }
          if (current.token && current.token !== token) {
            token = current.token;
          } else if (refreshToken) {
            const tokens = await refreshAccessToken(refreshToken, requestUserId ?? undefined, requestVersion);
            token = tokens.accessToken;
            requestVersion = (await useAuthStore.getState().getStableSession()).sessionVersion;
          }
        } catch {
          // will be caught by error interceptor
        }
      }
    }

    const current = await useAuthStore.getState().getStableSession();
    if ((current.user?.id ?? null) !== requestUserId || (expectedUserId && requestUserId !== expectedUserId)) {
      throw new Error('Authenticated User changed before the request was sent');
    }
    if (current.sessionVersion !== requestVersion) {
      if (requestUserId !== null && current.token && current.token !== token) {
        token = current.token;
        requestVersion = current.sessionVersion;
      } else {
        throw new Error('Authenticated session changed before the request was sent');
      }
    }

    sessionConfig.requestAuthUserId = requestUserId;
    sessionConfig.requestAuthToken = token;
    sessionConfig.requestAuthVersion = requestVersion;
    if (token) {
      sessionConfig.headers.Authorization = `Bearer ${token}`;
    }

    return sessionConfig;
  },
  onRejected: (error: AxiosError): Promise<never> => Promise.reject(error),
};
