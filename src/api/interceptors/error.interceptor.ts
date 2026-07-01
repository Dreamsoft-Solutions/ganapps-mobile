import type { AxiosError } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/utils/error-handling';

export const errorInterceptor = {
  onRejected: async (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
    }

    const parsedError = parseApiError(error);
    return Promise.reject(parsedError);
  },
};
