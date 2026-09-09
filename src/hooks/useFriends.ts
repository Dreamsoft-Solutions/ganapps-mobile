import type { UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  useAcceptFriendRequestMutation,
  useCreateFriendRequestMutation,
  useLookupFriendMutation,
  useRegenerateFriendCodeMutation,
  useRejectFriendRequestMutation,
  useRevokeFriendRequestMutation,
  useUnfriendMutation,
  useUpdateFriendSettingsMutation,
} from '@/hooks/mutations/useFriendsMutation';
import { type UseChatSummariesQueryResult, useChatSummariesQuery } from '@/hooks/queries/useChatQuery';
import {
  type UseFriendGoingQueryResult,
  type UseFriendRequestsQueryResult,
  type UseFriendsQueryResult,
  useFriendGoingQuery,
  useFriendPresenceQuery,
  useFriendProfileQuery,
  useFriendRequestsQuery,
  useFriendsCodeQuery,
  useFriendsQuery,
} from '@/hooks/queries/useFriendsQuery';
import type {
  FriendCode,
  FriendGoingRecord,
  FriendPage,
  FriendPresenceResponse,
  FriendRequestDirection,
  FriendRequestItem,
  FriendUserSummary,
} from '@/types/friends.types';

/** Top-level Friends hub segment. */
export type FriendsHubSegment = 'chats' | 'friends' | 'requests';

/** Options controlling which Friends hub server queries are active. */
export interface UseFriendsOptions {
  segment?: FriendsHubSegment;
  requestDirection?: FriendRequestDirection;
  codeOpen?: boolean;
  goingEnabled?: boolean;
}

/** Aggregate Friends hub result with query state and relationship actions. */
export interface UseFriendsResult {
  segment: FriendsHubSegment;
  requestDirection: FriendRequestDirection;
  chatQuery: UseChatSummariesQueryResult;
  friendsQuery: UseFriendsQueryResult;
  requestsQuery: UseFriendRequestsQueryResult;
  goingQuery: UseFriendGoingQueryResult;
  presenceQuery: UseQueryResult<FriendPresenceResponse, Error>;
  codeQuery: UseQueryResult<FriendCode, Error>;
  chatSummaries: UseChatSummariesQueryResult['summaries'];
  friends: FriendUserSummary[];
  requests: FriendRequestItem[];
  going: FriendGoingRecord[];
  presence: FriendPresenceResponse['items'];
  screenSession: string | null;
  refreshPresence: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lookupMutation: ReturnType<typeof useLookupFriendMutation>;
  createRequestMutation: ReturnType<typeof useCreateFriendRequestMutation>;
  acceptRequestMutation: ReturnType<typeof useAcceptFriendRequestMutation>;
  rejectRequestMutation: ReturnType<typeof useRejectFriendRequestMutation>;
  revokeRequestMutation: ReturnType<typeof useRevokeFriendRequestMutation>;
  regenerateCodeMutation: ReturnType<typeof useRegenerateFriendCodeMutation>;
  unfriendMutation: ReturnType<typeof useUnfriendMutation>;
  updateSettingsMutation: ReturnType<typeof useUpdateFriendSettingsMutation>;
}

/**
 * Coordinates the Friends hub's server-owned feeds, bounded presence, and social mutations.
 *
 * Segment queries are enabled only for the visible segment. The Friends screen
 * does not create any message-history query and presence uses one opaque seed.
 *
 * @param options - Visible segment and lazy-surface options
 * @returns Aggregated Friends state and typed mutation handles
 */
export function useFriends(options: UseFriendsOptions = {}): UseFriendsResult {
  const segment: FriendsHubSegment = options.segment ?? 'chats';
  const requestDirection: FriendRequestDirection = options.requestDirection ?? 'incoming';
  const codeOpen: boolean = options.codeOpen ?? false;
  const [screenSession, setScreenSession] = useState<string | undefined>(undefined);
  const chatQuery: UseChatSummariesQueryResult = useChatSummariesQuery(segment === 'chats');
  const friendsQuery: UseFriendsQueryResult = useFriendsQuery(segment === 'friends');
  const incomingQuery: UseFriendRequestsQueryResult = useFriendRequestsQuery(
    'incoming',
    segment === 'requests' && requestDirection === 'incoming',
  );
  const outgoingQuery: UseFriendRequestsQueryResult = useFriendRequestsQuery(
    'outgoing',
    segment === 'requests' && requestDirection === 'outgoing',
  );
  const requestsQuery: UseFriendRequestsQueryResult = requestDirection === 'incoming' ? incomingQuery : outgoingQuery;
  const presenceQuery: UseQueryResult<FriendPresenceResponse, Error> = useFriendPresenceQuery(screenSession, true);
  const goingQuery: UseFriendGoingQueryResult = useFriendGoingQuery(options.goingEnabled ?? false);
  const codeQuery: UseQueryResult<FriendCode, Error> = useFriendsCodeQuery(codeOpen);
  const lookupMutation = useLookupFriendMutation();
  const createRequestMutation = useCreateFriendRequestMutation();
  const acceptRequestMutation = useAcceptFriendRequestMutation();
  const rejectRequestMutation = useRejectFriendRequestMutation();
  const revokeRequestMutation = useRevokeFriendRequestMutation();
  const regenerateCodeMutation = useRegenerateFriendCodeMutation();
  const unfriendMutation = useUnfriendMutation();
  const updateSettingsMutation = useUpdateFriendSettingsMutation();

  useEffect((): void => {
    const returnedSession: string | undefined = presenceQuery.data?.screenSession;
    if (returnedSession && returnedSession !== screenSession) setScreenSession(returnedSession);
  }, [presenceQuery.data?.screenSession, screenSession]);

  const refreshPresence = useCallback(async (): Promise<void> => {
    const response = await presenceQuery.refetch();
    const returnedSession: string | undefined = response.data?.screenSession;
    if (returnedSession && returnedSession !== screenSession) setScreenSession(returnedSession);
  }, [presenceQuery.refetch, screenSession]);

  const activeQuery = segment === 'chats' ? chatQuery : segment === 'friends' ? friendsQuery : requestsQuery;
  const isLoading: boolean = activeQuery.isLoading || (presenceQuery.isLoading && presenceQuery.data === undefined);
  const error: Error | null = activeQuery.error ?? presenceQuery.error ?? null;
  const refetch = useCallback(async (): Promise<void> => {
    await Promise.all([activeQuery.refetch(), refreshPresence()]);
  }, [activeQuery.refetch, refreshPresence]);

  return {
    segment,
    requestDirection,
    chatQuery,
    friendsQuery,
    requestsQuery,
    goingQuery,
    presenceQuery,
    codeQuery,
    chatSummaries: chatQuery.summaries,
    friends: friendsQuery.friends,
    requests: requestsQuery.requests,
    going: goingQuery.going,
    presence: presenceQuery.data?.items ?? [],
    screenSession: screenSession ?? null,
    refreshPresence,
    isLoading,
    error,
    refetch,
    lookupMutation,
    createRequestMutation,
    acceptRequestMutation,
    rejectRequestMutation,
    revokeRequestMutation,
    regenerateCodeMutation,
    unfriendMutation,
    updateSettingsMutation,
  };
}

/** Reads one profile through the aggregate hook's relationship query contract. */
export const useFriendsProfileQuery: typeof useFriendProfileQuery = useFriendProfileQuery;

/** Compile-time discoverability alias for a cursor page used by Friends consumers. */
export type FriendsCursorPage<T> = FriendPage<T>;
