import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const requestInterceptor = {
  onFulfilled: (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  onRejected: (error: AxiosError) => Promise.reject(error),
};
