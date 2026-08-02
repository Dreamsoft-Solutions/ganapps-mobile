import { type InfiniteData, type UseInfiniteQueryResult, useInfiniteQuery } from '@tanstack/react-query';
import { profileAPI } from '@/api/endpoints/profile';
import type { PaginatedResponse } from '@/api/types/api-response';
import { useAuthStore } from '@/store/auth.store';
import type { JoinedGanap } from '@/types/profile.types';

type JoinedGanapPage = PaginatedResponse<JoinedGanap>;

/** Query keys for current User profile data. */
export const profileQueryKeys = {
  all: ['profile'] as const,
  joinedGanaps: (take: number) => [...profileQueryKeys.all, 'joined-ganaps', take] as const,
};

/**
 * Derives the next offset from an offset-paginated joined Ganap page.
 *
 * @param lastPage - Most recently fetched page.
 * @returns The next offset, or undefined when the final page was fetched.
 */
export function getNextJoinedGanapPageParam(lastPage: JoinedGanapPage): number | undefined {
  const nextSkip = lastPage.pagination.skip + lastPage.pagination.take;
  return nextSkip < lastPage.pagination.total ? nextSkip : undefined;
}

/**
 * Fetches the current User's joined Ganaps with offset pagination.
 *
 * @param take - Number of Ganaps requested per page.
 * @returns The TanStack infinite query result.
 */
export function useJoinedGanapsQuery(
  take: number,
): UseInfiniteQueryResult<InfiniteData<JoinedGanapPage, number>, Error> {
  const token = useAuthStore((s) => s.token);

  return useInfiniteQuery<JoinedGanapPage, Error, InfiniteData<JoinedGanapPage, number>, readonly unknown[], number>({
    queryKey: profileQueryKeys.joinedGanaps(take),
    queryFn: ({ pageParam }: { pageParam: number }): Promise<JoinedGanapPage> =>
      profileAPI.listJoinedGanaps({ skip: pageParam, take }),
    getNextPageParam: (lastPage: JoinedGanapPage): number | undefined => getNextJoinedGanapPageParam(lastPage),
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!token,
  });
}
