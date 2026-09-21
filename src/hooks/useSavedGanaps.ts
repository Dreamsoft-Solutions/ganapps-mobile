import { type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { PaginatedResponse } from '@/api/types/api-response';
import type { SavedGanap } from '@/types/profile.types';
import { useSavedGanapsQuery } from './queries/useProfileQuery';

type SavedGanapPage = PaginatedResponse<SavedGanap>;

/** The flattened state exposed by the saved Ganap profile list. */
export interface UseSavedGanapsResult {
  items: SavedGanap[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  fetchNextPage: UseInfiniteQueryResult<InfiniteData<SavedGanapPage, number>, Error>['fetchNextPage'];
  isFetchingNextPage: boolean;
  isRefetching: boolean;
  refetch: UseInfiniteQueryResult<InfiniteData<SavedGanapPage, number>, Error>['refetch'];
}

/**
 * Provides flattened saved Ganaps and paging controls for the My Events tab.
 *
 * @param take - Number of saved Ganaps requested per page.
 * @returns Saved Ganaps, total count, and paging state.
 */
export function useSavedGanaps(take: number): UseSavedGanapsResult {
  const query = useSavedGanapsQuery(take);
  const items: SavedGanap[] = useMemo(
    () => query.data?.pages.flatMap((page): SavedGanap[] => page.items) ?? [],
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
