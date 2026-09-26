import type { QueryFunctionContext } from '@tanstack/query-core';
import {
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { type ChatMessagesParams, chatAPI, type EventChatListParams } from '@/api/endpoints/chat';
import { useAuthStore } from '@/store/auth.store';
import type {
  ChatConversationSummary,
  ChatConversationSummaryPage,
  ChatMessage,
  ChatMessagesPage,
  DirectChatSummary,
  EventChatSession,
  EventChatSummary,
  EventChatSummaryPage,
} from '@/types/chat.types';
import { isChatForbidden } from '@/utils/chat';

/** Shared page parameter type for opaque cursors and the initial undefined page. */
export type ChatPageParam = string | undefined;

/** Stable cache-key factory for all Event Chat server state. */
export const chatQueryKeys = {
  all: ['chat'] as const,
  eventSession: (ganapId: string) => [...chatQueryKeys.all, 'event-session', ganapId] as const,
  eventMessagesRoot: () => [...chatQueryKeys.all, 'event-messages'] as const,
  eventMessages: (ganapId: string) => [...chatQueryKeys.all, 'event-messages', ganapId] as const,
  directMessagesRoot: () => [...chatQueryKeys.all, 'direct-messages'] as const,
  directMessages: (conversationId: string) => [...chatQueryKeys.all, 'direct-messages', conversationId] as const,
  directSummaries: () => [...chatQueryKeys.all, 'direct-summaries'] as const,
  eventList: () => [...chatQueryKeys.all, 'event-list'] as const,
  summaries: () => [...chatQueryKeys.all, 'summaries'] as const,
};

/** Fixed page size for Event Chat summary rows. */
export const EVENT_CHAT_LIST_PAGE_SIZE = 20;

/** Fixed page size for the mixed Friends-hub summary feed. */
export const CHAT_SUMMARY_PAGE_SIZE = 20;

/** Fixed page size for Event Chat history. */
export const EVENT_CHAT_MESSAGE_PAGE_SIZE = 30;

/** Result shape for the Event Chat list query, with flattened server pages. */
export type UseEventChatListQueryResult = UseInfiniteQueryResult<
  InfiniteData<EventChatSummaryPage, ChatPageParam>,
  Error
> & {
  summaries: EventChatSummary[];
};

/** Result shape for the mixed Event/Direct summary query. */
export type UseChatSummariesQueryResult = UseInfiniteQueryResult<
  InfiniteData<ChatConversationSummaryPage, ChatPageParam>,
  Error
> & {
  summaries: ChatConversationSummary[];
  hasUnreadMessages: boolean;
};

/** Result shape for the Event Chat history query, with flattened server pages. */
export type UseEventChatMessagesQueryResult = UseInfiniteQueryResult<
  InfiniteData<ChatMessagesPage, ChatPageParam>,
  Error
> & {
  messages: ChatMessage[];
};

/** Result shape for the Direct-only summary query, with flattened server pages. */
export type UseDirectChatListQueryResult = UseInfiniteQueryResult<
  InfiniteData<ChatConversationSummaryPage, ChatPageParam>,
  Error
> & {
  summaries: DirectChatSummary[];
};

/** Result shape for the Direct Chat history query, with flattened server pages. */
export type UseDirectChatMessagesQueryResult = UseInfiniteQueryResult<
  InfiniteData<ChatMessagesPage, ChatPageParam>,
  Error
> & {
  messages: ChatMessage[];
};

/** Returns the next opaque cursor without interpreting or transforming it. */
export function getNextChatPageParam(
  page: ChatMessagesPage | EventChatSummaryPage | ChatConversationSummaryPage,
): string | undefined {
  return page.nextCursor ?? undefined;
}

/** Query defaults shared by the chat server-state hooks. */
const CHAT_QUERY_OPTIONS = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
};

/** Retry one transient request, but never retry authoritative chat access denial. */
function shouldRetryChatQuery(failureCount: number, error: Error): boolean {
  return !isChatForbidden(error) && failureCount < 1;
}

/**
 * Lists server-owned readable Event Chat summaries.
 *
 * No history query is created or prefetched for a summary row.
 *
 * @param enabled - Optional route/access guard
 * @returns Infinite list query and flattened summaries
 */
export function useEventChatListQuery(enabled = true): UseEventChatListQueryResult {
  const token: string | null = useAuthStore((state) => state.token);
  const result: UseInfiniteQueryResult<InfiniteData<EventChatSummaryPage, ChatPageParam>, Error> = useInfiniteQuery<
    EventChatSummaryPage,
    Error,
    InfiniteData<EventChatSummaryPage, ChatPageParam>,
    readonly ['chat', 'event-list'],
    ChatPageParam
  >({
    queryKey: chatQueryKeys.eventList(),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<readonly ['chat', 'event-list'], ChatPageParam>): Promise<EventChatSummaryPage> => {
      const params: EventChatListParams = {
        type: 'EVENT',
        cursor: pageParam,
        limit: EVENT_CHAT_LIST_PAGE_SIZE,
      };
      return chatAPI.listConversations(params);
    },
    initialPageParam: undefined,
    getNextPageParam: getNextChatPageParam,
    ...CHAT_QUERY_OPTIONS,
    retry: shouldRetryChatQuery,
    enabled: Boolean(token && enabled),
  });
  const summaries: EventChatSummary[] = result.data?.pages.flatMap((page: EventChatSummaryPage) => page.items) ?? [];
  return { ...result, summaries };
}

/**
 * Lists the server-owned mixed Event and Direct conversation summaries.
 *
 * No history query is created or prefetched for a summary row. The server owns
 * ordering, unread counts, latest-message previews, and read/send capabilities.
 *
 * @param enabled - Optional route/access guard
 * @returns Infinite summary query, flattened rows, and all-conversation unread state
 */
export function useChatSummariesQuery(enabled = true): UseChatSummariesQueryResult {
  const token: string | null = useAuthStore((state) => state.token);
  const result: UseInfiniteQueryResult<
    InfiniteData<ChatConversationSummaryPage, ChatPageParam>,
    Error
  > = useInfiniteQuery<
    ChatConversationSummaryPage,
    Error,
    InfiniteData<ChatConversationSummaryPage, ChatPageParam>,
    readonly ['chat', 'summaries'],
    ChatPageParam
  >({
    queryKey: chatQueryKeys.summaries(),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<readonly ['chat', 'summaries'], ChatPageParam>): Promise<ChatConversationSummaryPage> =>
      chatAPI.listAllConversations({ cursor: pageParam, limit: CHAT_SUMMARY_PAGE_SIZE }),
    initialPageParam: undefined,
    getNextPageParam: getNextChatPageParam,
    ...CHAT_QUERY_OPTIONS,
    retry: shouldRetryChatQuery,
    enabled: Boolean(token && enabled),
  });
  const summaries: ChatConversationSummary[] =
    result.data?.pages.flatMap((page: ChatConversationSummaryPage): ChatConversationSummary[] => page.items) ?? [];
  const hasUnreadMessages: boolean = result.data?.pages[0]?.hasUnreadMessages ?? false;
  return { ...result, summaries, hasUnreadMessages };
}

/** Backwards-readable alias for the Friends hub summary query. */
export const useMixedChatListQuery: typeof useChatSummariesQuery = useChatSummariesQuery;

/**
 * Resolves one Ganap's server-authoritative Event Chat session.
 *
 * @param ganapId - Ganap id, potentially empty before route params hydrate
 * @param enabled - Access/route guard
 * @returns Session query
 */
export function useEventChatSessionQuery(ganapId: string, enabled = true): UseQueryResult<EventChatSession, Error> {
  const token: string | null = useAuthStore((state) => state.token);
  return useQuery<EventChatSession, Error>({
    queryKey: chatQueryKeys.eventSession(ganapId),
    queryFn: (): Promise<EventChatSession> => chatAPI.resolveSession(ganapId),
    ...CHAT_QUERY_OPTIONS,
    retry: shouldRetryChatQuery,
    enabled: Boolean(token && ganapId && enabled),
  });
}

/**
 * Reads cursor-paginated Event Chat history in server order.
 *
 * @param ganapId - Ganap id
 * @param enabled - Session/access guard; no request occurs while false
 * @returns Infinite history query and flattened messages
 */
export function useEventChatMessagesQuery(ganapId: string, enabled = true): UseEventChatMessagesQueryResult {
  const token: string | null = useAuthStore((state) => state.token);
  const result: UseInfiniteQueryResult<InfiniteData<ChatMessagesPage, ChatPageParam>, Error> = useInfiniteQuery<
    ChatMessagesPage,
    Error,
    InfiniteData<ChatMessagesPage, ChatPageParam>,
    readonly ['chat', 'event-messages', string],
    ChatPageParam
  >({
    queryKey: chatQueryKeys.eventMessages(ganapId),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<readonly ['chat', 'event-messages', string], ChatPageParam>): Promise<ChatMessagesPage> => {
      const params: ChatMessagesParams = {
        cursor: pageParam,
        limit: EVENT_CHAT_MESSAGE_PAGE_SIZE,
      };
      return chatAPI.listMessages(ganapId, params);
    },
    initialPageParam: undefined,
    getNextPageParam: getNextChatPageParam,
    ...CHAT_QUERY_OPTIONS,
    retry: shouldRetryChatQuery,
    enabled: Boolean(token && ganapId && enabled),
  });
  const messages: ChatMessage[] = result.data?.pages.flatMap((page: ChatMessagesPage) => page.items) ?? [];
  return { ...result, messages };
}

/**
 * Lists server-owned Direct Chat summaries without loading any message history.
 *
 * @param enabled - Whether the Direct list is currently visible
 * @returns Infinite Direct summary query and flattened rows
 */
export function useDirectChatListQuery(enabled = true): UseDirectChatListQueryResult {
  const token: string | null = useAuthStore((state) => state.token);
  const result: UseInfiniteQueryResult<
    InfiniteData<ChatConversationSummaryPage, ChatPageParam>,
    Error
  > = useInfiniteQuery<
    ChatConversationSummaryPage,
    Error,
    InfiniteData<ChatConversationSummaryPage, ChatPageParam>,
    readonly ['chat', 'direct-summaries'],
    ChatPageParam
  >({
    queryKey: chatQueryKeys.directSummaries(),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<
      readonly ['chat', 'direct-summaries'],
      ChatPageParam
    >): Promise<ChatConversationSummaryPage> =>
      chatAPI.listDirectConversations({ cursor: pageParam, limit: CHAT_SUMMARY_PAGE_SIZE }),
    initialPageParam: undefined,
    getNextPageParam: getNextChatPageParam,
    ...CHAT_QUERY_OPTIONS,
    retry: shouldRetryChatQuery,
    enabled: Boolean(token && enabled),
  });
  const summaries: DirectChatSummary[] =
    result.data?.pages.flatMap((page: ChatConversationSummaryPage): DirectChatSummary[] =>
      page.items.flatMap((item: ChatConversationSummaryPage['items'][number]): DirectChatSummary[] =>
        item.type === 'DIRECT' ? [item] : [],
      ),
    ) ?? [];
  return { ...result, summaries };
}

/**
 * Reads Direct history only for a selected canonical conversation.
 *
 * @param conversationId - Canonical Direct conversation id
 * @param enabled - Selected-thread/access/focus guard
 * @returns Infinite history query and flattened messages
 */
export function useDirectChatMessagesQuery(conversationId: string, enabled = true): UseDirectChatMessagesQueryResult {
  const token: string | null = useAuthStore((state) => state.token);
  const result: UseInfiniteQueryResult<InfiniteData<ChatMessagesPage, ChatPageParam>, Error> = useInfiniteQuery<
    ChatMessagesPage,
    Error,
    InfiniteData<ChatMessagesPage, ChatPageParam>,
    readonly ['chat', 'direct-messages', string],
    ChatPageParam
  >({
    queryKey: chatQueryKeys.directMessages(conversationId),
    queryFn: ({
      pageParam,
    }: QueryFunctionContext<readonly ['chat', 'direct-messages', string], ChatPageParam>): Promise<ChatMessagesPage> =>
      chatAPI.listDirectMessages(conversationId, { cursor: pageParam, limit: EVENT_CHAT_MESSAGE_PAGE_SIZE }),
    initialPageParam: undefined,
    getNextPageParam: getNextChatPageParam,
    ...CHAT_QUERY_OPTIONS,
    retry: shouldRetryChatQuery,
    enabled: Boolean(token && conversationId && enabled),
  });
  const messages: ChatMessage[] = result.data?.pages.flatMap((page: ChatMessagesPage) => page.items) ?? [];
  return { ...result, messages };
}
