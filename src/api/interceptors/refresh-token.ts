import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import type { TokenResponse } from '@/types/auth.types';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

let refreshPromise: Promise<TokenResponse> | null = null;

/**
 * Calls POST /auth/refresh with a stored refresh token.
 *
 * Deduplicates concurrent refresh calls by sharing a single
 * in-flight promise.
 *
 * @param refreshToken - The refresh token to exchange
 * @returns New token pair
 * @throws When the refresh request fails
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<TokenResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
      .then((res) => res.data)
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
