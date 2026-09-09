import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { chatAPI } from '@/api/endpoints/chat';
import { useAuthStore } from '@/store/auth.store';
import type { ChatMessage, ChatMessagesPage, EventChatSession } from '@/types/chat.types';
import { useChat } from './useChat';

jest.mock('@/api/endpoints/chat', () => ({
  chatAPI: {
    getSocketTicket: jest.fn(),
    listConversations: jest.fn(),
    listMessages: jest.fn(),
    resolveSession: jest.fn(),
    sendMessage: jest.fn(),
    markRead: jest.fn(),
  },
}));

jest.mock('@/services/chat-socket.service', () => ({
  chatSocketClient: {
    getConnectionState: jest.fn(() => 'idle'),
    onConnectionStateChange: jest.fn(() => (): void => {}),
    onModerationEvent: jest.fn(() => (): void => {}),
    setBeforeJoin: jest.fn(() => (): void => {}),
    subscribe: jest.fn(() => (): void => {}),
    leaveConversation: jest.fn(),
  },
}));

const mockedChatAPI = jest.mocked(chatAPI);

const session: EventChatSession = {
  conversationId: 'conversation-1',
  ganapId: 'ganap-1',
  type: 'EVENT',
  capability: 'READ_WRITE',
  canRead: true,
  canSend: true,
  isBusinessOnly: false,
  ganapStatus: 'ONGOING',
};

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

function wrapperFor(client: QueryClient): ({ children }: { children: ReactNode }) => ReactElement {
  return function QueryWrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
}

beforeEach((): void => {
  useAuthStore.setState({ token: 'access-token', user: null });
  mockedChatAPI.resolveSession.mockResolvedValue(session);
  mockedChatAPI.listMessages.mockResolvedValue({ items: [], nextCursor: null });
  mockedChatAPI.markRead.mockResolvedValue({
    conversationId: session.conversationId,
    throughMessageId: 'message-newest',
    readAt: '2026-09-01T00:00:00.000Z',
    readCount: 1,
  });
});

afterEach((): void => {
  jest.clearAllMocks();
  useAuthStore.setState({ token: null, user: null });
});

describe('useChat failed drafts', (): void => {
  it('keeps a network failure as an explicit draft and retries with the same client id', async (): Promise<void> => {
    mockedChatAPI.sendMessage
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce(message('client-canonical-id', '2026-09-01T00:00:00.000Z'));
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useChat('ganap-1'), { wrapper: wrapperFor(client) });
    await waitFor((): void => expect(result.current.session).toEqual(session));

    await act(async (): Promise<void> => {
      await result.current.sendMessage('hello');
    });
    expect(result.current.failedDrafts).toHaveLength(1);
    const failedId: string = result.current.failedDrafts[0].clientMessageId;
    expect(result.current.failedDrafts[0].content).toBe('hello');

    await act(async (): Promise<void> => {
      await result.current.retryDraft(failedId);
    });
    expect(mockedChatAPI.sendMessage).toHaveBeenNthCalledWith(2, 'ganap-1', {
      clientMessageId: failedId,
      content: 'hello',
    });
    expect(result.current.failedDrafts).toEqual([]);
    unmount();
    client.clear();
  });

  it('discards a failed draft without touching the API', async (): Promise<void> => {
    mockedChatAPI.sendMessage.mockRejectedValue(new Error('Network Error'));
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useChat('ganap-1'), { wrapper: wrapperFor(client) });
    await waitFor((): void => expect(result.current.session).toEqual(session));
    await act(async (): Promise<void> => {
      await result.current.sendMessage('discard me');
    });
    const failedId: string = result.current.failedDrafts[0].clientMessageId;
    await act(async (): Promise<void> => {
      result.current.discardDraft(failedId);
    });
    expect(result.current.failedDrafts).toEqual([]);
    expect(mockedChatAPI.sendMessage).toHaveBeenCalledTimes(1);
    unmount();
    client.clear();
  });
});

describe('useChat read behavior', (): void => {
  it('marks only the greatest loaded message and never renders Seen copy', async (): Promise<void> => {
    const newest: ChatMessage = message('message-newest', '2026-09-01T00:00:00.000Z');
    const older: ChatMessage = message('message-older', '2026-08-31T00:00:00.000Z');
    const first: ChatMessagesPage = { items: [newest], nextCursor: 'opaque-cursor' };
    const second: ChatMessagesPage = { items: [older], nextCursor: null };
    mockedChatAPI.listMessages.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useChat('ganap-1'), { wrapper: wrapperFor(client) });
    await waitFor((): void => expect(result.current?.messages).toEqual([newest]));
    await waitFor(() =>
      expect(mockedChatAPI.markRead).toHaveBeenCalledWith('ganap-1', { throughMessageId: newest.id }),
    );

    await act(async (): Promise<void> => {
      await result.current.loadMore();
    });
    await waitFor((): void => expect(result.current?.messages).toEqual([newest, older]));
    expect(mockedChatAPI.markRead).toHaveBeenCalledTimes(1);
    expect(result.current.messages.join(' ')).not.toContain('Seen');
    unmount();
    client.clear();
  });
});
