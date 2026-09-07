import { type InfiniteData, type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatAPI, type SendDirectChatImageInput } from '@/api/endpoints/chat';
import { type ChatPageParam, chatQueryKeys } from '@/hooks/queries/useChatQuery';
import type { ChatMessage, ChatMessagesPage, ChatImageAsset } from '@/types/chat.types';
import type {
  ChatConversationSummary,
  ChatConversationSummaryPage,
  DirectChatReadResult,
} from '@/types/direct-chat.types';
import { compareChatMessagePositions, getChatMessagePreview, upsertChatMessage } from '@/utils/chat';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';

/** Variables for the first Direct text send, keyed by accepted friend User. */
export interface SendDirectMessageByFriendVariables {
  friendUserId: string;
  clientMessageId: string;
  content: string;
}

/** Variables for a Direct text send in an existing canonical conversation. */
export interface SendDirectMessageVariables {
  conversationId: string;
  clientMessageId: string;
  content: string;
}

/** Variables for the first Direct image send, keyed by accepted friend User. */
export interface SendDirectImageByFriendVariables {
  friendUserId: string;
  clientMessageId: string;
  file: ChatImageAsset;
}

/** Variables for a Direct image send in an existing canonical conversation. */
export interface SendDirectImageVariables {
  conversationId: string;
  clientMessageId: string;
  file: ChatImageAsset;
}

/** Variables for advancing the foreground Direct Seen cursor. */
export interface MarkDirectReadVariables {
  conversationId: string;
  throughMessageId: string;
}

function patchMessagePages(
  data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined,
  message: ChatMessage,
): InfiniteData<ChatMessagesPage, ChatPageParam> | undefined {
  if (!data || data.pages.length === 0) return data;
  const [firstPage, ...remainingPages]: ChatMessagesPage[] = data.pages;
  return {
    ...data,
    pages: [
      { ...firstPage, items: upsertChatMessage(firstPage.items, message) },
      ...remainingPages.map(
        (page: ChatMessagesPage): ChatMessagesPage => ({
          ...page,
          items: page.items.filter((item: ChatMessage): boolean => item.id !== message.id),
        }),
      ),
    ],
  };
}

function patchSummaryPages(
  data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined,
  message: ChatMessage,
  incrementUnread: boolean,
): InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: ChatConversationSummaryPage): ChatConversationSummaryPage => ({
        ...page,
        items: page.items.map((summary: ChatConversationSummary): ChatConversationSummary => {
          if (summary.conversationId !== message.conversationId || summary.type !== 'DIRECT') return summary;
          if (summary.lastMessage && compareChatMessagePositions(message, summary.lastMessage) <= 0) return summary;
          return {
            ...summary,
            lastMessage: {
              id: message.id,
              type: message.type,
              preview: getChatMessagePreview(message),
              sentAt: message.sentAt,
            },
            unreadCount: incrementUnread ? summary.unreadCount + 1 : summary.unreadCount,
            updatedAt: message.sentAt,
          };
        }),
      }),
    ),
  };
}

function patchSummaryRead(
  data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined,
  conversationId: string,
): InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: ChatConversationSummaryPage): ChatConversationSummaryPage => ({
        ...page,
        items: page.items.map(
          (summary: ChatConversationSummary): ChatConversationSummary =>
            summary.conversationId === conversationId ? { ...summary, unreadCount: 0 } : summary,
        ),
      }),
    ),
  };
}

function reconcileDirectMessage(queryClient: ReturnType<typeof useQueryClient>, message: ChatMessage): void {
  queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
    chatQueryKeys.directMessages(message.conversationId),
    (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) => patchMessagePages(data, message),
  );
  queryClient.setQueryData<InfiniteData<ChatConversationSummaryPage, ChatPageParam>>(
    chatQueryKeys.directSummaries(),
    (data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined) =>
      patchSummaryPages(data, message, false),
  );
  void queryClient.invalidateQueries({ queryKey: chatQueryKeys.directSummaries() });
  void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() });
}

/**
 * Sends the first Direct text message and reconciles only its canonical response.
 *
 * No Direct conversation row is fabricated when the first send succeeds; the
 * authoritative summary query is invalidated so the server can add it.
 *
 * @returns Mutation accepting an accepted friend id and stable client message id
 */
export function useSendDirectMessageByFriendMutation(): UseMutationResult<
  ChatMessage,
  Error,
  SendDirectMessageByFriendVariables
> {
  const queryClient = useQueryClient();
  return useMutation<ChatMessage, Error, SendDirectMessageByFriendVariables>({
    mutationFn: ({
      friendUserId,
      clientMessageId,
      content,
    }: SendDirectMessageByFriendVariables): Promise<ChatMessage> =>
      chatAPI.sendDirectMessageByFriend(friendUserId, { clientMessageId, content }),
    onSuccess: (message: ChatMessage): void => reconcileDirectMessage(queryClient, message),
    retry: false,
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Sends Direct text through an existing canonical conversation.
 *
 * @returns Mutation accepting conversation id and stable client message id
 */
export function useSendDirectMessageMutation(): UseMutationResult<ChatMessage, Error, SendDirectMessageVariables> {
  const queryClient = useQueryClient();
  return useMutation<ChatMessage, Error, SendDirectMessageVariables>({
    mutationFn: ({ conversationId, clientMessageId, content }: SendDirectMessageVariables): Promise<ChatMessage> =>
      chatAPI.sendDirectMessage(conversationId, { clientMessageId, content }),
    onSuccess: (message: ChatMessage): void => reconcileDirectMessage(queryClient, message),
    retry: false,
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Sends the first Direct image through the accepted-friend route.
 *
 * @returns Mutation accepting one local image and stable client message id
 */
export function useSendDirectImageByFriendMutation(): UseMutationResult<
  ChatMessage,
  Error,
  SendDirectImageByFriendVariables
> {
  const queryClient = useQueryClient();
  return useMutation<ChatMessage, Error, SendDirectImageByFriendVariables>({
    mutationFn: ({ friendUserId, clientMessageId, file }: SendDirectImageByFriendVariables): Promise<ChatMessage> => {
      const input: SendDirectChatImageInput = { clientMessageId, file };
      return chatAPI.sendDirectImageByFriend(friendUserId, input);
    },
    onSuccess: (message: ChatMessage): void => reconcileDirectMessage(queryClient, message),
    retry: false,
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Sends a Direct image through an existing canonical conversation.
 *
 * @returns Mutation accepting one local image and stable client message id
 */
export function useSendDirectImageMutation(): UseMutationResult<ChatMessage, Error, SendDirectImageVariables> {
  const queryClient = useQueryClient();
  return useMutation<ChatMessage, Error, SendDirectImageVariables>({
    mutationFn: ({ conversationId, clientMessageId, file }: SendDirectImageVariables): Promise<ChatMessage> => {
      const input: SendDirectChatImageInput = { clientMessageId, file };
      return chatAPI.sendDirectImage(conversationId, input);
    },
    onSuccess: (message: ChatMessage): void => reconcileDirectMessage(queryClient, message),
    retry: false,
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Advances a Direct read cursor after a foreground loaded-list check.
 *
 * @returns Mutation returning the server's committed Seen timestamp
 */
export function useMarkDirectReadMutation(): UseMutationResult<DirectChatReadResult, Error, MarkDirectReadVariables> {
  const queryClient = useQueryClient();
  return useMutation<DirectChatReadResult, Error, MarkDirectReadVariables>({
    mutationFn: ({ conversationId, throughMessageId }: MarkDirectReadVariables): Promise<DirectChatReadResult> =>
      chatAPI.markDirectRead(conversationId, { throughMessageId }),
    onSuccess: (result: DirectChatReadResult): void => {
      queryClient.setQueryData<InfiniteData<ChatConversationSummaryPage, ChatPageParam>>(
        chatQueryKeys.directSummaries(),
        (data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined) =>
          patchSummaryRead(data, result.conversationId),
      );
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.directSummaries() });
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() });
    },
    retry: false,
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/** Backwards-readable alias for the Direct first-send text mutation. */
export const useSendDirectChatMessageByFriendMutation: typeof useSendDirectMessageByFriendMutation =
  useSendDirectMessageByFriendMutation;

/** Backwards-readable alias for the existing-conversation text mutation. */
export const useSendDirectChatMessageMutation: typeof useSendDirectMessageMutation = useSendDirectMessageMutation;

/** Backwards-readable alias for the Direct read-cursor mutation. */
export const useMarkDirectChatReadMutation: typeof useMarkDirectReadMutation = useMarkDirectReadMutation;
