import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { friendsAPI } from '@/api/endpoints/friends';
import { useAuthStore } from '@/store/auth.store';
import type { ParsedApiError } from '@/utils/error-handling';
import { useFriendProfileQuery } from './useFriendsQuery';

jest.mock('@/api/endpoints/friends', () => ({ friendsAPI: { getProfile: jest.fn() } }));

const getProfile = jest.mocked(friendsAPI.getProfile);

afterEach((): void => {
  getProfile.mockReset();
  useAuthStore.setState({ token: null });
});

describe('useFriendProfileQuery', (): void => {
  it('shows a terminal profile error without repeating the request', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const denied: ParsedApiError = Object.assign(new Error('Profile unavailable'), { status: 403 });
    getProfile.mockRejectedValue(denied);
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result, unmount } = await renderHook(() => useFriendProfileQuery('friend-1'), { wrapper });

    await waitFor((): void => expect(result.current.isError).toBe(true), { timeout: 4000 });
    expect(getProfile).toHaveBeenCalledTimes(1);
    unmount();
    client.clear();
  });
});
