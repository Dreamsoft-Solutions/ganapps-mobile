import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/utils/error-handling';
import { secureStorage } from '@/utils/secure-storage';
import axiosInstance from '../axios-instance';
import { refreshAccessToken } from './refresh-token';

interface QueueItem {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: QueueItem[] = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((item) => {
    if (error || !token) {
      item.reject(error);
    } else {
      item.resolve(token);
    }
  });
  failedQueue = [];
}

export const errorInterceptor = {
  onRejected: async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      const refreshToken = await secureStorage.getRefreshToken();

      if (!refreshToken) {
        await useAuthStore.getState().clearAuth();
        return Promise.reject(parseApiError(error));
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest._retry = true;
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const tokens = await refreshAccessToken(refreshToken);
        processQueue(null, tokens.accessToken);
        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await useAuthStore.getState().clearAuth();
        return Promise.reject(parseApiError(refreshError as AxiosError));
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(parseApiError(error));
  },
};
