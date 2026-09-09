import type { QueryFunctionContext } from '@tanstack/query-core';
import { type InfiniteData, type UseInfiniteQueryResult, useInfiniteQuery } from '@tanstack/react-query';
import { BLOCKED_USERS_PAGE_SIZE, moderationAPI } from '@/api/endpoints/moderation';
import { useAuthStore } from '@/store/auth.store';
import type { BlockedUserSummary, BlockedUsersPage } from '@/types/moderation.types';

/** Opaque cursor used by the blocked-user list, including the initial page. */
export type ModerationPageParam = string | undefined;

/** Stable cache keys for moderation server state. */
export const moderationQueryKeys = {
  all: ['moderation'] as const,
  blocks: () => [...moderationQueryKeys.all, 'blocks'] as const,
  report: (targetType: 'MESSAGE' | 'USER', targetId: string) =>
    [...moderationQueryKeys.all, 'report', targetType, targetId] as const,
};

/** Result shape for the blocked-user list with flattened safe summaries. */
export type UseBlockedUsersQueryResult = UseInfiniteQueryResult<
  InfiniteData<BlockedUsersPage, ModerationPageParam>,
  Error
> & {
  blockedUsers: BlockedUserSummary[];
};

/** Returns the next opaque cursor without interpreting it. */
export function getNextModerationPageParam(page: BlockedUsersPage): string | undefined {
  return page.nextCursor ?? undefined;
}

/**
 * Lists Users blocked by the current User.
 *
 * @param enabled - Whether the current screen may request the authenticated list
 * @returns Infinite query state and flattened safe profile summaries
 */
export function useBlockedUsersQuery(enabled = true): UseBlockedUsersQueryResult {
  const token: string | null = useAuthStore((state) => state.token);
  const result: UseInfiniteQueryResult<InfiniteData<BlockedUsersPage, ModerationPageParam>, Error> = useInfiniteQuery<
    BlockedUsersPage,
    Error,
    InfiniteData<BlockedUsersPage, ModerationPageParam>,
    readonly ['moderation', 'blocks'],
    ModerationPageParam
  >({
    queryKey: moderationQueryKeys.blocks(),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<readonly ['moderation', 'blocks'], ModerationPageParam>): Promise<BlockedUsersPage> =>
      moderationAPI.listBlocks({ cursor: pageParam, limit: BLOCKED_USERS_PAGE_SIZE }),
    initialPageParam: undefined,
    getNextPageParam: getNextModerationPageParam,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    enabled: Boolean(token && enabled),
  });
  const blockedUsers: BlockedUserSummary[] =
    result.data?.pages.flatMap((page: BlockedUsersPage): BlockedUserSummary[] => page.items) ?? [];
  return { ...result, blockedUsers };
}
