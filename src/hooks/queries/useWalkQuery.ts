import { type InfiniteData, type UseInfiniteQueryResult, useInfiniteQuery } from '@tanstack/react-query';
import { walkAPI } from '@/api/endpoints/walk';
import type { WalkPage, WalkParams } from '@/types/walk.types';
import { isClientError } from '@/utils/query-failure';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';
import { walkQueryKeys } from './walk-query-keys';

/** How long an abandoned walk stays cached; a screen that leaves also removes its own walk. */
const WALK_GC_TIME_MS: number = 10 * 60 * 1000;

/** The pages of one Event Walk, cursor to cursor. */
export type WalkInfiniteResult = UseInfiniteQueryResult<InfiniteData<WalkPage, string | undefined>, Error>;

/**
 * Returns the cursor for the walk's next page.
 *
 * `undefined`, not `null`, is what tells TanStack Query the walk is exhausted.
 *
 * @param lastPage - The most recently fetched page
 * @returns The next cursor, or undefined on the last page
 */
export function getNextWalkPageParam(lastPage: WalkPage): string | undefined {
  return lastPage.pagination.nextCursor ?? undefined;
}

/**
 * Fetches the pages of one Event Walk.
 *
 * A walk is a snapshot ranked once at its start, so its pages never go stale: nothing
 * refetches them on mount, reconnect or focus, and a like or save edits them in place
 * instead of invalidating them. A 4xx is final, and the screen renders it, so neither a
 * retry nor the global error toast applies.
 *
 * @param run - Which walk this is; a new number starts a new walk with the same parameters
 * @param params - Optional position and seed Ganap ids the walk starts from
 * @param enabled - Whether the walk may start, such as once the position is known
 * @returns The infinite query for the walk
 */
export function useWalkQuery(run: number, params: WalkParams, enabled: boolean): WalkInfiniteResult {
  return useInfiniteQuery<
    WalkPage,
    Error,
    InfiniteData<WalkPage, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: walkQueryKeys.run(run, params),
    queryFn: ({ pageParam }: { pageParam: string | undefined }): Promise<WalkPage> => walkAPI.list(params, pageParam),
    getNextPageParam: getNextWalkPageParam,
    initialPageParam: undefined,
    staleTime: Infinity,
    gcTime: WALK_GC_TIME_MS,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: (failureCount: number, error: Error): boolean => failureCount < 1 && !isClientError(error),
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
    enabled,
  });
}
