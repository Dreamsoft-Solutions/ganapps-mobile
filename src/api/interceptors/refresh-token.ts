import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import type { TokenResponse } from '@/types/auth.types';
import { API_BASE_URL } from '../config';
import { type ApiResponse, isApiResponse } from '../types/api-response';

let refreshPromise: Promise<TokenResponse> | null = null;

/**
 * Calls POST /auth/refresh with a stored refresh token.
 *
 * Deduplicates concurrent refresh calls by sharing a single
 * in-flight promise.
 *
 * Uses the bare `axios` module rather than `axiosInstance` on purpose: routing
 * the refresh call through the instance would re-enter the error interceptor on
 * a 401 and deadlock against its own refresh queue. The cost is that the
 * instance's response interceptor does not run here, so the server's envelope
 * has to be unwrapped explicitly.
 *
 * @param refreshToken - The refresh token to exchange
 * @returns New token pair
 * @throws When the refresh request fails
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<ApiResponse<TokenResponse> | TokenResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((res) => (isApiResponse<TokenResponse>(res.data) ? res.data.data : res.data))
      .then((tokens) => {
        useAuthStore.getState().setAuth(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
        return tokens;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
