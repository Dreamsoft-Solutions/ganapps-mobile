import type { AxiosResponse } from 'axios';

export const responseInterceptor = {
  onFulfilled: (response: AxiosResponse) => response,
  onRejected: (error: unknown) => Promise.reject(error),
};
