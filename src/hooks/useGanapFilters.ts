import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem } from '@/types/ganap.types';
import { ganapQueryKeys } from './queries/useGanapsQuery';
import { useDebouncedValue } from './useDebouncedValue';

/** How long typing settles before a search reaches a query key. */
export const SEARCH_DEBOUNCE_MS = 350;

/** Page size for the vocabulary query. Large enough to see the whole catalogue's tags. */
const VOCABULARY_LIMIT = 100;

export interface UseGanapFiltersResult {
  /** The raw search text, updated on every keystroke. Bind this to the input. */
  search: string;
  setSearch: (value: string) => void;
  /** The settled, trimmed search — `undefined` when there is no filter. Filter on this. */
  debouncedSearch: string | undefined;
  tag: string | null;
  setTag: (value: string | null) => void;
  /** Every tag in the catalogue, sorted. Never narrowed by the active filters. */
  tags: string[];
}

/**
 * Owns the discovery filters shared by the map pins and the event feed.
 *
 * Lifted out of `useGanapsMap` so both surfaces read one state rather than
 * keeping two copies in step.
 *
 * Two behaviours are deliberate. Search is debounced before consumers put it in
 * a query key, so typing does not refetch on every keystroke. The tag vocabulary
 * comes from its own unfiltered query rather than from the filtered response, so
 * no active filter can collapse the chip row to its own results.
 *
 * @returns The filter values, their setters, and the tag vocabulary.
 */
export function useGanapFilters(): UseGanapFiltersResult {
  const [search, setSearch] = useState<string>('');
  const [tag, setTag] = useState<string | null>(null);

  const settled: string = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const debouncedSearch: string | undefined = settled.trim() || undefined;

  const vocabularyQuery: UseQueryResult<CursorPage<GanapListItem>, Error> = useQuery<CursorPage<GanapListItem>, Error>({
    queryKey: ganapQueryKeys.list(),
    queryFn: (): Promise<CursorPage<GanapListItem>> => ganapsAPI.list({ limit: VOCABULARY_LIMIT }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const tags = useMemo((): string[] => {
    const unique = new Set<string>();
    for (const ganap of vocabularyQuery.data?.items ?? []) {
      for (const value of ganap.tags) {
        unique.add(value);
      }
    }
    return Array.from(unique).sort();
  }, [vocabularyQuery.data]);

  const handleSetSearch = useCallback((value: string): void => {
    setSearch(value);
  }, []);

  const handleSetTag = useCallback((value: string | null): void => {
    setTag(value);
  }, []);

  return {
    search,
    setSearch: handleSetSearch,
    debouncedSearch,
    tag,
    setTag: handleSetTag,
    tags,
  };
}
