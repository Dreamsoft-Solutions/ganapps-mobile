import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/utils/error-handling';
import { secureStorage } from '@/utils/secure-storage';
import axiosInstance from '../axios-instance';
import type { SessionBoundRequestConfig } from '../types/session-bound-request';
import { refreshAccessToken } from './refresh-token';

type RetriableRequest = InternalAxiosRequestConfig & SessionBoundRequestConfig & { _retry?: boolean };

function requestUserId(request: RetriableRequest): string | null | undefined {
  return request.requestAuthUserId;
}

function isRequestOwnerCurrent(request: RetriableRequest): boolean {
  const expectedUserId = requestUserId(request);
  return expectedUserId !== undefined && (useAuthStore.getState().user?.id ?? null) === expectedUserId;
}

function isRequestCredentialsCurrent(request: RetriableRequest): boolean {
  const current = useAuthStore.getState();
  return (
    isRequestOwnerCurrent(request) &&
    current.token === request.requestAuthToken &&
    current.sessionVersion === request.requestAuthVersion
  );
}

function retryWithCurrentToken(request: RetriableRequest): Promise<AxiosResponse> | null {
  const current = useAuthStore.getState();
  const expectedUserId = requestUserId(request);
  if (
    expectedUserId === undefined ||
    expectedUserId === null ||
    current.user?.id !== expectedUserId ||
    !current.token ||
    current.token === request.requestAuthToken
  ) {
    return null;
  }

  request._retry = true;
  request.requestAuthToken = current.token;
  request.requestAuthVersion = current.sessionVersion;
  request.headers.Authorization = `Bearer ${current.token}`;
  return axiosInstance(request);
}

/** Normalizes API failures and refreshes retryable authenticated requests. */
export const errorInterceptor = {
  /**
   * Handles a failed request while keeping account deletion retries explicit.
   * @param error - Axios rejection carrying the request and optional response.
   * @returns A retried response for eligible requests.
   * @throws The parsed API error when the request cannot be retried.
   */
  onRejected: async (error: AxiosError): Promise<AxiosResponse> => {
    const originalRequest = error.config as RetriableRequest | undefined;

    if (originalRequest?.method === 'delete' && originalRequest.url === '/auth/me') {
      return Promise.reject(parseApiError(error));
    }

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(parseApiError(error));
    }
    await useAuthStore.getState().getStableSession();
    if (!originalRequest.requestAuthToken) return Promise.reject(parseApiError(error));
    await useAuthStore.getState().getStableSession();
    if (!isRequestOwnerCurrent(originalRequest)) return Promise.reject(parseApiError(error));

    const newerTokenRetry = retryWithCurrentToken(originalRequest);
    if (newerTokenRetry) return newerTokenRetry;
    if (!isRequestCredentialsCurrent(originalRequest)) return Promise.reject(parseApiError(error));

    let refreshToken: string | null;
    try {
      refreshToken = await secureStorage.getRefreshToken();
    } catch (storageError) {
      if (isRequestCredentialsCurrent(originalRequest)) await useAuthStore.getState().clearAuth();
      return Promise.reject(parseApiError(storageError as AxiosError));
    }

    if (!isRequestOwnerCurrent(originalRequest)) return Promise.reject(parseApiError(error));
    const afterTokenReadRetry = retryWithCurrentToken(originalRequest);
    if (afterTokenReadRetry) return afterTokenReadRetry;
    if (!isRequestCredentialsCurrent(originalRequest)) return Promise.reject(parseApiError(error));

    if (!refreshToken) {
      if (isRequestCredentialsCurrent(originalRequest)) await useAuthStore.getState().clearAuth();
      return Promise.reject(parseApiError(error));
    }

    originalRequest._retry = true;
    try {
      const tokens = await refreshAccessToken(
        refreshToken,
        requestUserId(originalRequest) ?? undefined,
        originalRequest.requestAuthVersion,
      );
      originalRequest.requestAuthToken = tokens.accessToken;
      originalRequest.requestAuthVersion = (await useAuthStore.getState().getStableSession()).sessionVersion;
      originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      const latestTokenRetry = retryWithCurrentToken(originalRequest);
      if (latestTokenRetry) return latestTokenRetry;
      if (isRequestCredentialsCurrent(originalRequest)) await useAuthStore.getState().clearAuth();
      return Promise.reject(parseApiError(refreshError as AxiosError));
    }
  },
};
