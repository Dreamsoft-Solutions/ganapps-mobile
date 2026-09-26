import { type UseMutationResult, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Routes } from '@/constants/routes';
import { useAuthStore } from '@/store/auth.store';
import type {
  CompletePasswordResetDto,
  DeleteAccountInput,
  DeleteAccountResponse,
  GoogleAuthRequestDto,
  GoogleAuthResponse,
  LoginDto,
  PasswordResetResponse,
  RegisterDto,
  RegisterResponse,
  RequestPasswordResetDto,
  TokenResponse,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from '@/types/auth.types';
import type { User } from '@/types/user.types';
import {
  useCompletePasswordResetMutation,
  useDeleteAccountMutation,
  useGoogleLoginMutation,
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useRequestPasswordResetMutation,
  useResendVerificationMutation,
  useUpdateProfileMutation,
  useVerifyEmailMutation,
} from './mutations/useAuthMutation';
import { useAuthQuery } from './queries/useAuthQuery';

/** Authenticated user state and account actions, including destructive session completion. */
export interface UseAuthResult {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: Error | null;
  login: (dto: LoginDto) => Promise<void>;
  requestPasswordReset: (dto: RequestPasswordResetDto) => Promise<PasswordResetResponse>;
  completePasswordReset: (dto: CompletePasswordResetDto) => Promise<PasswordResetResponse>;
  register: (dto: RegisterDto) => Promise<void>;
  googleLogin: (dto: GoogleAuthRequestDto) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: (input: DeleteAccountInput) => Promise<void>;
  verifyEmail: (dto: VerifyEmailRequest) => Promise<void>;
  resendVerification: () => Promise<void>;
  updateProfile: (dto: UpdateProfileRequest | FormData) => Promise<void>;
  isAuthenticated: boolean;
  isVerified: boolean;
  loginMutation: UseMutationResult<TokenResponse, Error, LoginDto>;
  requestPasswordResetMutation: UseMutationResult<PasswordResetResponse, Error, RequestPasswordResetDto>;
  completePasswordResetMutation: UseMutationResult<PasswordResetResponse, Error, CompletePasswordResetDto>;
  registerMutation: UseMutationResult<RegisterResponse, Error, RegisterDto>;
  googleLoginMutation: UseMutationResult<GoogleAuthResponse, Error, GoogleAuthRequestDto>;
  logoutMutation: UseMutationResult<void, Error, void>;
  deleteAccountMutation: UseMutationResult<DeleteAccountResponse, Error, DeleteAccountInput>;
  verifyEmailMutation: UseMutationResult<User, Error, VerifyEmailRequest>;
  resendVerificationMutation: UseMutationResult<{ message: string }, Error, void>;
  updateProfileMutation: UseMutationResult<User, Error, UpdateProfileRequest | FormData>;
}

/**
 * Combines auth queries and mutations and owns their navigation side effects.
 * @returns User state, mutation state, and account actions.
 */
export function useAuth(): UseAuthResult {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { isLoading: userLoading, error: userError } = useAuthQuery();

  const loginMutation = useLoginMutation();
  const requestPasswordResetMutation = useRequestPasswordResetMutation();
  const completePasswordResetMutation = useCompletePasswordResetMutation();
  const registerMutation = useRegisterMutation();
  const googleLoginMutation = useGoogleLoginMutation();
  const logoutMutation = useLogoutMutation();
  const deleteAccountMutation = useDeleteAccountMutation();
  const verifyEmailMutation = useVerifyEmailMutation();
  const resendVerificationMutation = useResendVerificationMutation();
  const updateProfileMutation = useUpdateProfileMutation();

  const login = useCallback(
    async (dto: LoginDto) => {
      await loginMutation.mutateAsync(dto);
      router.replace(Routes.app.home);
    },
    [loginMutation, router],
  );

  const requestPasswordReset = useCallback(
    (dto: RequestPasswordResetDto): Promise<PasswordResetResponse> => requestPasswordResetMutation.mutateAsync(dto),
    [requestPasswordResetMutation],
  );

  const completePasswordReset = useCallback(
    (dto: CompletePasswordResetDto): Promise<PasswordResetResponse> => completePasswordResetMutation.mutateAsync(dto),
    [completePasswordResetMutation],
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

  const deleteAccount = useCallback(
    async (input: DeleteAccountInput): Promise<void> => {
      const result = await deleteAccountMutation.mutateAsync(input);
      if (result.status !== 'DELETED' && result.status !== 'ALREADY_DELETED') {
        throw new Error('Account deletion could not be confirmed. Please try again.');
      }
      queryClient.clear();
      await useAuthStore.getState().clearAuth();
      router.replace(Routes.auth.login);
    },
    [deleteAccountMutation, queryClient, router],
  );

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

  return {
    user,
    token,
    isLoading: userLoading || loginMutation.isPending || registerMutation.isPending || googleLoginMutation.isPending,
    error: userError,
    login,
    requestPasswordReset,
    completePasswordReset,
    register,
    googleLogin,
    logout,
    deleteAccount,
    verifyEmail: verifyEmailAction,
    resendVerification,
    updateProfile: updateProfileAction,
    isAuthenticated: !!token,
    isVerified: user?.isVerified ?? false,
    loginMutation,
    requestPasswordResetMutation,
    completePasswordResetMutation,
    registerMutation,
    googleLoginMutation,
    logoutMutation,
    deleteAccountMutation,
    verifyEmailMutation,
    resendVerificationMutation,
    updateProfileMutation,
  };
}
