import { keepPreviousData, type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem } from '@/types/ganap.types';
import { type GanapListFilters, ganapQueryKeys } from './queries/useGanapsQuery';

/** One page large enough to cluster the whole city viewport. The server caps `limit` at 100. */
const MAP_LIMIT = 100;

export interface UseGanapsMapResult {
  items: GanapListItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: UseQueryResult<CursorPage<GanapListItem>, Error>['refetch'];
}

/**
 * The Ganaps the map draws as pins, for the filters it is given.
 *
 * Deliberately one large page rather than cursor pages: clustering needs every
 * marker in the viewport at once, and a cluster built from page one would redraw
 * itself on every scroll of a list the user is not looking at.
 *
 * Filter state lives in `useGanapFilters`, not here — this hook is data only.
 *
 * @param filters - Active discovery filters; omitted means the whole catalogue
 * @returns The visible Ganaps and the query's state
 */
export function useGanapsMap(filters?: GanapListFilters): UseGanapsMapResult {
  const query = useQuery<CursorPage<GanapListItem>, Error>({
    queryKey: ganapQueryKeys.list(filters),
    queryFn: (): Promise<CursorPage<GanapListItem>> => ganapsAPI.list({ ...filters, limit: MAP_LIMIT }),
    // Without this a filter change empties `data`, so `isLoading` flips true and
    // the screen swaps the whole MapView for a spinner — tearing down the native
    // map and dismissing the keyboard mid-search. Holding the previous page keeps
    // `isLoading` true only for the very first load.
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const items = useMemo((): GanapListItem[] => query.data?.items ?? [], [query.data]);

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
