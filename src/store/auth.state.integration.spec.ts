import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionBoundRequestConfig } from '@/api/types/session-bound-request';
import type { User } from '@/types/user.types';

const runtime = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
  getExpiresAt: vi.fn(),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  post: vi.fn(),
  request: vi.fn(),
}));

vi.mock('@/utils/secure-storage', () => ({
  secureStorage: {
    getAccessToken: runtime.getAccessToken,
    getRefreshToken: runtime.getRefreshToken,
    getExpiresAt: runtime.getExpiresAt,
    setTokens: runtime.setTokens,
    clearTokens: runtime.clearTokens,
  },
}));
vi.mock('axios', () => ({ default: { post: runtime.post } }));
vi.mock('@/api/axios-instance', () => ({ default: runtime.request }));

describe('mobile auth transitions', () => {
  beforeEach(() => {
    runtime.getAccessToken.mockReset().mockResolvedValue('stored-access');
    runtime.getRefreshToken.mockReset().mockResolvedValue('stored-refresh');
    runtime.getExpiresAt.mockReset().mockResolvedValue(Date.now() + 60_000);
    runtime.setTokens.mockReset().mockResolvedValue(undefined);
    runtime.clearTokens.mockReset().mockResolvedValue(undefined);
    runtime.post.mockReset().mockResolvedValue({
      data: { accessToken: 'next-access', refreshToken: 'next-refresh', expiresIn: 3600 },
    });
    runtime.request.mockReset().mockResolvedValue({ data: 'retried response' });
    vi.resetModules();
  });

  afterEach(() => vi.clearAllMocks());

  it('settles hydration into signed-out state when secure storage fails', async () => {
    runtime.getAccessToken.mockRejectedValueOnce(new Error('secure storage unavailable'));
    const { useAuthStore } = await import('./auth.store');

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState()).toMatchObject({ token: null, expiresAt: null, isHydrated: true });
  });

  it('waits for SecureStore deletion before resolving auth clear', async () => {
    const deletionStarted = Promise.withResolvers<void>();
    const deletion = Promise.withResolvers<void>();
    runtime.clearTokens.mockImplementationOnce(() => {
      deletionStarted.resolve();
      return deletion.promise;
    });
    const { useAuthStore } = await import('./auth.store');
    useAuthStore.setState({ token: 'access-a', expiresAt: Date.now() + 60_000, user: { id: 'user-a' } as User });
    let clearSettled = false;

    const clearing = useAuthStore
      .getState()
      .clearAuth()
      .then(() => {
        clearSettled = true;
      });
    await deletionStarted.promise;
    expect(runtime.clearTokens).toHaveBeenCalledTimes(1);
    expect(clearSettled).toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null });

    deletion.resolve();
    await clearing;

    expect(clearSettled).toBe(true);
  });

  it('waits for token persistence before resolving a refresh', async () => {
    const persistenceStarted = Promise.withResolvers<void>();
    const persistence = Promise.withResolvers<void>();
    runtime.setTokens.mockImplementationOnce(() => {
      persistenceStarted.resolve();
      return persistence.promise;
    });
    const [{ useAuthStore }, { refreshAccessToken }] = await Promise.all([
      import('./auth.store'),
      import('../api/interceptors/refresh-token'),
    ]);
    let refreshSettled = false;

    const refresh = refreshAccessToken('old-refresh').then((tokens) => {
      refreshSettled = true;
      return tokens;
    });
    await persistenceStarted.promise;
    expect(runtime.setTokens).toHaveBeenCalledTimes(1);
    expect(refreshSettled).toBe(false);

    persistence.resolve();
    await expect(refresh).resolves.toMatchObject({ accessToken: 'next-access' });
    expect(useAuthStore.getState().token).toBe('next-access');
  });

  it('waits for an in-flight refresh write before sending a new request or handling a 401', async () => {
    const persistenceStarted = Promise.withResolvers<void>();
    const persistence = Promise.withResolvers<void>();
    runtime.setTokens.mockImplementationOnce(() => {
      persistenceStarted.resolve();
      return persistence.promise;
    });
    const [{ useAuthStore }, { refreshAccessToken }, { requestInterceptor }, { errorInterceptor }] = await Promise.all([
      import('./auth.store'),
      import('../api/interceptors/refresh-token'),
      import('../api/interceptors/request.interceptor'),
      import('../api/interceptors/error.interceptor'),
    ]);
    useAuthStore.setState({
      token: 'access-a',
      expiresAt: Date.now() + 60_000,
      user: { id: 'user-a' } as User,
    });

    const refresh = refreshAccessToken('refresh-a', 'user-a', useAuthStore.getState().sessionVersion);
    await persistenceStarted.promise;
    expect(runtime.setTokens).toHaveBeenCalledTimes(1);
    let requestSettled = false;
    let unauthorizedSettled = false;
    const request = requestInterceptor
      .onFulfilled({ headers: {} } as unknown as InternalAxiosRequestConfig)
      .then((config) => {
        requestSettled = true;
        return config;
      });
    const unauthorized = errorInterceptor.onRejected(unauthorizedRequest('user-a', 'access-a')).then((response) => {
      unauthorizedSettled = true;
      return response;
    });
    await Promise.resolve();

    expect(requestSettled).toBe(false);
    expect(unauthorizedSettled).toBe(false);
    expect(runtime.getRefreshToken).not.toHaveBeenCalled();
    expect(runtime.post).toHaveBeenCalledTimes(1);

    persistence.resolve();
    await expect(refresh).resolves.toMatchObject({ accessToken: 'next-access' });
    const [requestConfig, retriedResponse] = await Promise.all([request, unauthorized]);

    expect(requestConfig.headers.Authorization).toBe('Bearer next-access');
    expect(retriedResponse).toMatchObject({ data: 'retried response' });
    expect(runtime.post).toHaveBeenCalledTimes(1);
    expect(runtime.request).toHaveBeenCalledTimes(1);
    expect(runtime.request.mock.calls[0]?.[0]).toMatchObject({
      headers: { Authorization: 'Bearer next-access' },
    });
    expect(runtime.clearTokens).not.toHaveBeenCalled();
  });

  it('keeps refreshes for different session tokens independent', async () => {
    const requestStarted = Promise.withResolvers<void>();
    const responseA = Promise.withResolvers<{
      data: { accessToken: string; refreshToken: string; expiresIn: number };
    }>();
    runtime.post
      .mockImplementationOnce(() => {
        requestStarted.resolve();
        return responseA.promise;
      })
      .mockResolvedValueOnce({
        data: { accessToken: 'access-b-next', refreshToken: 'refresh-b-next', expiresIn: 3600 },
      });
    const [{ useAuthStore }, { refreshAccessToken }] = await Promise.all([
      import('./auth.store'),
      import('../api/interceptors/refresh-token'),
    ]);
    useAuthStore.setState({ token: 'access-a', expiresAt: Date.now() + 60_000, user: { id: 'user-a' } as User });

    const refreshA = refreshAccessToken('refresh-a');
    await requestStarted.promise;
    expect(runtime.post).toHaveBeenCalledTimes(1);
    await useAuthStore.getState().clearAuth();
    await useAuthStore.getState().setAuth('access-b', 'refresh-b', 3600, { user: { id: 'user-b' } as User });
    const refreshB = refreshAccessToken('refresh-b');

    await expect(refreshB).resolves.toMatchObject({ accessToken: 'access-b-next' });
    responseA.resolve({ data: { accessToken: 'access-a-next', refreshToken: 'refresh-a-next', expiresIn: 3600 } });

    await expect(refreshA).rejects.toThrow('Authenticated session changed during token refresh');
    expect(useAuthStore.getState()).toMatchObject({ token: 'access-b-next', user: { id: 'user-b' } });
    expect(runtime.post).toHaveBeenCalledTimes(2);
  });

  it('does not persist a refresh after a newer session starts during SecureStore write', async () => {
    const persistenceStarted = Promise.withResolvers<void>();
    const persistence = Promise.withResolvers<void>();
    runtime.setTokens.mockImplementationOnce(() => {
      persistenceStarted.resolve();
      return persistence.promise;
    });
    const [{ useAuthStore }, { refreshAccessToken }] = await Promise.all([
      import('./auth.store'),
      import('../api/interceptors/refresh-token'),
    ]);
    useAuthStore.setState({ token: 'access-a', expiresAt: Date.now() + 60_000, user: { id: 'user-a' } as User });

    const refreshA = refreshAccessToken('refresh-a');
    await persistenceStarted.promise;
    expect(runtime.setTokens).toHaveBeenCalledTimes(1);
    const loginB = useAuthStore.getState().setAuth('access-b', 'refresh-b', 3600, { user: { id: 'user-b' } as User });
    persistence.resolve();

    await expect(refreshA).rejects.toThrow('Authenticated session changed during token persistence');
    await loginB;

    expect(runtime.setTokens).toHaveBeenNthCalledWith(1, 'next-access', 'next-refresh', 3600);
    expect(runtime.setTokens).toHaveBeenNthCalledWith(2, 'access-b', 'refresh-b', 3600);
    expect(useAuthStore.getState()).toMatchObject({ token: 'access-b', user: { id: 'user-b' } });
  });

  it('keeps concurrent 401 refreshes separate and does not clear the newer User', async () => {
    const requestAStarted = Promise.withResolvers<void>();
    const responseA = Promise.withResolvers<{
      data: { accessToken: string; refreshToken: string; expiresIn: number };
    }>();
    runtime.getRefreshToken.mockResolvedValueOnce('refresh-a').mockResolvedValueOnce('refresh-b');
    runtime.post.mockImplementation((_url, body: { refreshToken: string }) => {
      if (body.refreshToken === 'refresh-a') {
        requestAStarted.resolve();
        return responseA.promise;
      }
      return Promise.resolve({
        data: { accessToken: 'access-b-next', refreshToken: 'refresh-b-next', expiresIn: 3600 },
      });
    });
    const [{ useAuthStore }, { errorInterceptor }] = await Promise.all([
      import('./auth.store'),
      import('../api/interceptors/error.interceptor'),
    ]);
    useAuthStore.setState({ token: 'access-a', expiresAt: Date.now() + 60_000, user: { id: 'user-a' } as User });

    const refreshA = errorInterceptor.onRejected(unauthorizedRequest('user-a', 'access-a'));
    await requestAStarted.promise;
    expect(runtime.post).toHaveBeenCalledTimes(1);
    await useAuthStore.getState().clearAuth();
    await useAuthStore.getState().setAuth('access-b', 'refresh-b', 3600, { user: { id: 'user-b' } as User });
    const refreshB = errorInterceptor.onRejected(
      unauthorizedRequest('user-b', 'access-b', useAuthStore.getState().sessionVersion),
    );

    await expect(refreshB).resolves.toMatchObject({ data: 'retried response' });
    responseA.reject(new Error('User A refresh failed'));
    await expect(refreshA).rejects.toThrow('User A refresh failed');

    expect(runtime.post).toHaveBeenCalledTimes(2);
    expect(runtime.request).toHaveBeenCalledTimes(1);
    expect(runtime.request.mock.calls[0]?.[0]).toMatchObject({
      requestAuthUserId: 'user-b',
      headers: { Authorization: 'Bearer access-b-next' },
    });
    expect(runtime.clearTokens).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({ token: 'access-b-next', user: { id: 'user-b' } });
  });

  it('rejects an outbox request when the User changes while token refresh is in flight', async () => {
    const requestStarted = Promise.withResolvers<void>();
    const response = Promise.withResolvers<{
      data: { accessToken: string; refreshToken: string; expiresIn: number };
    }>();
    runtime.post.mockImplementationOnce(() => {
      requestStarted.resolve();
      return response.promise;
    });
    const [{ useAuthStore }, { requestInterceptor }] = await Promise.all([
      import('./auth.store'),
      import('../api/interceptors/request.interceptor'),
    ]);
    useAuthStore.setState({
      token: 'access-a',
      expiresAt: Date.now() + 1_000,
      user: { id: 'user-a' } as User,
      isHydrated: true,
    });
    const config = {
      expectedAuthUserId: 'user-a',
      headers: {},
    } as unknown as InternalAxiosRequestConfig & SessionBoundRequestConfig;

    const request = requestInterceptor.onFulfilled(config);
    await requestStarted.promise;
    expect(runtime.post).toHaveBeenCalledTimes(1);
    useAuthStore.setState({
      token: 'access-b',
      expiresAt: Date.now() + 3_600_000,
      user: { id: 'user-b' } as User,
    });
    response.resolve({ data: { accessToken: 'access-a-next', refreshToken: 'refresh-a-next', expiresIn: 3600 } });

    await expect(request).rejects.toThrow('Authenticated User changed before the request was sent');
    expect(useAuthStore.getState()).toMatchObject({ token: 'access-b', user: { id: 'user-b' } });
    expect(runtime.setTokens).not.toHaveBeenCalled();
    expect(config.headers.Authorization).toBeUndefined();
  });
});

function unauthorizedRequest(userId: string, token: string, version = 0): AxiosError {
  return {
    name: 'AxiosError',
    message: 'Access token expired',
    config: {
      method: 'get',
      url: '/businesses',
      headers: { Authorization: `Bearer ${token}` },
      requestAuthUserId: userId,
      requestAuthToken: token,
      requestAuthVersion: version,
    } as unknown as InternalAxiosRequestConfig & SessionBoundRequestConfig,
    response: { status: 401, data: { message: 'Access token expired' } },
  } as unknown as AxiosError;
}
