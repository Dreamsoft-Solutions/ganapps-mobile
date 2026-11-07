import type { InternalAxiosRequestConfig } from 'axios';
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
    let finishDeletion: (() => void) | undefined;
    runtime.clearTokens.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishDeletion = resolve;
        }),
    );
    const { useAuthStore } = await import('./auth.store');
    useAuthStore.setState({ token: 'access-a', expiresAt: Date.now() + 60_000, user: { id: 'user-a' } as User });
    let clearSettled = false;

    const clearing = useAuthStore
      .getState()
      .clearAuth()
      .then(() => {
        clearSettled = true;
      });
    await vi.waitFor(() => expect(runtime.clearTokens).toHaveBeenCalledTimes(1));
    expect(clearSettled).toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ token: null, user: null });

    finishDeletion?.();
    await clearing;

    expect(clearSettled).toBe(true);
  });

  it('waits for token persistence before resolving a refresh', async () => {
    let finishPersistence: (() => void) | undefined;
    runtime.setTokens.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishPersistence = resolve;
        }),
    );
    const [{ useAuthStore }, { refreshAccessToken }] = await Promise.all([
      import('./auth.store'),
      import('../api/interceptors/refresh-token'),
    ]);
    let refreshSettled = false;

    const refresh = refreshAccessToken('old-refresh').then((tokens) => {
      refreshSettled = true;
      return tokens;
    });
    await vi.waitFor(() => expect(runtime.setTokens).toHaveBeenCalledTimes(1));
    expect(refreshSettled).toBe(false);

    finishPersistence?.();
    await expect(refresh).resolves.toMatchObject({ accessToken: 'next-access' });
    expect(useAuthStore.getState().token).toBe('next-access');
  });

  it('keeps refreshes for different session tokens independent', async () => {
    let finishRefreshA:
      | ((response: { data: { accessToken: string; refreshToken: string; expiresIn: number } }) => void)
      | undefined;
    runtime.post
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRefreshA = resolve;
          }),
      )
      .mockResolvedValueOnce({
        data: { accessToken: 'access-b-next', refreshToken: 'refresh-b-next', expiresIn: 3600 },
      });
    const [{ useAuthStore }, { refreshAccessToken }] = await Promise.all([
      import('./auth.store'),
      import('../api/interceptors/refresh-token'),
    ]);
    useAuthStore.setState({ token: 'access-a', expiresAt: Date.now() + 60_000, user: { id: 'user-a' } as User });

    const refreshA = refreshAccessToken('refresh-a');
    await vi.waitFor(() => expect(runtime.post).toHaveBeenCalledTimes(1));
    useAuthStore.setState({ token: 'access-b', expiresAt: Date.now() + 60_000, user: { id: 'user-b' } as User });
    const refreshB = refreshAccessToken('refresh-b');

    await expect(refreshB).resolves.toMatchObject({ accessToken: 'access-b-next' });
    finishRefreshA?.({ data: { accessToken: 'access-a-next', refreshToken: 'refresh-a-next', expiresIn: 3600 } });

    await expect(refreshA).rejects.toThrow('Authenticated session changed during token refresh');
    expect(useAuthStore.getState()).toMatchObject({ token: 'access-b-next', user: { id: 'user-b' } });
    expect(runtime.post).toHaveBeenCalledTimes(2);
  });

  it('rejects an outbox request when the User changes while token refresh is in flight', async () => {
    let finishRefresh:
      | ((response: { data: { accessToken: string; refreshToken: string; expiresIn: number } }) => void)
      | undefined;
    runtime.post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        }),
    );
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
    await vi.waitFor(() => expect(runtime.post).toHaveBeenCalledTimes(1));
    useAuthStore.setState({
      token: 'access-b',
      expiresAt: Date.now() + 3_600_000,
      user: { id: 'user-b' } as User,
    });
    finishRefresh?.({ data: { accessToken: 'access-a-next', refreshToken: 'refresh-a-next', expiresIn: 3600 } });

    await expect(request).rejects.toThrow('Authenticated User changed before the request was sent');
    expect(useAuthStore.getState()).toMatchObject({ token: 'access-b', user: { id: 'user-b' } });
    expect(runtime.setTokens).not.toHaveBeenCalled();
    expect(config.headers.Authorization).toBeUndefined();
  });
});
