import { useQuery } from '@tanstack/react-query';
import { authAPI } from '@/api/endpoints/auth';
import type { User } from '@/types/user.types';

export const authQueryKeys = {
  all: ['auth'] as const,
  me: () => [...authQueryKeys.all, 'me'] as const,
};

export function useAuthQuery() {
  return useQuery<User, Error>({
    queryKey: authQueryKeys.me(),
    queryFn: () => authAPI.getMe(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
