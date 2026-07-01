import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { authAPI } from '@/api/endpoints/auth';
import { authQueryKeys } from '../queries/useAuthQuery';
import { useAuthStore } from '@/store/auth.store';
import type { LoginDto, RegisterDto, LoginResponse } from '@/types/auth.types';

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const setToken = useAuthStore((s) => s.setToken);

  return useMutation<LoginResponse, Error, LoginDto>({
    mutationFn: (dto) => authAPI.login(dto),
    onSuccess: (data) => {
      setToken(data.token, data.refreshToken);
      queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
    },
  });
}

export function useRegisterMutation() {
  return useMutation<LoginResponse, Error, RegisterDto>({
    mutationFn: (dto) => authAPI.register(dto),
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
