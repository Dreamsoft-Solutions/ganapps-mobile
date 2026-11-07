import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';
import type { TokenResponse } from '@/types/auth.types';
import { API_BASE_URL } from '../config';
import { type ApiResponse, isApiResponse } from '../types/api-response';

const refreshPromises = new Map<string, Promise<TokenResponse>>();

/**
 * Calls POST /auth/refresh with a stored refresh token.
 *
 * Deduplicates concurrent calls for the same refresh token. A different
 * session uses its own promise and cannot consume another User's token pair.
 *
 * Uses the bare `axios` module rather than `axiosInstance` on purpose: routing
 * the refresh call through the instance would re-enter the error interceptor on
 * a 401 and deadlock against its own refresh queue. The cost is that the
 * instance's response interceptor does not run here, so the server's envelope
 * has to be unwrapped explicitly.
 *
 * @param refreshToken - The refresh token to exchange
 * @param expectedUserId - Expected User for a session-bound replay, when present
 * @returns New token pair
 * @throws When the refresh request fails
 */
export async function refreshAccessToken(
  refreshToken: string,
  expectedUserId?: string,
  expectedSessionVersion?: number,
): Promise<TokenResponse> {
  const startedSession = useAuthStore.getState();
  if (expectedUserId && startedSession.user?.id !== expectedUserId) {
    throw new Error('Authenticated User changed before token refresh');
  }
  if (expectedSessionVersion !== undefined && startedSession.sessionVersion !== expectedSessionVersion) {
    throw new Error('Authenticated session changed before token refresh');
  }
  const startedToken = startedSession.token;
  const startedUserId = startedSession.user?.id;
  const promiseKey = `${refreshToken}:${startedSession.sessionVersion}`;
  const inFlight = refreshPromises.get(promiseKey);
  if (inFlight) return inFlight;

  const refresh = axios
    .post<ApiResponse<TokenResponse> | TokenResponse>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
    .then((res) => (isApiResponse<TokenResponse>(res.data) ? res.data.data : res.data))
    .then(async (tokens) => {
      const currentSession = useAuthStore.getState();
      if (
        currentSession.token !== startedToken ||
        (startedUserId && currentSession.user?.id !== startedUserId) ||
        (expectedUserId && currentSession.user?.id !== expectedUserId) ||
        currentSession.sessionVersion !== startedSession.sessionVersion
      ) {
        throw new Error('Authenticated session changed during token refresh');
      }
      await currentSession.setAuth(
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiresIn,
        startedSession.sessionVersion,
      );
      return tokens;
    })
    .finally(() => {
      refreshPromises.delete(promiseKey);
    });
  refreshPromises.set(promiseKey, refresh);
  return refresh;
}
