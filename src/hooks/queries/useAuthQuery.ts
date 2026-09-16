import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { authAPI } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types/user.types';

export const authQueryKeys = {
  all: ['auth'] as const,
  me: () => [...authQueryKeys.all, 'me'] as const,
};

export function useAuthQuery(): UseQueryResult<User, Error> {
  const token = useAuthStore((s) => s.token);

  return useQuery<User, Error>({
    queryKey: authQueryKeys.me(),
    queryFn: () => authAPI.getMe(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!token,
  });
}
