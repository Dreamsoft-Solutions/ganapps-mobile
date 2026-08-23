import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true, writable: true });

const mockLogout = jest.fn<() => Promise<void>>();
const mockRevoke = jest.fn<() => Promise<void>>();
const mockClearAuth = jest.fn<() => Promise<void>>();

interface MockAuthState {
  clearAuth: () => Promise<void>;
}

const mockUseAuthStore = (selector: (state: MockAuthState) => unknown): unknown =>
  selector({ clearAuth: mockClearAuth });

jest.mock('@/api/endpoints/auth', () => ({ authAPI: { logout: mockLogout } }));
jest.mock('@/services/push-notification.service', () => ({ revokeRegisteredAndroidPushToken: mockRevoke }));
jest.mock('@/store/auth.store', () => ({ useAuthStore: mockUseAuthStore }));

const { useLogoutMutation } = require('./useAuthMutation') as typeof import('./useAuthMutation');

/**
 * Small mutation probe used to observe logout completion independently of navigation.
 *
 * @returns A pressable logout mutation probe.
 */
function LogoutProbe(): ReactElement {
  const mutation = useLogoutMutation();

  return (
    <Pressable onPress={(): void => mutation.mutate()}>
      <Text>{mutation.isSuccess ? 'logged out' : 'idle'}</Text>
    </Pressable>
  );
}

beforeEach((): void => {
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockRevoke.mockReset().mockReturnValue(new Promise<void>(() => {}));
  mockClearAuth.mockReset().mockResolvedValue(undefined);
});

describe('useLogoutMutation push-token cleanup', (): void => {
  it('does not wait for push-token revocation before completing logout', async (): Promise<void> => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 } } });
    const { getByText } = await render(
      <QueryClientProvider client={queryClient}>
        <LogoutProbe />
      </QueryClientProvider>,
    );

    await fireEvent.press(getByText('idle'));

    await waitFor((): void => {
      expect(getByText('logged out')).toBeTruthy();
    });
    expect(mockRevoke).toHaveBeenCalledTimes(1);
    expect(mockLogout).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });
});
