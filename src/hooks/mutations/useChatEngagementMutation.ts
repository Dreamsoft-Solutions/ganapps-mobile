import {
  type InfiniteData,
  QueryClient,
  QueryClientContext,
  type UseMutationResult,
  useMutation,
} from '@tanstack/react-query';
import { useContext } from 'react';
import {
  type AnnouncementReactionResponse,
  chatEngagementAPI,
  type UnsentMessageResponse,
} from '@/api/endpoints/chat-engagement';
import { type ChatPageParam, chatQueryKeys } from '@/hooks/queries/useChatQuery';
import { type AnnouncementPage } from '@/hooks/queries/useGanapAnnouncementsQuery';
import { ganapQueryKeys } from '@/hooks/queries/useGanapsQuery';
import type {
  ChatConversationSummaryPage,
  ChatMessage,
  ChatMessagesPage,
  EventChatSummaryPage,
  ReactionAggregate,
  ReactionSummary,
  ReactionType,
} from '@/types/chat.types';
import { patchAnnouncementPages, patchMessageInPages, replaceMessageWithUnsent } from '@/utils/chat-engagement';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';

const STANDALONE_ENGAGEMENT_QUERY_CLIENT: QueryClient = new QueryClient();

function useEngagementQueryClient(): QueryClient {
  return useContext(QueryClientContext) ?? STANDALONE_ENGAGEMENT_QUERY_CLIENT;
}

/** Variables for setting or removing one message reaction. */
export interface MessageReactionVariables {
  conversationId: string;
  messageId: string;
  reaction: ReactionType | null;
}

/** Variables for setting or removing one announcement acknowledgement. */
export interface AnnouncementReactionVariables {
  ganapId: string;
  announcementId: string;
  reaction: ReactionType | null;
}

/** Variables for sender-only message unsend. */
export interface UnsendMessageVariables {
  conversationId: string;
  messageId: string;
}

function patchReactionInMessageCaches(
  queryClient: QueryClient,
  variables: MessageReactionVariables,
  summary: ReactionSummary,
): void {
  const patch = (
    data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined,
  ): InfiniteData<ChatMessagesPage, ChatPageParam> | undefined =>
    patchMessageInPages(
      data,
      variables.conversationId,
      variables.messageId,
      (message: ChatMessage): ChatMessage => ({
        ...message,
        reactionSummary: summary,
      }),
    );
  queryClient.setQueriesData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
    { queryKey: chatQueryKeys.eventMessagesRoot() },
    patch,
  );
  queryClient.setQueriesData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
    { queryKey: chatQueryKeys.directMessagesRoot() },
    patch,
  );
}

function toReactionSummary(aggregate: ReactionAggregate): ReactionSummary {
  return {
    ...aggregate,
    total: aggregate.counts.reduce((total: number, entry): number => total + entry.count, 0),
  };
}

function patchUnsentInMessageCaches(queryClient: QueryClient, tombstone: UnsentMessageResponse): void {
  const patch = (
    data: InfiniteData<ChatMessagesPage, ChatPageParam> | undefined,
  ): InfiniteData<ChatMessagesPage, ChatPageParam> | undefined => replaceMessageWithUnsent(data, tombstone);
  queryClient.setQueriesData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
    { queryKey: chatQueryKeys.eventMessagesRoot() },
    patch,
  );
  queryClient.setQueriesData<InfiniteData<ChatMessagesPage, ChatPageParam>>(
    { queryKey: chatQueryKeys.directMessagesRoot() },
    patch,
  );
}

function patchEventSummaryForUnsend(
  data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined,
  tombstone: UnsentMessageResponse,
): InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: EventChatSummaryPage): EventChatSummaryPage => ({
        ...page,
        items: page.items.map((summary) =>
          summary.lastMessage?.id === tombstone.id
            ? {
                ...summary,
                lastMessage: {
                  id: tombstone.id,
                  type: 'UNSENT',
                  preview: 'Message unsent',
                  sentAt: tombstone.sentAt,
                },
              }
            : summary,
        ),
      }),
    ),
  };
}

function patchConversationSummaryForUnsend(
  data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined,
  tombstone: UnsentMessageResponse,
): InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map(
      (page: ChatConversationSummaryPage): ChatConversationSummaryPage => ({
        ...page,
        items: page.items.map((summary) =>
          summary.lastMessage?.id === tombstone.id
            ? {
                ...summary,
                lastMessage: {
                  id: tombstone.id,
                  type: 'UNSENT',
                  preview: 'Message unsent',
                  sentAt: tombstone.sentAt,
                },
              }
            : summary,
        ),
      }),
    ),
  };
}

function patchAnnouncementReaction(
  queryClient: QueryClient,
  variables: AnnouncementReactionVariables,
  response: ReactionSummary,
): void {
  queryClient.setQueryData<InfiniteData<AnnouncementPage, number>>(
    ganapQueryKeys.announcements(variables.ganapId),
    (data: InfiniteData<AnnouncementPage, number> | undefined) =>
      patchAnnouncementPages(data, variables.announcementId, response),
  );
}

/** Sets or removes a message reaction with server-owned aggregate reconciliation. */
export function useMessageReactionMutation(): UseMutationResult<ReactionSummary, Error, MessageReactionVariables> {
  const queryClient: QueryClient = useEngagementQueryClient();
  return useMutation<ReactionSummary, Error, MessageReactionVariables>(
    {
      mutationFn: async (variables: MessageReactionVariables): Promise<ReactionSummary> => {
        const aggregate: ReactionAggregate = variables.reaction
          ? await chatEngagementAPI.setMessageReaction(variables.conversationId, variables.messageId, {
              reaction: variables.reaction,
            })
          : await chatEngagementAPI.deleteMessageReaction(variables.conversationId, variables.messageId);
        return toReactionSummary(aggregate);
      },
      onSuccess: (summary: ReactionSummary, variables: MessageReactionVariables): void =>
        patchReactionInMessageCaches(queryClient, variables, summary),
      retry: false,
      meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
    },
    queryClient,
  );
}

/** Sets or removes an attendee announcement acknowledgement. */
export function useAnnouncementReactionMutation(): UseMutationResult<
  AnnouncementReactionResponse,
  Error,
  AnnouncementReactionVariables
> {
  const queryClient: QueryClient = useEngagementQueryClient();
  return useMutation<AnnouncementReactionResponse, Error, AnnouncementReactionVariables>(
    {
      mutationFn: (variables: AnnouncementReactionVariables): Promise<AnnouncementReactionResponse> =>
        variables.reaction
          ? chatEngagementAPI.setAnnouncementReaction(variables.ganapId, variables.announcementId, {
              reaction: variables.reaction,
            })
          : chatEngagementAPI.deleteAnnouncementReaction(variables.ganapId, variables.announcementId),
      onSuccess: (response: AnnouncementReactionResponse, variables: AnnouncementReactionVariables): void => {
        const summary: ReactionSummary = {
          ...response,
          total: response.counts.reduce((total: number, entry): number => total + entry.count, 0),
        };
        patchAnnouncementReaction(queryClient, variables, summary);
      },
      retry: false,
      meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
    },
    queryClient,
  );
}

/** Un-sends a message and reconciles the durable public tombstone everywhere it is cached. */
export function useUnsendMessageMutation(): UseMutationResult<UnsentMessageResponse, Error, UnsendMessageVariables> {
  const queryClient: QueryClient = useEngagementQueryClient();
  return useMutation<UnsentMessageResponse, Error, UnsendMessageVariables>(
    {
      mutationFn: (variables: UnsendMessageVariables): Promise<UnsentMessageResponse> =>
        chatEngagementAPI.unsendMessage(variables.conversationId, variables.messageId),
      onSuccess: (tombstone: UnsentMessageResponse): void => {
        patchUnsentInMessageCaches(queryClient, tombstone);
        queryClient.setQueriesData<InfiniteData<EventChatSummaryPage, ChatPageParam>>(
          { queryKey: chatQueryKeys.eventList() },
          (data: InfiniteData<EventChatSummaryPage, ChatPageParam> | undefined) =>
            patchEventSummaryForUnsend(data, tombstone),
        );
        queryClient.setQueriesData<InfiniteData<ChatConversationSummaryPage, ChatPageParam>>(
          { queryKey: chatQueryKeys.summaries() },
          (data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined) =>
            patchConversationSummaryForUnsend(data, tombstone),
        );
        queryClient.setQueriesData<InfiniteData<ChatConversationSummaryPage, ChatPageParam>>(
          { queryKey: chatQueryKeys.directSummaries() },
          (data: InfiniteData<ChatConversationSummaryPage, ChatPageParam> | undefined) =>
            patchConversationSummaryForUnsend(data, tombstone),
        );
      },
      retry: false,
      meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
    },
    queryClient,
  );
}
