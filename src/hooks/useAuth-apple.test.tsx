import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type RenderHookResult, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Routes } from '@/constants/routes';
import type { AppleAuthRequestDto, AppleAuthResponse } from '@/types/auth.types';
import type { User } from '@/types/user.types';
import type { UseAuthResult } from './useAuth';

const mockReplace = jest.fn<(href: unknown) => void>();

interface MockAuthState {
  token: string | null;
  user: { isVerified: boolean } | null;
}

const mockAuthState: MockAuthState = { token: null, user: null };

const mockUseAuthStore = Object.assign(
  (selector: (state: MockAuthState) => unknown): unknown => selector(mockAuthState),
  { getState: (): MockAuthState => mockAuthState },
);

const mockAppleMutation = {
  mutateAsync: jest.fn<(dto: AppleAuthRequestDto) => Promise<AppleAuthResponse>>(),
  isPending: false,
  error: null as Error | null,
};
const mockIdleMutation = { isPending: false, error: null };

const dto: AppleAuthRequestDto = {
  identityToken: 'identity-token',
  authorizationCode: 'authorization-code',
  nonce: 'raw-nonce',
};

const appleResponse: AppleAuthResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresIn: 900,
  user: { id: 'user_1' } as User,
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
  useAppleLoginMutation: () => mockAppleMutation,
  useCompletePasswordResetMutation: () => mockIdleMutation,
  useDeleteAccountMutation: () => mockIdleMutation,
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

/**
 * Renders the aggregated auth hook inside a query client.
 *
 * @returns The rendered hook result.
 */
async function renderProbe(): Promise<RenderHookResult<UseAuthResult, undefined>> {
  const queryClient = new QueryClient();
  return renderHook<UseAuthResult, undefined>(() => useAuth(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

beforeEach((): void => {
  mockAppleMutation.mutateAsync.mockReset().mockResolvedValue(appleResponse);
  mockAppleMutation.isPending = false;
  mockReplace.mockReset();
});

describe('useAuth Apple sign-in', (): void => {
  it('navigates to the post-login route after Apple sign-in', async (): Promise<void> => {
    const { result } = await renderProbe();

    await act(async (): Promise<void> => {
      await result.current.appleLogin(dto);
    });

    expect(mockAppleMutation.mutateAsync).toHaveBeenCalledWith(dto);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(Routes.app.home);
    expect(result.current.appleLoginMutation).toBe(mockAppleMutation);
  });

  it('stays put and rethrows when Apple sign-in fails', async (): Promise<void> => {
    mockAppleMutation.mutateAsync.mockRejectedValue(new Error('Apple rejected'));
    const { result } = await renderProbe();

    await act(async (): Promise<void> => {
      await expect(result.current.appleLogin(dto)).rejects.toThrow('Apple rejected');
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('reports loading while the Apple mutation is pending', async (): Promise<void> => {
    mockAppleMutation.isPending = true;
    const { result } = await renderProbe();

    expect(result.current.isLoading).toBe(true);
  });
});
