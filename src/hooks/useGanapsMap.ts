import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem } from '@/types/ganap.types';
import { ganapQueryKeys } from './queries/useGanapsQuery';

export interface UseGanapsMapFilters {
  search: string;
  tag: string | null;
}

export interface UseGanapsMapResult {
  items: GanapListItem[];
  tags: string[];
  search: string;
  setSearch: (search: string) => void;
  tag: string | null;
  setTag: (tag: string | null) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: UseQueryResult<CursorPage<GanapListItem>, Error>['refetch'];
}

const MAP_LIMIT = 100;

/**
 * Aggregated hook for discovering Ganaps on the map.
 *
 * Manages search/tag filters and exposes the public Ganap list as a single page
 * large enough for the map viewport.
 *
 * @returns Filter state, query state, and the list of visible Ganaps.
 */
export function useGanapsMap(): UseGanapsMapResult {
  const [search, setSearch] = useState<string>('');
  const [tag, setTag] = useState<string | null>(null);

  const query = useQuery<CursorPage<GanapListItem>, Error>({
    queryKey: ganapQueryKeys.list({
      search: search.trim() || undefined,
      tag: tag ?? undefined,
    }),
    queryFn: () =>
      ganapsAPI.list({
        search: search.trim() || undefined,
        tag: tag ?? undefined,
        limit: MAP_LIMIT,
      }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const tags = useMemo(() => {
    const uniqueTags = new Set<string>();
    for (const ganap of items) {
      for (const t of ganap.tags) {
        uniqueTags.add(t);
      }
    }
    return Array.from(uniqueTags).sort();
  }, [items]);

  const handleSetTag = useCallback((value: string | null): void => {
    setTag(value);
  }, []);

  const handleSetSearch = useCallback((value: string): void => {
    setSearch(value);
  }, []);

  return {
    items,
    tags,
    search,
    setSearch: handleSetSearch,
    tag,
    setTag: handleSetTag,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
