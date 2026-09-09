import {
  type InfiniteData,
  type QueryClient,
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { moderationAPI } from '@/api/endpoints/moderation';
import { type ChatPageParam, chatQueryKeys } from '@/hooks/queries/useChatQuery';
import { friendsQueryKeys } from '@/hooks/queries/useFriendsQuery';
import { moderationQueryKeys } from '@/hooks/queries/useModerationQuery';
import type {
  ChatConversationSummaryPage,
  ChatMessage,
  ChatMessagesPage,
  EventChatSummaryPage,
} from '@/types/chat.types';
import type { BlockedUsersPage, CreateReportInput, ModerationReportReceipt } from '@/types/moderation.types';
import {
  addOptimisticBlockedUser,
  addOptimisticUnblockedUser,
  removeOptimisticBlockedUser,
  removeOptimisticUnblockedUser,
} from '@/utils/moderation';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';

/** Query snapshot used to restore messages if a block request is rejected. */
export interface BlockedMessageQuerySnapshot {
  queryKey: readonly unknown[];
  data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined;
}

/** Context carried through an optimistic block mutation. */
export interface BlockUserMutationContext {
  messageSnapshots: BlockedMessageQuerySnapshot[];
  summarySnapshots: ChatSummaryQuerySnapshot[];
}

/** Query snapshot used to restore Event and Direct summary rows on a rejected block. */
export interface ChatSummaryQuerySnapshot {
  queryKey: readonly unknown[];
  data:
    | InfiniteData<EventChatSummaryPage, ChatPageParam>
    | InfiniteData<ChatConversationSummaryPage, ChatPageParam>
    | undefined;
}

/** Backwards-readable name for Event Chat summary snapshots. */
export type EventChatSummaryQuerySnapshot = ChatSummaryQuerySnapshot;

/** Variables accepted by the directional block mutation. */
export interface BlockUserVariables {
  userId: string;
}

/** Variables accepted by the directional unblock mutation. */
export interface UnblockUserVariables {
  userId: string;
}

/** Context carried through an optimistic unblock mutation. */
export interface UnblockUserMutationContext {
  blockedUsersData: InfiniteData<BlockedUsersPage, string | undefined> | undefined;
}

function filterBlockedMessages(
  data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined,
  userId: string,
): InfiniteData<ChatMessagesPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: ChatMessagesPage): ChatMessagesPage => ({
        ...page,
        items: page.items.filter((message: ChatMessage): boolean => message.senderId !== userId),
      }),
    ),
  };
}

function restoreMessageSnapshots(queryClient: QueryClient, snapshots: BlockedMessageQuerySnapshot[]): void {
  snapshots.forEach((snapshot: BlockedMessageQuerySnapshot): void => {
    queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(snapshot.queryKey, snapshot.data);
  });
}

function restoreSummarySnapshots(queryClient: QueryClient, snapshots: ChatSummaryQuerySnapshot[]): void {
  snapshots.forEach((snapshot: ChatSummaryQuerySnapshot): void => {
    queryClient.setQueryData(snapshot.queryKey, snapshot.data);
  });
}

function filterBlockedUsers(
  data: InfiniteData<BlockedUsersPage, string | undefined> | undefined,
  userId: string,
): InfiniteData<BlockedUsersPage, string | undefined> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: BlockedUsersPage): BlockedUsersPage => ({
        ...page,
        items: page.items.filter(
          (blockedUser: BlockedUsersPage['items'][number]): boolean => blockedUser.userId !== userId,
        ),
      }),
    ),
  };
}

/**
 * Submits a moderation report without changing message visibility.
 *
 * @returns Mutation accepting a server-shaped message or authorized User report
 */
export function useCreateReportMutation(): UseMutationResult<ModerationReportReceipt, Error, CreateReportInput> {
  const queryClient = useQueryClient();
  return useMutation<ModerationReportReceipt, Error, CreateReportInput>({
    mutationFn: (input: CreateReportInput): Promise<ModerationReportReceipt> => moderationAPI.createReport(input),
    onSuccess: (receipt: ModerationReportReceipt, variables: CreateReportInput): void => {
      queryClient.setQueryData<ModerationReportReceipt>(
        moderationQueryKeys.report(variables.target.type, variables.target.id),
        receipt,
      );
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Blocks a User with immediate, reversible filtering of loaded Event Chat pages.
 *
 * The server remains authoritative: a rejection restores every snapshot and
 * refetches the affected chat and block-list queries.
 *
 * @returns Optimistic directional block mutation
 */
export function useBlockUserMutation(): UseMutationResult<void, Error, BlockUserVariables, BlockUserMutationContext> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, BlockUserVariables, BlockUserMutationContext>({
    mutationFn: ({ userId }: BlockUserVariables): Promise<void> => moderationAPI.blockUser(userId),
    onMutate: async ({ userId }: BlockUserVariables): Promise<BlockUserMutationContext> => {
      await queryClient.cancelQueries({ queryKey: chatQueryKeys.all });
      await queryClient.cancelQueries({ queryKey: moderationQueryKeys.blocks() });
      const messageQueryRoots: readonly (readonly unknown[])[] = [
        chatQueryKeys.eventMessagesRoot(),
        chatQueryKeys.directMessagesRoot(),
      ];
      const messageSnapshots: BlockedMessageQuerySnapshot[] = messageQueryRoots.flatMap(
        (queryKeyRoot: readonly unknown[]): BlockedMessageQuerySnapshot[] =>
          queryClient.getQueriesData<InfiniteData<ChatMessagesPage, ChatPageParam>>({ queryKey: queryKeyRoot }).map(
            ([queryKey, data]: [
              readonly unknown[],
              InfiniteData<ChatMessagesPage, ChatPageParam> | undefined,
            ]): BlockedMessageQuerySnapshot => ({
              queryKey,
              data,
            }),
          ),
      );
      const eventSummarySnapshots: ChatSummaryQuerySnapshot[] = queryClient
        .getQueriesData<InfiniteData<EventChatSummaryPage, ChatPageParam>>({ queryKey: chatQueryKeys.eventList() })
        .map(
          ([queryKey, data]: [
            readonly unknown[],
            InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined,
          ]): ChatSummaryQuerySnapshot => ({
            queryKey,
            data,
          }),
        );
      const mixedSummarySnapshots: ChatSummaryQuerySnapshot[] = queryClient
        .getQueriesData<InfiniteData<ChatConversationSummaryPage, ChatPageParam>>({
          queryKey: chatQueryKeys.summaries(),
        })
        .map(
          ([queryKey, data]: [
            readonly unknown[],
            InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined,
          ]): ChatSummaryQuerySnapshot => ({
            queryKey,
            data,
          }),
        );
      const summarySnapshots: ChatSummaryQuerySnapshot[] = [...eventSummarySnapshots, ...mixedSummarySnapshots];
      addOptimisticBlockedUser(userId);
      messageSnapshots.forEach((snapshot: BlockedMessageQuerySnapshot): void => {
        queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
          snapshot.queryKey,
          (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) => filterBlockedMessages(data, userId),
        );
      });
      return { messageSnapshots, summarySnapshots };
    },
    onError: async (
      _error: Error,
      { userId }: BlockUserVariables,
      context: BlockUserMutationContext | undefined,
    ): Promise<void> => {
      removeOptimisticBlockedUser(userId);
      if (context) {
        restoreMessageSnapshots(queryClient, context.messageSnapshots);
        restoreSummarySnapshots(queryClient, context.summarySnapshots);
      }
      await Promise.allSettled([
        queryClient.refetchQueries({ queryKey: chatQueryKeys.all }),
        queryClient.refetchQueries({ queryKey: friendsQueryKeys.all }),
        queryClient.refetchQueries({ queryKey: moderationQueryKeys.blocks() }),
      ]);
    },
    onSuccess: async (
      _data: Awaited<ReturnType<typeof moderationAPI.blockUser>>,
      { userId }: BlockUserVariables,
    ): Promise<void> => {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventMessagesRoot(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.directMessagesRoot(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.all, refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.profile(userId), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.presence(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.going(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: moderationQueryKeys.blocks(), refetchType: 'all' }),
      ]);
      removeOptimisticBlockedUser(userId);
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Deactivates a directional block and refreshes server-authoritative chat state.
 *
 * Existing message history is not reconstructed in the local cache; the next
 * focused history request decides what the current User may see.
 *
 * @returns Mutation accepting the User to unblock
 */
export function useUnblockUserMutation(): UseMutationResult<void, Error, UnblockUserVariables> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, UnblockUserVariables, UnblockUserMutationContext>({
    mutationFn: ({ userId }: UnblockUserVariables): Promise<void> => moderationAPI.unblockUser(userId),
    onMutate: async ({ userId }: UnblockUserVariables): Promise<UnblockUserMutationContext> => {
      await queryClient.cancelQueries({ queryKey: moderationQueryKeys.blocks() });
      const blockedUsersData: InfiniteData<BlockedUsersPage, string | undefined> | undefined = queryClient.getQueryData(
        moderationQueryKeys.blocks(),
      );
      addOptimisticUnblockedUser(userId);
      queryClient.setQueryData<InfiniteData<BlockedUsersPage, string | undefined>>(
        moderationQueryKeys.blocks(),
        (data: InfiniteData<BlockedUsersPage, string | undefined> | undefined) => filterBlockedUsers(data, userId),
      );
      return { blockedUsersData };
    },
    onError: async (
      _error: Error,
      { userId }: UnblockUserVariables,
      context: UnblockUserMutationContext | undefined,
    ): Promise<void> => {
      removeOptimisticUnblockedUser(userId);
      if (context?.blockedUsersData !== undefined) {
        queryClient.setQueryData<InfiniteData<BlockedUsersPage, string | undefined>>(
          moderationQueryKeys.blocks(),
          context.blockedUsersData,
        );
      }
      await queryClient.refetchQueries({ queryKey: moderationQueryKeys.blocks() });
    },
    onSuccess: async (
      _data: Awaited<ReturnType<typeof moderationAPI.unblockUser>>,
      { userId }: UnblockUserVariables,
    ): Promise<void> => {
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: moderationQueryKeys.blocks(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.all, refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.profile(userId), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.presence(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: friendsQueryKeys.going(), refetchType: 'all' }),
        // Mark history stale without rebuilding a focused thread. The next
        // open fetches the visibility the server grants after unblocking.
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventMessagesRoot(), refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: chatQueryKeys.directMessagesRoot(), refetchType: 'none' }),
      ]);
      removeOptimisticUnblockedUser(userId);
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Backwards-readable alias for report callers that use the report operation name.
 *
 * @returns The report mutation hook
 */
export const useReportMutation: typeof useCreateReportMutation = useCreateReportMutation;

/** Keeps the blocked page type discoverable to cache consumers. */
export type ModerationBlockedUsersData = InfiniteData<BlockedUsersPage, string | undefined>;
