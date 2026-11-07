import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  getExpiresAt: vi.fn(),
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/utils/secure-storage', () => ({
  secureStorage: {
    getAccessToken: runtime.getAccessToken,
    getExpiresAt: runtime.getExpiresAt,
    setTokens: runtime.setTokens,
    clearTokens: runtime.clearTokens,
  },
}));
vi.mock('axios', () => ({ default: { post: runtime.post } }));

describe('mobile auth transitions', () => {
  beforeEach(() => {
    runtime.getAccessToken.mockReset().mockResolvedValue('stored-access');
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
});
