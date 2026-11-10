import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { authAPI } from '@/api/endpoints/auth';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types/user.types';

export const authQueryKeys = {
  all: ['auth'] as const,
  me: (accountSessionId: number): readonly ['auth', 'me', number] => [...authQueryKeys.all, 'me', accountSessionId],
};

/** Reads the profile for the current sign-in session, including across token refreshes. */
export function useAuthQuery(): UseQueryResult<User, Error> {
  const token = useAuthStore((s) => s.token);
  const accountSessionId = useAuthStore((s) => s.accountSessionId);

  return useQuery<User, Error>({
    queryKey: authQueryKeys.me(accountSessionId),
    queryFn: async ({ signal }: { signal: AbortSignal }): Promise<User> => {
      const user = await authAPI.getMe({ expectedAuthSessionId: accountSessionId, signal });
      if (signal.aborted) throw new Error('Profile request was cancelled');
      useAuthStore.getState().setUser(user, accountSessionId);
      return user;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!token,
  });
}
