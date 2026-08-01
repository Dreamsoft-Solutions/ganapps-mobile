import { keepPreviousData, type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem } from '@/types/ganap.types';
import { ganapQueryKeys } from './queries/useGanapsQuery';
import { useDebouncedValue } from './useDebouncedValue';

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
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Aggregated hook for discovering Ganaps on the map.
 *
 * Manages search/tag filters and exposes the public Ganap list as a single page
 * large enough for the map viewport.
 *
 * Two behaviours are deliberate. Search is debounced before it reaches the query
 * key, so typing does not refetch — and re-render the map — on every keystroke.
 * The tag chips come from their own unfiltered query rather than from the
 * filtered response, so no filter can collapse the chip row to its own results.
 * When no filter is active both queries share one key, so TanStack dedupes them
 * into a single request.
 *
 * @returns Filter state, query state, and the list of visible Ganaps.
 */
export function useGanapsMap(): UseGanapsMapResult {
  const [search, setSearch] = useState<string>('');
  const [tag, setTag] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const trimmedSearch = debouncedSearch.trim() || undefined;

  const query = useQuery<CursorPage<GanapListItem>, Error>({
    queryKey: ganapQueryKeys.list({
      search: trimmedSearch,
      tag: tag ?? undefined,
    }),
    queryFn: (): Promise<CursorPage<GanapListItem>> =>
      ganapsAPI.list({
        search: trimmedSearch,
        tag: tag ?? undefined,
        limit: MAP_LIMIT,
      }),
    // Without this a filter change empties `data`, so `isLoading` flips true and
    // the screen swaps the whole MapView for a spinner — tearing down the native
    // map and dismissing the keyboard mid-search. Holding the previous page keeps
    // `isLoading` true only for the very first load.
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  // The chip vocabulary is a property of the whole catalogue, not of the current
  // filter, so it gets its own unfiltered query. Deriving it from `query` instead
  // made each filter hide the tags it had just excluded.
  const tagVocabularyQuery = useQuery<CursorPage<GanapListItem>, Error>({
    queryKey: ganapQueryKeys.list(),
    queryFn: (): Promise<CursorPage<GanapListItem>> => ganapsAPI.list({ limit: MAP_LIMIT }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const availableTags = useMemo((): string[] => {
    const uniqueTags = new Set<string>();
    for (const ganap of tagVocabularyQuery.data?.items ?? []) {
      for (const t of ganap.tags) {
        uniqueTags.add(t);
      }
    }
    return Array.from(uniqueTags).sort();
  }, [tagVocabularyQuery.data]);

  const handleSetTag = useCallback((value: string | null): void => {
    setTag(value);
  }, []);

  const handleSetSearch = useCallback((value: string): void => {
    setSearch(value);
  }, []);

  return {
    items,
    tags: availableTags,
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
