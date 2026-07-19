import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '@/api/endpoints/auth';
import { authQueryKeys } from '../queries/useAuthQuery';
import { useAuthStore } from '@/store/auth.store';
import type {
  LoginDto,
  RegisterDto,
  TokenResponse,
  RegisterResponse,
  VerifyEmailRequest,
  UpdateProfileRequest,
} from '@/types/auth.types';
import type { User } from '@/types/user.types';

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<TokenResponse, Error, LoginDto>({
    mutationFn: (dto) => authAPI.login(dto),
    onSuccess: (data) => {
      setAuth(data.accessToken, data.refreshToken, data.expiresIn);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
    },
  });
}

export function useRegisterMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<RegisterResponse, Error, RegisterDto>({
    mutationFn: (dto) => authAPI.register(dto),
    onSuccess: (data) => {
      setAuth(data.accessToken, data.refreshToken, data.expiresIn);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation<void, Error, void>({
    mutationFn: () => authAPI.logout(),
    onSuccess: () => {
      clearAuth();
      queryClient.clear();
    },
  });
}

export function useVerifyEmailMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<User, Error, VerifyEmailRequest>({
    mutationFn: (dto) => authAPI.verifyEmail(dto),
    onSuccess: (user) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
    },
  });
}

export function useResendVerificationMutation() {
  return useMutation<{ message: string }, Error, void>({
    mutationFn: () => authAPI.resendVerification(),
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<User, Error, UpdateProfileRequest>({
    mutationFn: (dto) => authAPI.updateProfile(dto),
    onSuccess: (user) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
    },
  });
}
