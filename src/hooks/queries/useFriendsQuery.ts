import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { friendsAPI } from '@/api/endpoints/friends';
import { useAuthStore } from '@/store/auth.store';
import type {
  FriendCode,
  FriendGoingRecord,
  FriendPage,
  FriendPresenceResponse,
  FriendProfile,
  FriendRequestDirection,
  FriendRequestItem,
  FriendSettings,
  FriendUserSummary,
} from '@/types/friends.types';
import type { ParsedApiError } from '@/utils/error-handling';

/** Opaque cursor used by Friends pagination, including the initial page. */
export type FriendsPageParam = string | undefined;

/** Stable cache keys for all social-graph server state. */
export const friendsQueryKeys = {
  all: ['friends'] as const,
  code: () => [...friendsQueryKeys.all, 'code'] as const,
  list: (cursor: FriendsPageParam) => [...friendsQueryKeys.all, 'list', cursor] as const,
  requests: (direction: FriendRequestDirection) => [...friendsQueryKeys.all, 'requests', direction] as const,
  profile: (userId: string) => [...friendsQueryKeys.all, 'profile', userId] as const,
  presence: () => [...friendsQueryKeys.all, 'presence'] as const,
  going: () => [...friendsQueryKeys.all, 'going'] as const,
  goingForGanap: (ganapId: string) => [...friendsQueryKeys.going(), ganapId] as const,
  settings: () => [...friendsQueryKeys.all, 'settings'] as const,
};

/** Flattened accepted-friend list query result. */
export type UseFriendsQueryResult = UseInfiniteQueryResult<
  InfiniteData<FriendPage<FriendUserSummary>, FriendsPageParam>,
  Error
> & {
  friends: FriendUserSummary[];
};

/** Flattened request list query result. */
export type UseFriendRequestsQueryResult = UseInfiniteQueryResult<
  InfiniteData<FriendPage<FriendRequestItem>, FriendsPageParam>,
  Error
> & {
  requests: FriendRequestItem[];
};

/** Flattened Going list query result. */
export type UseFriendGoingQueryResult = UseInfiniteQueryResult<
  InfiniteData<FriendPage<FriendGoingRecord>, FriendsPageParam>,
  Error
> & {
  going: FriendGoingRecord[];
};

/** One page size for accepted friends, requests, and Going. */
export const FRIENDS_PAGE_SIZE: number = 30;

/** One bounded server-owned presence sample; no next page is requested. */
export const FRIENDS_PRESENCE_LIMIT: number = 20;

/** Returns the server's opaque next cursor without interpreting it. */
export function getNextFriendsPageParam<T>(page: FriendPage<T>): string | undefined {
  return page.nextCursor ?? undefined;
}

/** Query defaults shared by Friends server-state hooks. */
const FRIENDS_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
};

/** Reads a normalized error code without relying on its user-facing message. */
function getErrorCode(error: Error): string | undefined {
  return (error as ParsedApiError).errorCode;
}

/** Retries transient Friends reads once, but never repeats a rate-limited request. */
function shouldRetryFriendsQuery(failureCount: number, error: Error): boolean {
  const errorCode: string | undefined = getErrorCode(error);
  return errorCode !== 'FRIEND_CODE_RATE_LIMITED' && failureCount < 1;
}

/**
 * Lists accepted, unblocked friend summaries in server order.
 *
 * @param enabled - Whether the current Friends segment may request data
 * @returns Infinite accepted-friend query and flattened safe summaries
 */
export function useFriendsQuery(enabled = true): UseFriendsQueryResult {
  const token: string | null = useAuthStore((state) => state.token);
  const result: UseInfiniteQueryResult<
    InfiniteData<FriendPage<FriendUserSummary>, FriendsPageParam>,
    Error
  > = useInfiniteQuery<
    FriendPage<FriendUserSummary>,
    Error,
    InfiniteData<FriendPage<FriendUserSummary>, FriendsPageParam>,
    readonly ['friends', 'list', FriendsPageParam],
    FriendsPageParam
  >({
    queryKey: friendsQueryKeys.list(undefined),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<readonly ['friends', 'list', FriendsPageParam], FriendsPageParam>): Promise<
      FriendPage<FriendUserSummary>
    > => friendsAPI.listFriends({ cursor: pageParam, limit: FRIENDS_PAGE_SIZE }),
    initialPageParam: undefined,
    getNextPageParam: getNextFriendsPageParam,
    ...FRIENDS_QUERY_OPTIONS,
    retry: shouldRetryFriendsQuery,
    enabled: Boolean(token && enabled),
  });
  const friends: FriendUserSummary[] =
    result.data?.pages.flatMap((page: FriendPage<FriendUserSummary>): FriendUserSummary[] => page.items) ?? [];
  return { ...result, friends };
}

/**
 * Lists pending requests for one explicit direction.
 *
 * @param direction - Incoming or outgoing request side
 * @param enabled - Whether the current Requests segment may request data
 * @returns Infinite request query and flattened safe request rows
 */
export function useFriendRequestsQuery(
  direction: FriendRequestDirection,
  enabled = true,
): UseFriendRequestsQueryResult {
  const token: string | null = useAuthStore((state) => state.token);
  const result: UseInfiniteQueryResult<
    InfiniteData<FriendPage<FriendRequestItem>, FriendsPageParam>,
    Error
  > = useInfiniteQuery<
    FriendPage<FriendRequestItem>,
    Error,
    InfiniteData<FriendPage<FriendRequestItem>, FriendsPageParam>,
    readonly ['friends', 'requests', FriendRequestDirection],
    FriendsPageParam
  >({
    queryKey: friendsQueryKeys.requests(direction),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<readonly ['friends', 'requests', FriendRequestDirection], FriendsPageParam>): Promise<
      FriendPage<FriendRequestItem>
    > => friendsAPI.listRequests(direction, { cursor: pageParam, limit: FRIENDS_PAGE_SIZE }),
    initialPageParam: undefined,
    getNextPageParam: getNextFriendsPageParam,
    ...FRIENDS_QUERY_OPTIONS,
    retry: shouldRetryFriendsQuery,
    enabled: Boolean(token && enabled),
  });
  const requests: FriendRequestItem[] =
    result.data?.pages.flatMap((page: FriendPage<FriendRequestItem>): FriendRequestItem[] => page.items) ?? [];
  return { ...result, requests };
}

/**
 * Reads one relationship-scoped safe profile.
 *
 * @param userId - Profile User identifier
 * @param enabled - Whether the profile route may request data
 * @returns Safe profile query
 */
export function useFriendProfileQuery(userId: string, enabled = true): UseQueryResult<FriendProfile, Error> {
  const token: string | null = useAuthStore((state) => state.token);
  return useQuery<FriendProfile, Error>({
    queryKey: friendsQueryKeys.profile(userId),
    queryFn: (): Promise<FriendProfile> => friendsAPI.getProfile(userId),
    ...FRIENDS_QUERY_OPTIONS,
    retry: shouldRetryFriendsQuery,
    enabled: Boolean(token && userId && enabled),
  });
}

/**
 * Reads the current User's Friend Code lazily.
 *
 * @param enabled - Whether the My Code surface is open
 * @returns Current server-issued code query
 */
export function useFriendsCodeQuery(enabled = false): UseQueryResult<FriendCode, Error> {
  const token: string | null = useAuthStore((state) => state.token);
  return useQuery<FriendCode, Error>({
    queryKey: friendsQueryKeys.code(),
    queryFn: (): Promise<FriendCode> => friendsAPI.getCode(),
    ...FRIENDS_QUERY_OPTIONS,
    retry: shouldRetryFriendsQuery,
    enabled: Boolean(token && enabled),
  });
}

/**
 * Reads one bounded active-friend sample for the focused Friends screen.
 *
 * The query intentionally has no cursor or next-page operation. The server's
 * opaque session seed is reused on an explicit same-screen refresh.
 *
 * @param screenSession - Opaque seed returned by a prior focus request
 * @param enabled - Whether the Friends screen is focused
 * @returns One bounded presence response
 */
export function useFriendPresenceQuery(
  screenSession?: string,
  enabled = true,
): UseQueryResult<FriendPresenceResponse, Error> {
  const token: string | null = useAuthStore((state) => state.token);
  return useQuery<FriendPresenceResponse, Error>({
    queryKey: friendsQueryKeys.presence(),
    queryFn: (): Promise<FriendPresenceResponse> =>
      friendsAPI.listPresence({ screenSession, limit: FRIENDS_PRESENCE_LIMIT }),
    ...FRIENDS_QUERY_OPTIONS,
    retry: shouldRetryFriendsQuery,
    enabled: Boolean(token && enabled),
  });
}

/**
 * Lists privacy-filtered upcoming and ongoing Ganaps for accepted friends.
 *
 * @param enabled - Whether the Friends segment may request Going data
 * @param ganapId - Optional Ganap whose Going friends should be returned
 * @returns Infinite Going query and flattened safe rows
 */
type FriendGoingQueryKey =
  | ReturnType<typeof friendsQueryKeys.going>
  | ReturnType<typeof friendsQueryKeys.goingForGanap>;

export function useFriendGoingQuery(enabled = false, ganapId?: string): UseFriendGoingQueryResult {
  const token: string | null = useAuthStore((state) => state.token);
  const queryKey: FriendGoingQueryKey = ganapId ? friendsQueryKeys.goingForGanap(ganapId) : friendsQueryKeys.going();
  const result: UseInfiniteQueryResult<
    InfiniteData<FriendPage<FriendGoingRecord>, FriendsPageParam>,
    Error
  > = useInfiniteQuery<
    FriendPage<FriendGoingRecord>,
    Error,
    InfiniteData<FriendPage<FriendGoingRecord>, FriendsPageParam>,
    FriendGoingQueryKey,
    FriendsPageParam
  >({
    queryKey,
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<FriendGoingQueryKey, FriendsPageParam>): Promise<FriendPage<FriendGoingRecord>> =>
      friendsAPI.listGoing({ cursor: pageParam, limit: FRIENDS_PAGE_SIZE, ganapId }),
    initialPageParam: undefined,
    getNextPageParam: getNextFriendsPageParam,
    ...FRIENDS_QUERY_OPTIONS,
    retry: shouldRetryFriendsQuery,
    enabled: Boolean(token && enabled),
  });
  const going: FriendGoingRecord[] =
    result.data?.pages.flatMap((page: FriendPage<FriendGoingRecord>): FriendGoingRecord[] => page.items) ?? [];
  return { ...result, going };
}

/**
 * Reads global presence and Going visibility settings.
 *
 * @param enabled - Whether the settings route may request data
 * @returns Server-owned settings query
 */
export function useFriendSettingsQuery(enabled = true): UseQueryResult<FriendSettings, Error> {
  const token: string | null = useAuthStore((state) => state.token);
  return useQuery<FriendSettings, Error>({
    queryKey: friendsQueryKeys.settings(),
    queryFn: (): Promise<FriendSettings> => friendsAPI.getSettings(),
    ...FRIENDS_QUERY_OPTIONS,
    retry: shouldRetryFriendsQuery,
    enabled: Boolean(token && enabled),
  });
}

/** Backwards-readable aliases for list/query consumers. */
export const useFriendListQuery: typeof useFriendsQuery = useFriendsQuery;
export const useFriendGoingListQuery: typeof useFriendGoingQuery = useFriendGoingQuery;
