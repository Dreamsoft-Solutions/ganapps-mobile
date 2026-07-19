import type { AxiosResponse } from 'axios';

export const responseInterceptor = {
  onFulfilled: (response: AxiosResponse) => {
    const body = response.data as Record<string, unknown> | null;
    if (body && typeof body === 'object' && 'data' in body && 'success' in body) {
      response.data = body.data;
    }
    return response;
  },
  onRejected: (error: unknown) => Promise.reject(error),
};
