import {
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutateAsyncFunction,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem, JoinGanapResult } from '@/types/ganap.types';
import {
  type ToggleLikeVariables,
  type ToggleSaveVariables,
  useJoinGanapMutation,
  useLeaveGanapMutation,
  useLikeGanapMutation,
  useSaveGanapMutation,
} from './mutations/useGanapMutation';
import { ganapQueryKeys } from './queries/useGanapsQuery';

/** One page of the public Ganap list. */
type GanapPage = CursorPage<GanapListItem>;

type GanapsInfiniteResult = UseInfiniteQueryResult<InfiniteData<GanapPage, string | undefined>, Error>;

/** How many Ganaps to request per page. The server caps `limit` at 100. */
export const PAGE_SIZE = 20;

/**
 * Derives the next page's cursor from the page just fetched.
 *
 * Exported so the rule can be tested without rendering the hook. Returning
 * `undefined` rather than `null` is what tells TanStack there is no next page;
 * `null` would be treated as a valid cursor and fetch forever.
 *
 * @param lastPage - The most recently fetched page
 * @returns The cursor for the next request, or undefined on the last page
 */
export function getNextGanapPageParam(lastPage: GanapPage): string | undefined {
  return lastPage.pagination.nextCursor ?? undefined;
}

export interface UseGanapsResult {
  items: GanapListItem[];
  isLoading: boolean;
  error: Error | null;
  hasNextPage: boolean;
  fetchNextPage: GanapsInfiniteResult['fetchNextPage'];
  isFetchingNextPage: boolean;
  join: UseMutateAsyncFunction<JoinGanapResult, Error, string>;
  leave: UseMutateAsyncFunction<void, Error, string>;
  toggleLike: UseMutateAsyncFunction<void, Error, ToggleLikeVariables>;
  toggleSave: UseMutateAsyncFunction<void, Error, ToggleSaveVariables>;
  isJoining: boolean;
  isLeaving: boolean;
}

/**
 * The Ganap browse list plus the actions a student can take on one.
 *
 * Pages by cursor, not offset — the server returns `nextCursor` and this hook
 * feeds it back as `cursor`.
 *
 * @returns Flattened items, paging state, and the four student actions
 */
export function useGanaps(): UseGanapsResult {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useInfiniteQuery<
    GanapPage,
    Error,
    InfiniteData<GanapPage, string | undefined>,
    readonly unknown[],
    string | undefined
  >({
    queryKey: ganapQueryKeys.infiniteList(),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      ganapsAPI.list({ cursor: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: getNextGanapPageParam,
    initialPageParam: undefined,
  });

  const joinMutation = useJoinGanapMutation();
  const leaveMutation = useLeaveGanapMutation();
  const likeMutation = useLikeGanapMutation();
  const saveMutation = useSaveGanapMutation();

  return {
    items: data?.pages.flatMap((page: GanapPage) => page.items) ?? [],
    isLoading,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    join: joinMutation.mutateAsync,
    leave: leaveMutation.mutateAsync,
    toggleLike: likeMutation.mutateAsync,
    toggleSave: saveMutation.mutateAsync,
    isJoining: joinMutation.isPending,
    isLeaving: leaveMutation.isPending,
  };
}
