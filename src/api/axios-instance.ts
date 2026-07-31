import axios, { type AxiosInstance } from 'axios';
import { API_BASE_URL } from './config';
import { errorInterceptor } from './interceptors/error.interceptor';
import { requestInterceptor } from './interceptors/request.interceptor';
import { responseInterceptor } from './interceptors/response.interceptor';

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use((config) => {
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => {
    console.log(`[API] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(
        `[API] ${error.response.status} ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        error.response.data,
      );
    } else if (error.request) {
      console.error(`[API] NETWORK ERROR ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.message);
    } else {
      console.error('[API] REQUEST SETUP ERROR', error.message);
    }
    return Promise.reject(error);
  },
);

axiosInstance.interceptors.request.use(requestInterceptor.onFulfilled, requestInterceptor.onRejected);

axiosInstance.interceptors.response.use(responseInterceptor.onFulfilled, undefined);

axiosInstance.interceptors.response.use((response) => response, errorInterceptor.onRejected);

export default axiosInstance;
