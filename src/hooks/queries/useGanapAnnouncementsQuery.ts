import { type InfiniteData, type UseInfiniteQueryResult, useInfiniteQuery } from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { PaginatedResponse } from '@/api/types/api-response';
import { useAuthStore } from '@/store/auth.store';
import type { GanapAnnouncement } from '@/types/ganap.types';
import { isEventHubForbidden } from '@/utils/event-hub';
import { ganapQueryKeys } from './useGanapsQuery';

/** One offset page of attendee-facing announcements. */
export type AnnouncementPage = PaginatedResponse<GanapAnnouncement>;

/** Number of announcements requested per page. */
export const ANNOUNCEMENT_PAGE_SIZE = 20;

/**
 * Derives the next offset for the announcement infinite query.
 *
 * Builds the next `skip` from every loaded item count across all fetched
 * pages rather than `pages * take`, so a partial final page still terminates
 * pagination correctly.
 *
 * @param lastPage - Most recently fetched announcement page
 * @param allPages - Every announcement page fetched so far, in order
 * @returns The next offset, or undefined once every item has loaded
 */
export function getNextAnnouncementPageParam(
  lastPage: AnnouncementPage,
  allPages: AnnouncementPage[],
): number | undefined {
  const loadedCount: number = allPages.reduce(
    (count: number, page: AnnouncementPage): number => count + page.items.length,
    0,
  );
  return loadedCount < lastPage.pagination.total ? loadedCount : undefined;
}

/**
 * Fetches one Ganap's attendee-facing announcements with offset pagination.
 *
 * Enabled only once a token exists, the Ganap id is non-empty, and the caller
 * has already established Event Hub eligibility. A normalized 403 is never
 * retried; other failures receive a single retry.
 *
 * @param ganapId - Id of the Ganap whose announcements are requested
 * @param isEligible - Whether the caller's registration allows Event Hub access
 * @returns The TanStack infinite query result
 */
export function useGanapAnnouncementsQuery(
  ganapId: string,
  isEligible: boolean,
): UseInfiniteQueryResult<InfiniteData<AnnouncementPage, number>, Error> {
  const token = useAuthStore((state) => state.token);

  return useInfiniteQuery<AnnouncementPage, Error, InfiniteData<AnnouncementPage, number>, readonly unknown[], number>({
    queryKey: ganapQueryKeys.announcements(ganapId),
    queryFn: ({ pageParam }: { pageParam: number }): Promise<AnnouncementPage> =>
      ganapsAPI.listUserAnnouncements(ganapId, { skip: pageParam, take: ANNOUNCEMENT_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: getNextAnnouncementPageParam,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount: number, error: Error): boolean => !isEventHubForbidden(error) && failureCount < 1,
    enabled: Boolean(token && ganapId && isEligible),
  });
}
