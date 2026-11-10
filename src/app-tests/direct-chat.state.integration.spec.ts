/** @vitest-environment happy-dom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { createElement, type ReactElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { axiosInstance } from '@/api/axios-instance';
import DirectChatThreadScreen from '@/app/(app)/(chat)/direct-chat/[conversation-id]';
import type { DirectChatThreadViewProps } from '@/components/chat/DirectChatThreadView';
import { Routes } from '@/constants/routes';
import type { ChatConnectionState } from '@/services/chat-socket.service';
import { useAuthStore } from '@/store/auth.store';
import type { ChatMessage } from '@/types/chat.types';
import type { DirectChatSummary } from '@/types/direct-chat.types';

const runtime = vi.hoisted(() => ({
  params: {},
  connection: 'connected' as ChatConnectionState,
  listeners: new Set<(state: ChatConnectionState) => void>(),
  router: { canDismiss: (): boolean => true, dismiss: vi.fn() },
  displayed: [] as string[],
}));

vi.mock('expo-router', () => ({
  useRouter: () => runtime.router,
  useLocalSearchParams: () => runtime.params,
  useFocusEffect: useEffect,
}));
vi.mock('expo-secure-store', () => ({}));
vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-file-system', () => ({}));
vi.mock('expo-image-manipulator', () => ({}));
vi.mock('@/components/moderation/ModerationActionSheet', () => ({ ModerationActionSheet: () => null }));
vi.mock('@/services/chat-socket.service', () => ({
  chatSocketClient: {
    getConnectionState: () => runtime.connection,
    onConnectionStateChange: (listener: (state: ChatConnectionState) => void) => {
      runtime.listeners.add(listener);
      return () => runtime.listeners.delete(listener);
    },
    onModerationEvent: () => () => {},
    setBeforeJoin: () => () => {},
    subscribeDirect: () => () => {},
    setDirectFocus: () => {},
  },
}));

vi.mock('@/components/chat/DirectChatThreadView', () => ({
  DirectChatThreadView: (props: DirectChatThreadViewProps): ReactElement => {
    const status = props.accessLost
      ? 'Unavailable'
      : props.messages.length > 0
        ? props.messages.map((message) => message.content).join(', ')
        : props.isLoading
          ? 'Loading'
          : (props.error?.message ?? 'No messages yet');
    runtime.displayed.push(status);
    return createElement(
      'div',
      null,
      createElement('output', null, status),
      createElement('span', null, props.connectionState),
      createElement('button', { type: 'button', onClick: () => void props.onSend('New message') }, 'Send'),
      createElement('button', { type: 'button', onClick: props.onBack }, 'Back'),
    );
  },
}));

const friend = { userId: 'friend-1', username: 'friend', displayName: 'Friend', displayPicture: null };
const summary: DirectChatSummary = {
  conversationId: 'thread-1',
  type: 'DIRECT',
  friend,
  canRead: true,
  canSend: true,
  unreadCount: 0,
  lastMessage: null,
  latestOutgoingSeenAt: null,
  updatedAt: '2026-11-06T01:00:00Z',
};

function message(id: string, content: string, sentAt: string): ChatMessage {
  return {
    id,
    conversationId: summary.conversationId,
    content,
    sentAt,
    senderId: friend.userId,
    senderUsername: friend.username,
    senderDisplayPicture: null,
    type: 'TEXT',
  };
}

const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
const originalAdapter: typeof axiosInstance.defaults.adapter = axiosInstance.defaults.adapter;

afterEach(() => {
  client.clear();
  axiosInstance.defaults.adapter = originalAdapter;
  useAuthStore.setState({ token: null });
  runtime.connection = 'connected';
  runtime.displayed.length = 0;
  runtime.router.dismiss.mockReset();
});

function connect(state: ChatConnectionState): void {
  runtime.connection = state;
  for (const listener of runtime.listeners) listener(state);
}

it('loads retained Direct Chat history on profile entry, after a send and reopen, and on reconnect', async () => {
  useAuthStore.setState({ token: 'integration-token' });
  const href = Routes.directChatForFriend(friend);
  if (typeof href === 'string') throw new Error('Expected a Direct Chat route with friend parameters');
  runtime.params = href.params ?? {};

  const initial = message('1', 'Previous message', '2026-11-06T01:00:00Z');
  const sent = { ...message('2', 'New message', '2026-11-06T01:01:00Z'), senderId: 'viewer', senderUsername: 'viewer' };
  const offscreen = message('3', 'Message while away', '2026-11-06T01:02:00Z');
  const missed = message('4', 'Message during disconnect', '2026-11-06T01:03:00Z');
  const history = [initial];
  const requests: string[] = [];
  const firstHistory = Promise.withResolvers<void>();
  axiosInstance.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const request = `${config.method} ${config.url}`;
    requests.push(request);
    let data: unknown;
    switch (request) {
      case 'get /chat/conversations':
        expect(config.params.type).toBe('DIRECT');
        data = config.params.cursor
          ? { items: [summary], nextCursor: null }
          : {
              items: [{ ...summary, conversationId: 'other-thread', friend: { ...friend, userId: 'other-friend' } }],
              nextCursor: 'next-page',
            };
        break;
      case 'get /direct/conversations/thread-1/messages':
        await firstHistory.promise;
        data = { items: [...history], nextCursor: null };
        break;
      case 'post /direct/conversations/thread-1/messages':
        expect(JSON.parse(config.data).content).toBe('New message');
        history.unshift(sent);
        data = sent;
        break;
      case 'post /direct/conversations/thread-1/read':
        data = { conversationId: 'thread-1', throughMessageId: JSON.parse(config.data).throughMessageId };
        break;
      default:
        throw new Error(`Unexpected request: ${request}`);
    }
    return {
      config,
      data: { success: true, statusCode: 200, data, message: 'OK' },
      status: 200,
      statusText: 'OK',
      headers: {},
    };
  };

  const container = document.createElement('div');
  const root = createRoot(container);
  const open = (): void =>
    root.render(createElement(QueryClientProvider, { client }, createElement(DirectChatThreadScreen)));
  runtime.router.dismiss.mockImplementation(() => root.render(null));

  try {
    open();
    await vi.waitFor(() => expect(container.querySelector('output')?.textContent).toBe('Loading'));
    firstHistory.resolve();
    await vi.waitFor(() => expect(container.querySelector('output')?.textContent).toBe('Previous message'));
    expect(requests).toContain('get /direct/conversations/thread-1/messages');
    expect(requests).not.toContain('post /direct/conversations/thread-1/messages');

    container.querySelectorAll('button')[0]?.click();
    await vi.waitFor(() =>
      expect(container.querySelector('output')?.textContent).toBe('New message, Previous message'),
    );
    container.querySelectorAll('button')[1]?.click();
    await vi.waitFor(() => expect(container.querySelector('output')).toBeNull());

    history.unshift(offscreen);
    open();
    await vi.waitFor(() =>
      expect(container.querySelector('output')?.textContent).toBe('Message while away, New message, Previous message'),
    );

    connect('reconnecting');
    await vi.waitFor(() => expect(container.textContent).toContain('reconnecting'));
    expect(container.textContent).toContain('Message while away, New message, Previous message');
    history.unshift(missed);
    connect('connected');
    await vi.waitFor(() =>
      expect(container.querySelector('output')?.textContent).toBe(
        'Message during disconnect, Message while away, New message, Previous message',
      ),
    );
    expect(runtime.displayed).not.toContain('No messages yet');
  } finally {
    firstHistory.resolve();
    root.unmount();
  }
});
