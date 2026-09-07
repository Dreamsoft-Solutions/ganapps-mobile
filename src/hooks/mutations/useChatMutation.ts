import { type InfiniteData, type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatAPI, type SendChatImageInput } from '@/api/endpoints/chat';
import type {
  ChatImageAsset,
  ChatMessage,
  ChatMessagesPage,
  ChatReadResult,
  EventChatSummary,
  EventChatSummaryPage,
} from '@/types/chat.types';
import { compareChatMessagePositions, getChatMessagePreview, upsertChatMessage } from '@/utils/chat';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';
import { type ChatPageParam, chatQueryKeys } from '../queries/useChatQuery';

/** Variables accepted by the idempotent Event Chat send mutation. */
export interface SendChatMessageVariables {
  ganapId: string;
  clientMessageId: string;
  content: string;
}

/** Variables accepted by the Event Chat multipart image mutation. */
export interface SendChatImageVariables {
  ganapId: string;
  clientMessageId: string;
  file: ChatImageAsset;
}

/** Variables accepted by the Event Chat read-cursor mutation. */
export interface MarkChatReadVariables {
  ganapId: string;
  throughMessageId: string;
}

function patchMessagePages(
  data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined,
  message: ChatMessage,
): InfiniteData<ChatMessagesPage, ChatPageParam> | undefined {
  if (!data || data.pages.length === 0) return data;
  const [firstPage, ...restPages]: ChatMessagesPage[] = data.pages;
  const nextFirstPage: ChatMessagesPage = {
    ...firstPage,
    items: upsertChatMessage(firstPage.items, message),
  };
  return {
    ...data,
    pages: [
      nextFirstPage,
      ...restPages.map(
        (page: ChatMessagesPage): ChatMessagesPage => ({
          ...page,
          items: page.items.filter((item: ChatMessage): boolean => item.id !== message.id),
        }),
      ),
    ],
  };
}

function patchSummaryPages(
  data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined,
  ganapId: string,
  message: ChatMessage,
): InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: EventChatSummaryPage): EventChatSummaryPage => ({
        ...page,
        items: page.items.map(
          (summary: EventChatSummary): EventChatSummary =>
            summary.ganapId === ganapId &&
            (!summary.lastMessage || compareChatMessagePositions(message, summary.lastMessage) > 0)
              ? {
                  ...summary,
                  lastMessage: {
                    id: message.id,
                    type: message.type,
                    preview: getChatMessagePreview(message),
                    sentAt: message.sentAt,
                  },
                  updatedAt: message.sentAt,
                }
              : summary,
        ),
      }),
    ),
  };
}

/**
 * Sends Event Chat text through REST and reconciles the canonical response into
 * the active history and list caches.
 *
 * @returns Mutation accepting Ganap id, stable client id, and content
 */
export function useSendChatMessageMutation(): UseMutationResult<ChatMessage, Error, SendChatMessageVariables> {
  const queryClient = useQueryClient();
  return useMutation<ChatMessage, Error, SendChatMessageVariables>({
    mutationFn: ({ ganapId, clientMessageId, content }: SendChatMessageVariables): Promise<ChatMessage> =>
      chatAPI.sendMessage(ganapId, { clientMessageId, content }),
    onSuccess: (message: ChatMessage, { ganapId }: SendChatMessageVariables): void => {
      queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
        chatQueryKeys.eventMessages(ganapId),
        (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) => patchMessagePages(data, message),
      );
      queryClient.setQueryData<InfiniteData<EventChatSummaryPage, ChatPageParam>>(
        chatQueryKeys.eventList(),
        (data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined) =>
          patchSummaryPages(data, ganapId, message),
      );
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList() });
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() });
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Sends one Event Chat image and reconciles only the canonical server response.
 *
 * No optimistic image message is inserted: the server owns moderation, media
 * dimensions, and the short-lived signed URL.
 *
 * @returns Mutation accepting Ganap id, stable client id, and one local image
 */
export function useSendChatImageMutation(): UseMutationResult<ChatMessage, Error, SendChatImageVariables> {
  const queryClient = useQueryClient();
  return useMutation<ChatMessage, Error, SendChatImageVariables>({
    mutationFn: ({ ganapId, clientMessageId, file }: SendChatImageVariables): Promise<ChatMessage> => {
      const input: SendChatImageInput = { clientMessageId, file };
      return chatAPI.sendImage(ganapId, input);
    },
    onSuccess: (message: ChatMessage, { ganapId }: SendChatImageVariables): void => {
      queryClient.setQueryData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
        chatQueryKeys.eventMessages(ganapId),
        (data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined) => patchMessagePages(data, message),
      );
      queryClient.setQueryData<InfiniteData<EventChatSummaryPage, ChatPageParam>>(
        chatQueryKeys.eventList(),
        (data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined) =>
          patchSummaryPages(data, ganapId, message),
      );
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList() });
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() });
    },
    retry: false,
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Marks an Event Chat read cursor through REST and refreshes list unread state.
 *
 * @returns Mutation accepting Ganap id and greatest loaded message id
 */
export function useMarkChatReadMutation(): UseMutationResult<ChatReadResult, Error, MarkChatReadVariables> {
  const queryClient = useQueryClient();
  return useMutation<ChatReadResult, Error, MarkChatReadVariables>({
    mutationFn: ({ ganapId, throughMessageId }: MarkChatReadVariables): Promise<ChatReadResult> =>
      chatAPI.markRead(ganapId, { throughMessageId }),
    onSuccess: (result: ChatReadResult): void => {
      queryClient.setQueryData<InfiniteData<EventChatSummaryPage, ChatPageParam>>(
        chatQueryKeys.eventList(),
        (data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined) => {
          if (!data) return data;
          return {
            ...data,
            pages: data.pages.map(
              (page: EventChatSummaryPage): EventChatSummaryPage => ({
                ...page,
                items: page.items.map(
                  (summary: EventChatSummary): EventChatSummary =>
                    summary.conversationId === result.conversationId ? { ...summary, unreadCount: 0 } : summary,
                ),
              }),
            ),
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.eventList() });
      void queryClient.invalidateQueries({ queryKey: chatQueryKeys.summaries() });
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}
