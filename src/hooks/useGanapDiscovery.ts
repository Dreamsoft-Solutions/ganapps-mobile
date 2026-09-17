import { useMemo } from 'react';
import { NEARBY_RADIUS_KM } from '@/utils/map-viewport';
import type { GanapListFilters } from './queries/useGanapsQuery';
import { useGanapFilters } from './useGanapFilters';
import { type UseGanapsResult, useGanaps } from './useGanaps';
import { type UseGanapsMapResult, useGanapsMap } from './useGanapsMap';
import { type UseNearbyLocationResult, useNearbyLocation } from './useNearbyLocation';

export interface UseGanapDiscoveryResult {
  /** The composed filter object both surfaces query with. */
  filters: GanapListFilters;
  search: string;
  setSearch: (value: string) => void;
  tag: string | null;
  setTag: (value: string | null) => void;
  tags: string[];
  /** One large page, for pins and clustering. */
  map: UseGanapsMapResult;
  /** Cursor-paginated browse list, for the feed sheet. */
  feed: UseGanapsResult;
  /** Location permission, priming, and the nearby toggle. */
  nearby: UseNearbyLocationResult;
}

/**
 * Everything the map tab discovers Ganaps with, behind one hook.
 *
 * Composes the filter state, the nearby location toggle, the map's single large
 * page, and the feed's cursor pages. The map and the feed read the *same*
 * filters object, which is what makes the two surfaces agree by construction
 * rather than by synchronisation.
 *
 * The two queries deliberately do not share a cache key: the map wants one page
 * of 100 for clustering, the feed wants 20 at a time by cursor. One shared key
 * would give one of them the wrong page size.
 *
 * @returns Filter state, the nearby controls, and both query surfaces
 */
export function useGanapDiscovery(): UseGanapDiscoveryResult {
  const { search, setSearch, debouncedSearch, tag, setTag, tags } = useGanapFilters();
  const nearby = useNearbyLocation();

  const isNearbyApplied: boolean = nearby.isActive && nearby.coords !== null;
  const latitude: number | undefined = nearby.coords?.latitude;
  const longitude: number | undefined = nearby.coords?.longitude;

  const filters = useMemo((): GanapListFilters => {
    const geo =
      isNearbyApplied && latitude !== undefined && longitude !== undefined
        ? { lat: latitude, long: longitude, radius: NEARBY_RADIUS_KM }
        : {};

    return {
      search: debouncedSearch,
      tag: tag ?? undefined,
      ...geo,
    };
  }, [debouncedSearch, tag, isNearbyApplied, latitude, longitude]);

  const map = useGanapsMap(filters);
  const feed = useGanaps(filters);

  return { filters, search, setSearch, tag, setTag, tags, map, feed, nearby };
}
