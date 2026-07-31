import { useCallback, useMemo, useState } from 'react';
import type { Ganap } from '@/types/ganap.types';
import { useGanapsQuery } from './queries/useGanapsQuery';

export interface UseGanapsFilters {
  search: string;
  tag: string | null;
}

export interface UseGanapsResult {
  items: Ganap[];
  tags: string[];
  search: string;
  setSearch: (search: string) => void;
  tag: string | null;
  setTag: (tag: string | null) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const DEFAULT_LIMIT = 100;

/**
 * Aggregated hook for discovering Ganaps on the map.
 *
 * Manages search/tag filters and exposes the public Ganap list.
 *
 * @returns Filter state, query state, and the list of visible Ganaps.
 */
export function useGanaps(): UseGanapsResult {
  const [search, setSearch] = useState<string>('');
  const [tag, setTag] = useState<string | null>(null);

  const query = useGanapsQuery({
    search: search.trim() || undefined,
    tag: tag ?? undefined,
    limit: DEFAULT_LIMIT,
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
