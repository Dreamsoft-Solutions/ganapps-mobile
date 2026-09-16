import { type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { PaginatedResponse } from '@/api/types/api-response';
import type { JoinedGanap, JoinedGanapFilters } from '@/types/profile.types';
import { useJoinedGanapsQuery } from './queries/useProfileQuery';

type JoinedGanapPage = PaginatedResponse<JoinedGanap>;

/** The flattened state exposed by the joined Ganap profile list. */
export interface UseJoinedGanapsResult {
  items: JoinedGanap[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  fetchNextPage: UseInfiniteQueryResult<InfiniteData<JoinedGanapPage, number>, Error>['fetchNextPage'];
  isFetchingNextPage: boolean;
  isRefetching: boolean;
  refetch: UseInfiniteQueryResult<InfiniteData<JoinedGanapPage, number>, Error>['refetch'];
}

/**
 * Provides flattened joined Ganaps and paging controls for profile screens.
 *
 * @param take - Number of joined Ganaps requested per page.
 * @param filters - Optional search and time filters.
 * @returns Joined Ganaps, total count, and paging state.
 */
export function useJoinedGanaps(take: number, filters: JoinedGanapFilters = {}): UseJoinedGanapsResult {
  const query = useJoinedGanapsQuery(take, filters);
  const items: JoinedGanap[] = useMemo(
    () => query.data?.pages.flatMap((page): JoinedGanap[] => page.items) ?? [],
    [query.data],
  );

  return {
    items,
    total: query.data?.pages[0]?.pagination.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    hasNextPage: !!query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}
