import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type RenderHookResult, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Routes } from '@/constants/routes';
import type { DeleteAccountInput, DeleteAccountResponse } from '@/types/auth.types';
import type { UseAuthResult } from './useAuth';

const mockDeleteAccount =
  jest.fn<
    (
      confirmationPhrase: string,
      idempotencyKey: string,
    ) => Promise<{
      status: DeleteAccountResponse['status'];
      deletedAt: string;
      firebaseIdentityDeletion: DeleteAccountResponse['firebaseIdentityDeletion'];
    }>
  >();
const mockClearAuth = jest.fn<() => Promise<void>>();
const mockReplace = jest.fn<(href: unknown) => void>();
const mockUseAuthStore = (
  selector: (state: {
    token: string | null;
    user: { isVerified: boolean } | null;
    clearAuth: () => Promise<void>;
  }) => unknown,
): unknown => selector({ token: 'access-token', user: { isVerified: true }, clearAuth: mockClearAuth });

const mockDeleteMutation = {
  mutateAsync: jest.fn(
    async (input: DeleteAccountInput): Promise<DeleteAccountResponse> =>
      mockDeleteAccount(input.confirmationPhrase, input.idempotencyKey),
  ),
  isPending: false,
  error: null,
  reset: jest.fn<() => void>(),
};
const mockIdleMutation = { isPending: false, error: null };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('@/hooks/queries/useAuthQuery', () => ({
  useAuthQuery: () => ({ isLoading: false, error: null }),
}));
jest.mock('@/store/auth.store', () => ({ useAuthStore: mockUseAuthStore }));
jest.mock('@/hooks/mutations/useAuthMutation', () => ({
  useDeleteAccountMutation: () => mockDeleteMutation,
  useGoogleLoginMutation: () => mockIdleMutation,
  useLoginMutation: () => mockIdleMutation,
  useLogoutMutation: () => mockIdleMutation,
  useRegisterMutation: () => mockIdleMutation,
  useResendVerificationMutation: () => mockIdleMutation,
  useUpdateProfileMutation: () => mockIdleMutation,
  useVerifyEmailMutation: () => mockIdleMutation,
}));

const { useAuth } = require('./useAuth') as typeof import('./useAuth');

async function renderProbe(queryClient: QueryClient): Promise<RenderHookResult<UseAuthResult, undefined>> {
  return renderHook<UseAuthResult, undefined>(() => useAuth(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach((): void => {
  mockDeleteAccount.mockReset();
  mockClearAuth.mockReset().mockResolvedValue(undefined);
  mockReplace.mockReset();
  mockDeleteMutation.error = null;
  mockDeleteMutation.isPending = false;
});

describe('useAuth account deletion', (): void => {
  it('clears query/auth state before replacing the route after a terminal result', async (): Promise<void> => {
    const events: string[] = [];
    mockDeleteAccount.mockResolvedValue({
      status: 'DELETED',
      deletedAt: '2026-09-03T00:00:00.000Z',
      firebaseIdentityDeletion: 'QUEUED',
    });
    mockClearAuth.mockImplementation(async (): Promise<void> => {
      events.push('auth-clear');
    });
    mockReplace.mockImplementation((): void => {
      events.push('route-replace');
    });

    const queryClient = new QueryClient();
    const clear = jest.spyOn(queryClient, 'clear').mockImplementation((): void => {
      events.push('query-clear');
    });
    const { result } = await renderProbe(queryClient);

    await act(async (): Promise<void> => {
      await result.current.deleteAccount('DELETE MY ACCOUNT');
    });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['query-clear', 'auth-clear', 'route-replace']);
    expect(mockReplace).toHaveBeenCalledWith(Routes.auth.login);
  });

  it('reuses the same idempotency key when an ambiguous request is retried', async (): Promise<void> => {
    mockDeleteAccount
      .mockRejectedValueOnce(Object.assign(new Error('Network Error'), { errorCode: 'NETWORK_ERROR' }))
      .mockResolvedValueOnce({
        status: 'ALREADY_DELETED',
        deletedAt: '2026-09-03T00:00:00.000Z',
        firebaseIdentityDeletion: 'NOT_LINKED',
      });
    const queryClient = new QueryClient();
    const { result } = await renderProbe(queryClient);

    await act(async (): Promise<void> => {
      await expect(result.current.deleteAccount('DELETE MY ACCOUNT')).rejects.toThrow('Network Error');
      await result.current.deleteAccount('DELETE MY ACCOUNT');
    });

    expect(mockDeleteAccount).toHaveBeenCalledTimes(2);
    expect(mockDeleteAccount.mock.calls[0]?.[1]).toBeTruthy();
    expect(mockDeleteAccount.mock.calls[1]?.[1]).toBe(mockDeleteAccount.mock.calls[0]?.[1]);
  });
});
