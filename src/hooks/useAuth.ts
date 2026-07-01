import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useLoginMutation, useRegisterMutation, useLogoutMutation } from './mutations/useAuthMutation';
import { useAuthQuery } from './queries/useAuthQuery';
import { useAuthStore } from '@/store/auth.store';
import type { LoginDto, RegisterDto } from '@/types/auth.types';

export function useAuth() {
  const router = useRouter();
  const { token } = useAuthStore();
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
  } = useAuthQuery();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();

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
      router.replace('/(auth)/login');
    },
    [registerMutation, router],
  );

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    router.replace('/(auth)/login');
  }, [logoutMutation, router]);

  return {
    user,
    token,
    isLoading:
      userLoading ||
      loginMutation.isPending ||
      registerMutation.isPending,
    error: userError,
    login,
    register,
    logout,
    isAuthenticated: !!token,
  };
}
