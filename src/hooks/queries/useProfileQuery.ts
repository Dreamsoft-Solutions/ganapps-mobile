import { type InfiniteData, type UseInfiniteQueryResult, useInfiniteQuery } from '@tanstack/react-query';
import { profileAPI } from '@/api/endpoints/profile';
import type { PaginatedResponse } from '@/api/types/api-response';
import { useAuthStore } from '@/store/auth.store';
import type { JoinedGanap, JoinedGanapFilters, JoinedGanapParams, SavedGanap } from '@/types/profile.types';

type JoinedGanapPage = PaginatedResponse<JoinedGanap>;
type SavedGanapPage = PaginatedResponse<SavedGanap>;

/** Query keys for current User profile data. */
export const profileQueryKeys = {
  all: ['profile'] as const,
  joinedGanaps: (take: number, filters: JoinedGanapFilters = {}) =>
    [...profileQueryKeys.all, 'joined-ganaps', take, filters] as const,
  savedGanapsRoot: () => [...profileQueryKeys.all, 'saved-ganaps'] as const,
  savedGanaps: (take: number) => [...profileQueryKeys.savedGanapsRoot(), take] as const,
};

/**
 * Derives the next offset from an offset-paginated page.
 *
 * Takes any `PaginatedResponse` rather than one list's page type, so the joined
 * and saved queries share it. Only `pagination` is read.
 *
 * @param lastPage - Most recently fetched page.
 * @returns The next offset, or undefined when the final page was fetched.
 */
export function getNextGanapPageParam(lastPage: PaginatedResponse<unknown>): number | undefined {
  const nextSkip = lastPage.pagination.skip + lastPage.pagination.take;
  return nextSkip < lastPage.pagination.total ? nextSkip : undefined;
}

/**
 * Fetches the current User's joined Ganaps with offset pagination.
 *
 * @param take - Number of Ganaps requested per page.
 * @param filters - Optional search and time filters.
 * @returns The TanStack infinite query result.
 */
export function useJoinedGanapsQuery(
  take: number,
  filters: JoinedGanapFilters = {},
): UseInfiniteQueryResult<InfiniteData<JoinedGanapPage, number>, Error> {
  const token = useAuthStore((s) => s.token);

  return useInfiniteQuery<JoinedGanapPage, Error, InfiniteData<JoinedGanapPage, number>, readonly unknown[], number>({
    queryKey: profileQueryKeys.joinedGanaps(take, filters),
    queryFn: ({ pageParam }: { pageParam: number }): Promise<JoinedGanapPage> => {
      const params: JoinedGanapParams = { skip: pageParam, take };
      if (filters.search !== undefined) params.search = filters.search;
      if (filters.time !== undefined) params.time = filters.time;
      return profileAPI.listJoinedGanaps(params);
    },
    getNextPageParam: (lastPage: JoinedGanapPage): number | undefined => getNextGanapPageParam(lastPage),
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!token,
  });
}

/**
 * Fetches the current User's saved Ganaps with offset pagination.
 *
 * The endpoint takes no filters, so the key carries only the page size.
 *
 * @param take - Number of Ganaps requested per page.
 * @returns The TanStack infinite query result.
 */
export function useSavedGanapsQuery(take: number): UseInfiniteQueryResult<InfiniteData<SavedGanapPage, number>, Error> {
  const token = useAuthStore((s) => s.token);

  return useInfiniteQuery<SavedGanapPage, Error, InfiniteData<SavedGanapPage, number>, readonly unknown[], number>({
    queryKey: profileQueryKeys.savedGanaps(take),
    queryFn: ({ pageParam }: { pageParam: number }): Promise<SavedGanapPage> =>
      profileAPI.listSavedGanaps({ skip: pageParam, take }),
    getNextPageParam: (lastPage: SavedGanapPage): number | undefined => getNextGanapPageParam(lastPage),
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!token,
  });
}
