import axios, { type AxiosError, type AxiosResponse } from 'axios';
import { useConnectionStore } from '@/store/connection.store';

/**
 * Reports to the connection store whether each API request reached the server.
 *
 * Any HTTP status counts as reached. A request with no response, including a timeout,
 * counts as unreached. A cancelled request says nothing either way. It runs before the
 * error interceptor, which turns the Axios error into a `ParsedApiError`.
 */
export const connectionInterceptor = {
  onFulfilled: (response: AxiosResponse): AxiosResponse => {
    useConnectionStore.getState().reportApiReachable();
    return response;
  },
  onRejected: (error: AxiosError): Promise<never> => {
    if (error.response) useConnectionStore.getState().reportApiReachable();
    else if (!axios.isCancel(error)) useConnectionStore.getState().reportApiUnreachable();
    return Promise.reject(error);
  },
};
