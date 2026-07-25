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

axiosInstance.interceptors.request.use(requestInterceptor.onFulfilled, requestInterceptor.onRejected);

axiosInstance.interceptors.response.use(responseInterceptor.onFulfilled, undefined);

axiosInstance.interceptors.response.use((response) => response, errorInterceptor.onRejected);

export default axiosInstance;
