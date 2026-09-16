import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { type AnnouncementPage, useGanapAnnouncementsQuery } from '@/hooks/queries/useGanapAnnouncementsQuery';
import type { GanapAnnouncement } from '@/types/ganap.types';
import { isEventHubForbidden } from '@/utils/event-hub';

/** The TanStack infinite query result shape returned by the announcement query. */
type AnnouncementInfiniteResult = UseInfiniteQueryResult<InfiniteData<AnnouncementPage, number>, Error>;

/** Flattened announcements plus the paging and access state the Event Hub view needs. */
export interface UseGanapAnnouncementsResult {
  announcements: GanapAnnouncement[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refetch: AnnouncementInfiniteResult['refetch'];
  fetchNextPage: AnnouncementInfiniteResult['fetchNextPage'];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  hasLostAccess: boolean;
}

/**
 * Flattens paginated Event Hub announcements and exposes UI-facing paging and
 * access state.
 *
 * Announcements are returned in the order the server sent them; the server
 * already sorts newest first, so no client-side sort is applied.
 *
 * @param ganapId - Id of the Ganap whose announcements are requested
 * @param isEligible - Whether the caller's registration allows Event Hub access
 * @returns Flattened announcements, paging state, and forbidden-access state
 */
export function useGanapAnnouncements(ganapId: string, isEligible: boolean): UseGanapAnnouncementsResult {
  const query = useGanapAnnouncementsQuery(ganapId, isEligible);

  return {
    announcements: query.data?.pages.flatMap((page: AnnouncementPage) => page.items) ?? [],
    total: query.data?.pages[0]?.pagination.total ?? 0,
    isLoading: query.isLoading,
    error: query.error ?? null,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    isFetchingNextPage: Boolean(query.isFetchingNextPage),
    isFetchNextPageError: Boolean(query.isFetchNextPageError),
    hasLostAccess: isEventHubForbidden(query.error ?? null),
  };
}
