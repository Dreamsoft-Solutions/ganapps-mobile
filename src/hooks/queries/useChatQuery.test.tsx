import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { chatAPI } from '@/api/endpoints/chat';
import { useAuthStore } from '@/store/auth.store';
import type { ChatMessage, ChatMessagesPage, EventChatSummary, EventChatSummaryPage } from '@/types/chat.types';
import {
  chatQueryKeys,
  EVENT_CHAT_LIST_PAGE_SIZE,
  EVENT_CHAT_MESSAGE_PAGE_SIZE,
  useEventChatListQuery,
  useEventChatMessagesQuery,
} from './useChatQuery';

jest.mock('@/api/endpoints/chat', () => ({
  chatAPI: {
    listConversations: jest.fn(),
    listMessages: jest.fn(),
    resolveSession: jest.fn(),
  },
}));

const mockedChatAPI = jest.mocked(chatAPI);

function wrapperFor(client: QueryClient): ({ children }: { children: ReactNode }) => ReactElement {
  return function QueryWrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}

function summary(id: string): EventChatSummary {
  return {
    conversationId: `conversation-${id}`,
    type: 'EVENT',
    ganapId: `ganap-${id}`,
    title: `Event ${id}`,
    lastMessage: null,
    unreadCount: 0,
    canRead: true,
    canSend: true,
    updatedAt: `2026-09-0${id}T00:00:00.000Z`,
  };
}

function message(id: string, sentAt: string): ChatMessage {
  return {
    id,
    conversationId: 'conversation-1',
    senderId: 'user-1',
    senderUsername: 'Miguel Santos',
    senderDisplayPicture: null,
    content: id,
    type: 'TEXT',
    sentAt,
  };
}

afterEach((): void => {
  mockedChatAPI.listConversations.mockReset();
  mockedChatAPI.listMessages.mockReset();
  mockedChatAPI.resolveSession.mockReset();
  useAuthStore.setState({ token: null });
});

describe('chatQueryKeys', (): void => {
  it('keeps Event Chat state under stable domain-specific factories', (): void => {
    expect(chatQueryKeys.all).toEqual(['chat']);
    expect(chatQueryKeys.eventSession('g1')).toEqual(['chat', 'event-session', 'g1']);
    expect(chatQueryKeys.eventMessages('g1')).toEqual(['chat', 'event-messages', 'g1']);
    expect(chatQueryKeys.eventList()).toEqual(['chat', 'event-list']);
  });
});

describe('useEventChatListQuery', (): void => {
  it('stays idle without an authenticated token and never creates history work', async (): Promise<void> => {
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useEventChatListQuery(), { wrapper: wrapperFor(client) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedChatAPI.listConversations).not.toHaveBeenCalled();
    expect(mockedChatAPI.listMessages).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });

  it('preserves server summary order and forwards Event/cursor/limit params', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const first: EventChatSummaryPage = { items: [summary('1'), summary('2')], nextCursor: 'opaque-list-cursor' };
    mockedChatAPI.listConversations.mockResolvedValue(first);
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useEventChatListQuery(), { wrapper: wrapperFor(client) });

    await waitFor((): void => expect(result.current.isSuccess).toBe(true));
    expect(result.current.summaries).toEqual(first.items);
    expect(mockedChatAPI.listConversations).toHaveBeenCalledWith({
      type: 'EVENT',
      cursor: undefined,
      limit: EVENT_CHAT_LIST_PAGE_SIZE,
    });
    unmount();
    client.clear();
  });
});

describe('useEventChatMessagesQuery', (): void => {
  it('fetches initial history and flattens cursor pages without changing opaque cursors', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const first: ChatMessagesPage = {
      items: [message('newest', '2026-09-01T00:00:00.000Z')],
      nextCursor: 'opaque-message-cursor',
    };
    const second: ChatMessagesPage = {
      items: [message('older', '2026-08-31T00:00:00.000Z')],
      nextCursor: null,
    };
    mockedChatAPI.listMessages.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useEventChatMessagesQuery('ganap-1'), {
      wrapper: wrapperFor(client),
    });

    await waitFor((): void => expect(result.current.isSuccess).toBe(true));
    expect(result.current.messages).toEqual([...first.items]);
    expect(mockedChatAPI.listMessages).toHaveBeenCalledWith('ganap-1', {
      cursor: undefined,
      limit: EVENT_CHAT_MESSAGE_PAGE_SIZE,
    });

    await result.current.fetchNextPage();
    await waitFor((): void => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.messages).toEqual([...first.items, ...second.items]);
    expect(mockedChatAPI.listMessages).toHaveBeenNthCalledWith(2, 'ganap-1', {
      cursor: 'opaque-message-cursor',
      limit: EVENT_CHAT_MESSAGE_PAGE_SIZE,
    });
    unmount();
    client.clear();
  });

  it('does not run while the Ganap id is empty', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useEventChatMessagesQuery(''), { wrapper: wrapperFor(client) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedChatAPI.listMessages).not.toHaveBeenCalled();
    unmount();
    client.clear();
  });
});
