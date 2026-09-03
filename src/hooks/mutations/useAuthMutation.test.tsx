import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true, writable: true });

const mockLogout = jest.fn<() => Promise<void>>();
const mockDeleteAccount =
  jest.fn<
    (
      confirmationPhrase: string,
      idempotencyKey: string,
    ) => Promise<{
      status: 'DELETED' | 'ALREADY_DELETED';
      deletedAt: string;
      firebaseIdentityDeletion: 'QUEUED' | 'NOT_LINKED';
    }>
  >();
const mockRevoke = jest.fn<() => Promise<void>>();
const mockClearAuth = jest.fn<() => Promise<void>>();

interface MockAuthState {
  clearAuth: () => Promise<void>;
}

const mockUseAuthStore = (selector: (state: MockAuthState) => unknown): unknown =>
  selector({ clearAuth: mockClearAuth });

jest.mock('@/api/endpoints/auth', () => ({ authAPI: { logout: mockLogout, deleteAccount: mockDeleteAccount } }));
jest.mock('@/services/push-notification.service', () => ({ revokeRegisteredAndroidPushToken: mockRevoke }));
jest.mock('@/store/auth.store', () => ({ useAuthStore: mockUseAuthStore }));

const { useDeleteAccountMutation, useLogoutMutation } =
  require('./useAuthMutation') as typeof import('./useAuthMutation');

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

/** Small mutation probe used to observe account deletion without navigation. */
function DeleteAccountProbe(): ReactElement {
  const mutation = useDeleteAccountMutation();

  return (
    <Pressable
      onPress={(): void => {
        void mutation.mutateAsync({ confirmationPhrase: 'DELETE MY ACCOUNT', idempotencyKey: 'delete-key' });
      }}
    >
      <Text>{mutation.isSuccess ? 'deleted' : mutation.isPending ? 'deleting' : 'idle'}</Text>
    </Pressable>
  );
}

beforeEach((): void => {
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockDeleteAccount.mockReset().mockResolvedValue({
    status: 'DELETED',
    deletedAt: '2026-09-03T00:00:00.000Z',
    firebaseIdentityDeletion: 'QUEUED',
  });
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

describe('useDeleteAccountMutation', (): void => {
  it('submits the typed phrase and stable idempotency key once', async (): Promise<void> => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 } } });
    const { getByText } = await render(
      <QueryClientProvider client={queryClient}>
        <DeleteAccountProbe />
      </QueryClientProvider>,
    );

    await fireEvent.press(getByText('idle'));

    await waitFor((): void => {
      expect(getByText('deleted')).toBeTruthy();
    });
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mockDeleteAccount).toHaveBeenCalledWith('DELETE MY ACCOUNT', 'delete-key');
    queryClient.clear();
  });
});
