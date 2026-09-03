import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { type FriendSettingsUpdate, friendsAPI } from '@/api/endpoints/friends';
import { chatQueryKeys } from '@/hooks/queries/useChatQuery';
import { friendsQueryKeys } from '@/hooks/queries/useFriendsQuery';
import type { FriendCode, FriendRequestResult, FriendSettings, FriendUserSummary } from '@/types/friends.types';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';

/**
 * Lazily looks up one safe target by Friend Code.
 *
 * @returns Mutation accepting a raw or grouped Friend Code
 */
export function useLookupFriendMutation(): UseMutationResult<FriendUserSummary, Error, string> {
  return useMutation<FriendUserSummary, Error, string>({
    mutationFn: (code: string): Promise<FriendUserSummary> => friendsAPI.lookup(code),
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Regenerates the current User's Friend Code after UI confirmation.
 *
 * @returns Mutation resolving to the new server-issued code
 */
export function useRegenerateFriendCodeMutation(): UseMutationResult<FriendCode, Error, void> {
  const queryClient = useQueryClient();
  return useMutation<FriendCode, Error, void>({
    mutationFn: (): Promise<FriendCode> => friendsAPI.regenerateCode(),
    onSuccess: (code: FriendCode): void => {
      queryClient.setQueryData<FriendCode>(friendsQueryKeys.code(), code);
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Sends a Friend request using the server's normalized, append-only attempt model.
 *
 * @returns Mutation accepting a raw Friend Code and returning the server outcome
 */
export function useCreateFriendRequestMutation(): UseMutationResult<FriendRequestResult, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<FriendRequestResult, Error, string>({
    mutationFn: (friendCode: string): Promise<FriendRequestResult> => friendsAPI.createRequest({ friendCode }),
    onSuccess: (result: FriendRequestResult): void => {
      void queryClient.invalidateQueries({ queryKey: friendsQueryKeys.requests('outgoing') });
      if (result.status === 'ACCEPTED' || result.status === 'AUTO_ACCEPTED') {
        void invalidateSocialQueries(queryClient);
      }
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Accepts an incoming Friend request and refreshes every affected social projection.
 *
 * @returns Mutation accepting a request-attempt identifier
 */
export function useAcceptFriendRequestMutation(): UseMutationResult<FriendRequestResult, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<FriendRequestResult, Error, string>({
    mutationFn: (attemptId: string): Promise<FriendRequestResult> => friendsAPI.acceptRequest(attemptId),
    onSuccess: (): void => {
      void invalidateSocialQueries(queryClient);
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Rejects an incoming Friend request while retaining the server cooldown outcome.
 *
 * @returns Mutation accepting a request-attempt identifier
 */
export function useRejectFriendRequestMutation(): UseMutationResult<FriendRequestResult, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<FriendRequestResult, Error, string>({
    mutationFn: (attemptId: string): Promise<FriendRequestResult> => friendsAPI.rejectRequest(attemptId),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: friendsQueryKeys.requests('incoming') });
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Revokes an outgoing Friend request while retaining the server cooldown outcome.
 *
 * @returns Mutation accepting a request-attempt identifier
 */
export function useRevokeFriendRequestMutation(): UseMutationResult<FriendRequestResult, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<FriendRequestResult, Error, string>({
    mutationFn: (attemptId: string): Promise<FriendRequestResult> => friendsAPI.revokeRequest(attemptId),
    onSuccess: (): void => {
      void queryClient.invalidateQueries({ queryKey: friendsQueryKeys.requests('outgoing') });
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Ends an accepted friendship while retaining any server-authorized Direct history.
 *
 * @returns Mutation accepting the friend User identifier
 */
export function useUnfriendMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (userId: string): Promise<void> => friendsAPI.unfriend(userId),
    onSuccess: (): void => {
      void invalidateSocialQueries(queryClient);
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Updates global presence and Going visibility preferences.
 *
 * @returns Mutation accepting one or both server-owned setting fields
 */
export function useUpdateFriendSettingsMutation(): UseMutationResult<FriendSettings, Error, FriendSettingsUpdate> {
  const queryClient = useQueryClient();
  return useMutation<FriendSettings, Error, FriendSettingsUpdate>({
    mutationFn: (input: FriendSettingsUpdate): Promise<FriendSettings> => friendsAPI.updateSettings(input),
    onSuccess: (settings: FriendSettings): void => {
      queryClient.setQueryData<FriendSettings>(friendsQueryKeys.settings(), settings);
      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.presence() }),
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.going() }),
      ]);
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Invalidates social and mixed-chat projections after a relationship mutation.
 *
 * @param queryClient - TanStack client owning mobile server state
 * @returns A promise resolving when invalidation requests settle
 */
export function invalidateSocialQueries(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  return Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: friendsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() }),
    queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList() }),
  ]).then((): void => undefined);
}
