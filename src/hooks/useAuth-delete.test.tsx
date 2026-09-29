import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type RenderHookResult, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Routes } from '@/constants/routes';
import type { DeleteAccountInput, DeleteAccountResponse } from '@/types/auth.types';
import type { UseAuthResult } from './useAuth';

const mockClearAuth = jest.fn<() => Promise<void>>();
const mockReplace = jest.fn<(href: unknown) => void>();

interface MockAuthState {
  token: string | null;
  user: { isVerified: boolean } | null;
  clearAuth: () => Promise<void>;
}

const mockAuthState: MockAuthState = {
  token: 'access-token',
  user: { isVerified: true },
  clearAuth: mockClearAuth,
};

const mockUseAuthStore = Object.assign(
  (selector: (state: MockAuthState) => unknown): unknown => selector(mockAuthState),
  { getState: (): MockAuthState => mockAuthState },
);

const mockDeleteMutation = {
  mutateAsync: jest.fn<(input: DeleteAccountInput) => Promise<DeleteAccountResponse>>(),
  isPending: false,
  error: null as Error | null,
  reset: jest.fn<() => void>(),
};
const mockIdleMutation = { isPending: false, error: null };

const deletedResponse: DeleteAccountResponse = {
  status: 'DELETED',
  deletedAt: '2026-09-03T00:00:00.000Z',
  firebaseIdentityDeletion: 'QUEUED',
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('@/hooks/queries/useAuthQuery', () => ({
  useAuthQuery: () => ({ isLoading: false, error: null }),
}));
jest.mock('@/store/auth.store', () => ({ useAuthStore: mockUseAuthStore }));
jest.mock('@/hooks/mutations/useAuthMutation', () => ({
  useCompletePasswordResetMutation: () => mockIdleMutation,
  useDeleteAccountMutation: () => mockDeleteMutation,
  useGoogleLoginMutation: () => mockIdleMutation,
  useLoginMutation: () => mockIdleMutation,
  useLogoutMutation: () => mockIdleMutation,
  useRegisterMutation: () => mockIdleMutation,
  useRequestPasswordResetMutation: () => mockIdleMutation,
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
  mockDeleteMutation.mutateAsync.mockReset().mockResolvedValue(deletedResponse);
  mockClearAuth.mockReset().mockResolvedValue(undefined);
  mockReplace.mockReset();
  mockDeleteMutation.error = null;
  mockDeleteMutation.isPending = false;
});

describe('useAuth account deletion', (): void => {
  it('clears query/auth state before replacing the route after a terminal result', async (): Promise<void> => {
    const events: string[] = [];
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
      await result.current.deleteAccount({ confirmationPhrase: 'DELETE MY ACCOUNT', idempotencyKey: 'attempt-1' });
    });

    expect(mockDeleteMutation.mutateAsync).toHaveBeenCalledWith({
      confirmationPhrase: 'DELETE MY ACCOUNT',
      idempotencyKey: 'attempt-1',
    });
    expect(clear).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['query-clear', 'auth-clear', 'route-replace']);
    expect(mockReplace).toHaveBeenCalledWith(Routes.auth.login);
  });

  it('retains auth and query state after a failed request until an explicit same-key retry succeeds', async (): Promise<void> => {
    const input: DeleteAccountInput = { confirmationPhrase: 'DELETE MY ACCOUNT', idempotencyKey: 'attempt-2' };
    mockDeleteMutation.mutateAsync
      .mockRejectedValueOnce(Object.assign(new Error('Network Error'), { errorCode: 'NETWORK_ERROR' }))
      .mockResolvedValueOnce({
        status: 'ALREADY_DELETED',
        deletedAt: '2026-09-03T00:00:00.000Z',
        firebaseIdentityDeletion: 'NOT_LINKED',
      });
    const queryClient = new QueryClient();
    const clear = jest.spyOn(queryClient, 'clear').mockImplementation((): void => undefined);
    const { result } = await renderProbe(queryClient);

    await act(async (): Promise<void> => {
      await expect(result.current.deleteAccount(input)).rejects.toThrow('Network Error');
    });

    expect(clear).not.toHaveBeenCalled();
    expect(mockClearAuth).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async (): Promise<void> => {
      await result.current.deleteAccount(input);
    });

    expect(mockDeleteMutation.mutateAsync).toHaveBeenNthCalledWith(1, input);
    expect(mockDeleteMutation.mutateAsync).toHaveBeenNthCalledWith(2, input);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(mockClearAuth).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(Routes.auth.login);
  });
});
