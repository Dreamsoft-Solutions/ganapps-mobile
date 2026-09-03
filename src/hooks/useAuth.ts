import { type UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Routes } from '@/constants/routes';
import { useAuthStore } from '@/store/auth.store';
import type {
  DeleteAccountInput,
  DeleteAccountResponse,
  GoogleAuthRequestDto,
  GoogleAuthResponse,
  LoginDto,
  RegisterDto,
  RegisterResponse,
  TokenResponse,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from '@/types/auth.types';
import type { User } from '@/types/user.types';
import {
  useDeleteAccountMutation,
  useGoogleLoginMutation,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useResendVerificationMutation,
  useUpdateProfileMutation,
  useVerifyEmailMutation,
} from './mutations/useAuthMutation';
import { useAuthQuery } from './queries/useAuthQuery';

export interface UseAuthResult {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: Error | null;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  googleLogin: (dto: GoogleAuthRequestDto) => Promise<void>;
  logout: () => Promise<void>;
  verifyEmail: (dto: VerifyEmailRequest) => Promise<void>;
  resendVerification: () => Promise<void>;
  updateProfile: (dto: UpdateProfileRequest | FormData) => Promise<void>;
  deleteAccount: (confirmationPhrase: string) => Promise<void>;
  isAuthenticated: boolean;
  isVerified: boolean;
  loginMutation: UseMutationResult<TokenResponse, Error, LoginDto>;
  registerMutation: UseMutationResult<RegisterResponse, Error, RegisterDto>;
  googleLoginMutation: UseMutationResult<GoogleAuthResponse, Error, GoogleAuthRequestDto>;
  logoutMutation: UseMutationResult<void, Error, void>;
  verifyEmailMutation: UseMutationResult<User, Error, VerifyEmailRequest>;
  resendVerificationMutation: UseMutationResult<{ message: string }, Error, void>;
  updateProfileMutation: UseMutationResult<User, Error, UpdateProfileRequest | FormData>;
  deleteAccountMutation: UseMutationResult<DeleteAccountResponse, Error, DeleteAccountInput>;
}

export function useAuth(): UseAuthResult {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { isLoading: userLoading, error: userError } = useAuthQuery();

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const googleLoginMutation = useGoogleLoginMutation();
  const logoutMutation = useLogoutMutation();
  const deleteAccountMutation = useDeleteAccountMutation();
  const verifyEmailMutation = useVerifyEmailMutation();
  const resendVerificationMutation = useResendVerificationMutation();
  const updateProfileMutation = useUpdateProfileMutation();
  const deletionIdempotencyKey = useRef<string | null>(null);
  const deletionInFlight = useRef<Promise<void> | null>(null);

  const login = useCallback(
    async (dto: LoginDto) => {
      await loginMutation.mutateAsync(dto);
      router.replace(Routes.app.home);
    },
    [loginMutation, router],
  );

  const register = useCallback(
    async (dto: RegisterDto) => {
      await registerMutation.mutateAsync(dto);
      router.replace(Routes.verifyEmail);
    },
    [registerMutation, router],
  );

  const googleLogin = useCallback(
    async (dto: GoogleAuthRequestDto) => {
      await googleLoginMutation.mutateAsync(dto);
      router.replace(Routes.app.home);
    },
    [googleLoginMutation, router],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    router.replace(Routes.auth.login);
  }, [logoutMutation, router]);

  const verifyEmailAction = useCallback(
    async (dto: VerifyEmailRequest) => {
      await verifyEmailMutation.mutateAsync(dto);
      router.replace(Routes.onboarding);
    },
    [verifyEmailMutation, router],
  );

  const resendVerification = useCallback(async () => {
    await resendVerificationMutation.mutateAsync();
  }, [resendVerificationMutation]);

  const updateProfileAction = useCallback(
    async (dto: UpdateProfileRequest | FormData): Promise<void> => {
      await updateProfileMutation.mutateAsync(dto);
    },
    [updateProfileMutation],
  );

  const deleteAccount = useCallback(
    async (confirmationPhrase: string): Promise<void> => {
      if (deletionInFlight.current !== null) {
        await deletionInFlight.current;
        return;
      }

      const idempotencyKey: string = deletionIdempotencyKey.current ?? createDeletionIdempotencyKey();
      deletionIdempotencyKey.current = idempotencyKey;

      const request: Promise<void> = (async (): Promise<void> => {
        const result: DeleteAccountResponse = await deleteAccountMutation.mutateAsync({
          confirmationPhrase,
          idempotencyKey,
        });

        if (result.status !== 'DELETED' && result.status !== 'ALREADY_DELETED') return;

        queryClient.clear();
        await clearAuth();
        router.replace(Routes.auth.login);
        deletionIdempotencyKey.current = null;
      })();

      deletionInFlight.current = request;
      try {
        await request;
      } finally {
        if (deletionInFlight.current === request) deletionInFlight.current = null;
      }
    },
    [clearAuth, deleteAccountMutation, queryClient, router],
  );

  return {
    user,
    token,
    isLoading:
      userLoading ||
      loginMutation.isPending ||
      registerMutation.isPending ||
      googleLoginMutation.isPending ||
      deleteAccountMutation.isPending,
    error: userError,
    login,
    register,
    googleLogin,
    logout,
    verifyEmail: verifyEmailAction,
    resendVerification,
    updateProfile: updateProfileAction,
    deleteAccount,
    isAuthenticated: !!token,
    isVerified: user?.isVerified ?? false,
    loginMutation,
    registerMutation,
    googleLoginMutation,
    logoutMutation,
    verifyEmailMutation,
    resendVerificationMutation,
    updateProfileMutation,
    deleteAccountMutation,
  };
}

/**
 * Creates a bounded idempotency key for one account-deletion attempt.
 *
 * @returns A unique key that can be safely reused for an explicit retry.
 */
function createDeletionIdempotencyKey(): string {
  return `account-deletion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}
