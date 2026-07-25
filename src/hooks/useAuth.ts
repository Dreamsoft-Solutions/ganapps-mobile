import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useAuthStore } from '@/store/auth.store';
import type { LoginDto, RegisterDto, UpdateProfileRequest, VerifyEmailRequest } from '@/types/auth.types';
import {
  useLoginMutation,
  useLogoutMutation,
  useRegisterMutation,
  useResendVerificationMutation,
  useUpdateProfileMutation,
  useVerifyEmailMutation,
} from './mutations/useAuthMutation';
import { useAuthQuery } from './queries/useAuthQuery';

export function useAuth() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { isLoading: userLoading, error: userError } = useAuthQuery();

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();
  const verifyEmailMutation = useVerifyEmailMutation();
  const resendVerificationMutation = useResendVerificationMutation();
  const updateProfileMutation = useUpdateProfileMutation();

  const login = useCallback(
    async (dto: LoginDto) => {
      await loginMutation.mutateAsync(dto);
      router.replace('/(app)/(home)');
    },
    [loginMutation, router],
  );

  const register = useCallback(
    async (dto: RegisterDto) => {
      await registerMutation.mutateAsync(dto);
      router.replace('/verify-email');
    },
    [registerMutation, router],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    router.replace('/(auth)/login');
  }, [logoutMutation, router]);

  const verifyEmailAction = useCallback(
    async (dto: VerifyEmailRequest) => {
      await verifyEmailMutation.mutateAsync(dto);
      router.replace('/onboarding');
    },
    [verifyEmailMutation, router],
  );

  const resendVerification = useCallback(async () => {
    await resendVerificationMutation.mutateAsync();
  }, [resendVerificationMutation]);

  const updateProfileAction = useCallback(
    async (dto: UpdateProfileRequest) => {
      await updateProfileMutation.mutateAsync(dto);
      await useAuthStore.getState().completeOnboarding();
      router.replace('/(app)/(home)');
    },
    [updateProfileMutation, router],
  );

  return {
    user,
    token,
    isLoading: userLoading || loginMutation.isPending || registerMutation.isPending,
    error: userError,
    login,
    register,
    logout,
    verifyEmail: verifyEmailAction,
    resendVerification,
    updateProfile: updateProfileAction,
    isAuthenticated: !!token,
    isVerified: user?.isVerified ?? false,
    loginMutation,
    registerMutation,
    logoutMutation,
    verifyEmailMutation,
    resendVerificationMutation,
    updateProfileMutation,
  };
}
