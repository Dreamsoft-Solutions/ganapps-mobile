import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { chatAPI } from '@/api/endpoints/chat';
import { useAuthStore } from '@/store/auth.store';
import type { ChatMessage } from '@/types/chat.types';
import {
  buildChatSocketUrl,
  ChatSocketClient,
  type ChatSocketFactory,
  type ChatSocketLike,
  chatSocketClient,
} from './chat-socket.service';

jest.mock('@/api/endpoints/chat', () => ({
  chatAPI: { getSocketTicket: jest.fn() },
}));

const mockedGetSocketTicket = jest.mocked(chatAPI.getSocketTicket);

type Listener = (...args: unknown[]) => void;

interface FakeSocket extends ChatSocketLike {
  fire: (event: string, value?: unknown) => void;
}

function makeSocket(): FakeSocket {
  const listeners = new Map<string, Set<Listener>>();
  const socket = {
    auth: null,
    connected: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn().mockReturnValue(true),
    on: jest.fn((event: string, listener: Listener): FakeSocket => {
      const eventListeners: Set<Listener> = listeners.get(event) ?? new Set<Listener>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
      return socket;
    }),
    off: jest.fn((event: string, listener?: Listener): FakeSocket => {
      if (!listener) listeners.delete(event);
      else listeners.get(event)?.delete(listener);
      return socket;
    }),
    removeAllListeners: jest.fn((): FakeSocket => {
      listeners.clear();
      return socket;
    }),
    fire: (event: string, value?: unknown): void => {
      listeners.get(event)?.forEach((listener: Listener): void => {
        if (value === undefined) listener();
        else listener(value);
      });
    },
  } as unknown as FakeSocket;
  return socket;
}

function message(id: string): ChatMessage {
  return {
    id,
    conversationId: 'conversation-1',
    senderId: 'user-1',
    senderUsername: 'Miguel Santos',
    senderDisplayPicture: null,
    content: id,
    type: 'TEXT',
    sentAt: '2026-09-01T00:00:00.000Z',
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach((): void => {
  useAuthStore.setState({ token: 'access-token' });
  mockedGetSocketTicket.mockResolvedValue({ ticket: 'ticket-1', expiresIn: 60 });
});

afterEach((): void => {
  jest.useRealTimers();
  mockedGetSocketTicket.mockReset();
  useAuthStore.setState({ token: null });
  chatSocketClient.teardown();
});

describe('buildChatSocketUrl', (): void => {
  it('uses the REST origin while keeping the Socket.IO namespace at /chat', (): void => {
    expect(buildChatSocketUrl('https://api.example.test/api/v1')).toBe('https://api.example.test/chat');
    expect(buildChatSocketUrl('http://10.0.2.2:3000/api/v1/')).toBe('http://10.0.2.2:3000/chat');
  });
});

describe('ChatSocketClient', (): void => {
  it('shares one connection and one room join across two focused listeners', async (): Promise<void> => {
    const socket: FakeSocket = makeSocket();
    const factory: jest.MockedFunction<ChatSocketFactory> = jest.fn((): ChatSocketLike => socket);
    const client: ChatSocketClient = new ChatSocketClient(factory);
    const firstListener = jest.fn();
    const secondListener = jest.fn();

    client.subscribe('conversation-1', 'ganap-1', firstListener);
    await flushPromises();
    socket.connected = true;
    socket.fire('connect');
    client.subscribe('conversation-1', 'ganap-1', secondListener);

    expect(factory).toHaveBeenCalledTimes(1);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('chat:join', { ganapId: 'ganap-1' });
  });

  it('deduplicates duplicate socket messages and removes listeners on teardown', async (): Promise<void> => {
    const socket: FakeSocket = makeSocket();
    const factory: jest.MockedFunction<ChatSocketFactory> = jest.fn((): ChatSocketLike => socket);
    const client: ChatSocketClient = new ChatSocketClient(factory);
    const listener = jest.fn();
    client.subscribe('conversation-1', 'ganap-1', listener);
    await flushPromises();
    socket.connected = true;
    socket.fire('connect');

    socket.fire('chat:message:new', message('message-1'));
    socket.fire('chat:message:new', message('message-1'));
    expect(listener).toHaveBeenCalledTimes(1);

    client.teardown();
    socket.fire('chat:message:new', message('message-2'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('gets a fresh ticket after expiry and rejoins rooms after reconnect', async (): Promise<void> => {
    jest.useFakeTimers();
    const socket: FakeSocket = makeSocket();
    const factory: jest.MockedFunction<ChatSocketFactory> = jest.fn((): ChatSocketLike => socket);
    const client: ChatSocketClient = new ChatSocketClient(factory);
    client.subscribe('conversation-1', 'ganap-1', jest.fn());
    await flushPromises();
    socket.connected = true;
    socket.fire('connect');
    expect(mockedGetSocketTicket).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60_001);
    socket.connected = false;
    socket.fire('disconnect', 'transport close');
    jest.advanceTimersByTime(500);
    await flushPromises();

    expect(mockedGetSocketTicket).toHaveBeenCalledTimes(2);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    socket.connected = true;
    socket.fire('connect');
    expect(socket.emit).toHaveBeenLastCalledWith('chat:join', { ganapId: 'ganap-1' });
  });

  it('exposes the process-wide singleton used by aggregate hooks', (): void => {
    expect(chatSocketClient).toBeInstanceOf(ChatSocketClient);
  });
});
