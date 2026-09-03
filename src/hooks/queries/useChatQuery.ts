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
  ChatMessage,
  ChatMessagesPage,
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
  eventList: () => [...chatQueryKeys.all, 'event-list'] as const,
};

/** Fixed page size for Event Chat summary rows. */
export const EVENT_CHAT_LIST_PAGE_SIZE = 20;

/** Fixed page size for Event Chat history. */
export const EVENT_CHAT_MESSAGE_PAGE_SIZE = 30;

/** Result shape for the Event Chat list query, with flattened server pages. */
export type UseEventChatListQueryResult = UseInfiniteQueryResult<
  InfiniteData<EventChatSummaryPage, ChatPageParam>,
  Error
> & {
  summaries: EventChatSummary[];
};

/** Result shape for the Event Chat history query, with flattened server pages. */
export type UseEventChatMessagesQueryResult = UseInfiniteQueryResult<
  InfiniteData<ChatMessagesPage, ChatPageParam>,
  Error
> & {
  messages: ChatMessage[];
};

/** Returns the next opaque cursor without interpreting or transforming it. */
export function getNextChatPageParam(page: ChatMessagesPage | EventChatSummaryPage): string | undefined {
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
