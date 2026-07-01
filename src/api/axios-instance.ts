import axios, { AxiosInstance } from 'axios';
import { requestInterceptor } from './interceptors/request.interceptor';
import { responseInterceptor } from './interceptors/response.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(
  requestInterceptor.onFulfilled,
  requestInterceptor.onRejected,
);

axiosInstance.interceptors.response.use(
  responseInterceptor.onFulfilled,
  undefined,
);

axiosInstance.interceptors.response.use(
  (response) => response,
  errorInterceptor.onRejected,
);

export default axiosInstance;
