import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Pressable, Text } from 'react-native';
import type { AppleAuthRequestDto, AppleAuthResponse } from '@/types/auth.types';
import type { User } from '@/types/user.types';

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
const mockAppleLogin = jest.fn<(dto: AppleAuthRequestDto) => Promise<AppleAuthResponse>>();
const mockRevoke = jest.fn<() => Promise<void>>();
const mockClearAuth = jest.fn<() => Promise<void>>();
const mockSetAuth = jest.fn<(accessToken: string, refreshToken: string, expiresIn: number) => Promise<void>>();
const mockSetUser = jest.fn<(user: User) => void>();

interface MockAuthState {
  clearAuth: () => Promise<void>;
  setAuth: (accessToken: string, refreshToken: string, expiresIn: number) => Promise<void>;
  setUser: (user: User) => void;
}

const mockUseAuthStore = (selector: (state: MockAuthState) => unknown): unknown =>
  selector({ clearAuth: mockClearAuth, setAuth: mockSetAuth, setUser: mockSetUser });

jest.mock('@/api/endpoints/auth', () => ({
  authAPI: { logout: mockLogout, deleteAccount: mockDeleteAccount, appleLogin: mockAppleLogin },
}));
jest.mock('@/services/push-notification.service', () => ({ revokeRegisteredAndroidPushToken: mockRevoke }));
jest.mock('@/store/auth.store', () => ({ useAuthStore: mockUseAuthStore }));

const { useAppleLoginMutation, useDeleteAccountMutation, useLogoutMutation } =
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

/** Small mutation probe used to verify a failed deletion is not retried. */
function DeleteAccountFailureProbe(): ReactElement {
  const mutation = useDeleteAccountMutation();

  return (
    <Pressable
      onPress={(): void => {
        void mutation
          .mutateAsync({ confirmationPhrase: 'DELETE MY ACCOUNT', idempotencyKey: 'delete-key' })
          .catch((): undefined => undefined);
      }}
    >
      <Text>{mutation.isError ? `failed-${mutation.failureCount}` : 'idle'}</Text>
    </Pressable>
  );
}

const appleDto: AppleAuthRequestDto = {
  identityToken: 'identity-token',
  authorizationCode: 'authorization-code',
  nonce: 'raw-nonce',
};
const appleUser = { id: 'user_1' } as User;

/** Small mutation probe used to observe Apple sign-in without navigation. */
function AppleLoginProbe(): ReactElement {
  const mutation = useAppleLoginMutation();

  return (
    <Pressable
      onPress={(): void => {
        void mutation.mutateAsync(appleDto);
      }}
    >
      <Text>{mutation.isSuccess ? 'signed in' : 'idle'}</Text>
    </Pressable>
  );
}

beforeEach((): void => {
  mockAppleLogin.mockReset().mockResolvedValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 900,
    user: appleUser,
  });
  mockSetAuth.mockReset().mockResolvedValue(undefined);
  mockSetUser.mockReset();
  mockLogout.mockReset().mockResolvedValue(undefined);
  mockDeleteAccount.mockReset().mockResolvedValue({
    status: 'DELETED',
    deletedAt: '2026-09-03T00:00:00.000Z',
    firebaseIdentityDeletion: 'QUEUED',
  });
  mockRevoke.mockReset().mockReturnValue(new Promise<void>(() => {}));
  mockClearAuth.mockReset().mockResolvedValue(undefined);
});

afterEach((): void => {
  onlineManager.setOnline(true);
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

  it('does not retry a failed deletion mutation', async (): Promise<void> => {
    mockDeleteAccount.mockRejectedValue(new Error('transport unavailable'));
    const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 } } });
    const { getByText } = await render(
      <QueryClientProvider client={queryClient}>
        <DeleteAccountFailureProbe />
      </QueryClientProvider>,
    );

    await fireEvent.press(getByText('idle'));

    await waitFor((): void => {
      expect(getByText('failed-1')).toBeTruthy();
    });
    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });

  it('runs the deletion mutation while offline', async (): Promise<void> => {
    onlineManager.setOnline(false);
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
    expect(mockDeleteAccount).toHaveBeenCalledWith('DELETE MY ACCOUNT', 'delete-key');
    queryClient.clear();
  });
});

describe('useAppleLoginMutation', (): void => {
  it('stores the session and user after Apple sign-in', async (): Promise<void> => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { gcTime: 0 } } });
    const { getByText } = await render(
      <QueryClientProvider client={queryClient}>
        <AppleLoginProbe />
      </QueryClientProvider>,
    );

    await fireEvent.press(getByText('idle'));

    await waitFor((): void => {
      expect(getByText('signed in')).toBeTruthy();
    });
    expect(mockAppleLogin).toHaveBeenCalledWith(appleDto);
    expect(mockSetAuth).toHaveBeenCalledWith('access-token', 'refresh-token', 900);
    expect(mockSetUser).toHaveBeenCalledWith(appleUser);
    queryClient.clear();
  });
});
