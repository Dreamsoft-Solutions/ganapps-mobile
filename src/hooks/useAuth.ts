import type { UseMutationResult } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Routes } from '@/constants/routes';
import { useAuthStore } from '@/store/auth.store';
import type {
  GoogleAuthRequestDto,
  LoginDto,
  RegisterDto,
  RegisterResponse,
  TokenResponse,
  UpdateProfileRequest,
  VerifyEmailRequest,
} from '@/types/auth.types';
import type { User } from '@/types/user.types';
import {
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
  isAuthenticated: boolean;
  isVerified: boolean;
  loginMutation: UseMutationResult<TokenResponse, Error, LoginDto>;
  registerMutation: UseMutationResult<RegisterResponse, Error, RegisterDto>;
  googleLoginMutation: UseMutationResult<TokenResponse, Error, GoogleAuthRequestDto>;
  logoutMutation: UseMutationResult<void, Error, void>;
  verifyEmailMutation: UseMutationResult<User, Error, VerifyEmailRequest>;
  resendVerificationMutation: UseMutationResult<{ message: string }, Error, void>;
  updateProfileMutation: UseMutationResult<User, Error, UpdateProfileRequest | FormData>;
}

export function useAuth(): UseAuthResult {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { isLoading: userLoading, error: userError } = useAuthQuery();

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const googleLoginMutation = useGoogleLoginMutation();
  const logoutMutation = useLogoutMutation();
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
    async (dto: UpdateProfileRequest | FormData) => {
      await updateProfileMutation.mutateAsync(dto);
      await useAuthStore.getState().completeOnboarding();
      router.replace(Routes.app.home);
    },
    [updateProfileMutation, router],
  );

  return {
    user,
    token,
    isLoading: userLoading || loginMutation.isPending || registerMutation.isPending || googleLoginMutation.isPending,
    error: userError,
    login,
    register,
    googleLogin,
    logout,
    verifyEmail: verifyEmailAction,
    resendVerification,
    updateProfile: updateProfileAction,
    isAuthenticated: !!token,
    isVerified: user?.isVerified ?? false,
    loginMutation,
    registerMutation,
    googleLoginMutation,
    logoutMutation,
    verifyEmailMutation,
    resendVerificationMutation,
    updateProfileMutation,
  };
}
