import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types/user.types';
import { storage } from '@/utils/storage';
import { useProfilePrompt } from './useProfilePrompt';

jest.mock('@/utils/storage', () => ({
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

const mockedStorage = jest.mocked(storage);

/** Builds a user carrying only the fields the hook reads. */
function userWith(overrides: Partial<User>): User {
  return {
    id: 'user_1',
    email: 'maria@example.com',
    username: 'maria',
    firstName: 'Maria',
    lastName: 'Santos',
    displayPicture: null,
    interests: [],
    isVerified: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach((): void => {
  mockedStorage.get.mockResolvedValue(null);
  mockedStorage.set.mockResolvedValue(undefined);
});

afterEach((): void => {
  jest.clearAllMocks();
  useAuthStore.setState({ user: null });
});

describe('useProfilePrompt', (): void => {
  it('is hidden while the stored record is still being read, so the card never flashes', async (): Promise<void> => {
    useAuthStore.setState({ user: userWith({}) });
    // A read that never settles pins the hook in its pending state.
    mockedStorage.get.mockReturnValue(new Promise((): void => {}));

    const { result, unmount } = await renderHook(() => useProfilePrompt());

    expect(result.current.isVisible).toBe(false);
    unmount();
  });

  it('becomes visible once the read resolves with no prior dismissal', async (): Promise<void> => {
    useAuthStore.setState({ user: userWith({}) });

    const { result, unmount } = await renderHook(() => useProfilePrompt());

    await waitFor((): void => {
      expect(result.current.isVisible).toBe(true);
    });
    unmount();
  });

  it('reads the key scoped to the signed-in account', async (): Promise<void> => {
    useAuthStore.setState({ user: userWith({ id: 'user_42' }) });

    const { unmount } = await renderHook(() => useProfilePrompt());

    await waitFor((): void => {
      expect(mockedStorage.get).toHaveBeenCalledWith('ganapps:profile-prompt:user_42');
    });
    unmount();
  });

  it('stays hidden for a user who has not completed step one', async (): Promise<void> => {
    // DS-33's redirect owns this user. The card must never compete with it.
    useAuthStore.setState({ user: userWith({ lastName: null }) });

    const { result, unmount } = await renderHook(() => useProfilePrompt());

    await waitFor((): void => {
      expect(mockedStorage.get).toHaveBeenCalled();
    });
    expect(result.current.isVisible).toBe(false);
    unmount();
  });

  it('stays hidden once the user has interests', async (): Promise<void> => {
    useAuthStore.setState({ user: userWith({ interests: ['food'] }) });

    const { result, unmount } = await renderHook(() => useProfilePrompt());

    await waitFor((): void => {
      expect(mockedStorage.get).toHaveBeenCalled();
    });
    expect(result.current.isVisible).toBe(false);
    unmount();
  });

  it('stays hidden within the cooldown after a recent dismissal', async (): Promise<void> => {
    useAuthStore.setState({ user: userWith({}) });
    mockedStorage.get.mockResolvedValue({ dismissedAt: Date.now() });

    const { result, unmount } = await renderHook(() => useProfilePrompt());

    await waitFor((): void => {
      expect(mockedStorage.get).toHaveBeenCalled();
    });
    expect(result.current.isVisible).toBe(false);
    unmount();
  });

  it('is visible again once the cooldown has elapsed', async (): Promise<void> => {
    useAuthStore.setState({ user: userWith({}) });
    mockedStorage.get.mockResolvedValue({ dismissedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 });

    const { result, unmount } = await renderHook(() => useProfilePrompt());

    await waitFor((): void => {
      expect(result.current.isVisible).toBe(true);
    });
    unmount();
  });

  it('hides the card and persists a timestamp when dismissed', async (): Promise<void> => {
    useAuthStore.setState({ user: userWith({}) });

    const { result, unmount } = await renderHook(() => useProfilePrompt());

    await waitFor((): void => {
      expect(result.current.isVisible).toBe(true);
    });

    await act(async (): Promise<void> => {
      result.current.dismiss();
    });

    expect(result.current.isVisible).toBe(false);
    expect(mockedStorage.set).toHaveBeenCalledWith(
      'ganapps:profile-prompt:user_1',
      expect.objectContaining({ dismissedAt: expect.any(Number) }),
    );
    unmount();
  });

  it('stays hidden when a failed read returns null but the user is ineligible', async (): Promise<void> => {
    // storage.get swallows its own errors and resolves null, so a read failure can only
    // ever make the card visible — never crash. Eligibility still gates it.
    useAuthStore.setState({ user: userWith({ interests: ['coffee'] }) });
    mockedStorage.get.mockResolvedValue(null);

    const { result, unmount } = await renderHook(() => useProfilePrompt());

    await waitFor((): void => {
      expect(mockedStorage.get).toHaveBeenCalled();
    });
    expect(result.current.isVisible).toBe(false);
    unmount();
  });

  it('stays hidden when there is no signed-in user', async (): Promise<void> => {
    useAuthStore.setState({ user: null });

    const { result, unmount } = await renderHook(() => useProfilePrompt());

    expect(result.current.isVisible).toBe(false);
    expect(mockedStorage.get).not.toHaveBeenCalled();
    unmount();
  });
});
