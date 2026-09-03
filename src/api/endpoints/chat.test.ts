import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axios from 'axios';
import type {
  ChatMessage,
  ChatMessagesPage,
  ChatReadResult,
  EventChatSession,
  EventChatSummaryPage,
} from '@/types/chat.types';
import axiosInstance from '../axios-instance';
import { chatAPI } from './chat';

let captured: AxiosRequestConfig[] = [];

function envelopeAdapter(payload: unknown): (config: AxiosRequestConfig) => Promise<AxiosResponse> {
  return async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    captured.push(config);
    return {
      data: { success: true, statusCode: 200, data: payload, message: 'Success' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: config as AxiosResponse['config'],
    };
  };
}

function requestedUrl(config: AxiosRequestConfig): string {
  return `${config.baseURL ?? ''}${config.url ?? ''}`;
}

const summaryPage: EventChatSummaryPage = {
  items: [
    {
      conversationId: 'conversation-1',
      type: 'EVENT',
      ganapId: 'ganap-1',
      title: 'Foundation Week',
      lastMessage: { id: 'message-1', type: 'TEXT', preview: 'Welcome', sentAt: '2026-09-01T00:00:00.000Z' },
      unreadCount: 2,
      canRead: true,
      canSend: true,
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  nextCursor: 'opaque-list-cursor',
};

const message: ChatMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  senderId: 'user-1',
  senderUsername: 'Miguel Santos',
  senderDisplayPicture: null,
  content: 'Welcome',
  type: 'TEXT',
  sentAt: '2026-09-01T00:00:00.000Z',
};

beforeEach((): void => {
  captured = [];
});

afterEach((): void => {
  axiosInstance.defaults.adapter = undefined;
});

describe('chatAPI', (): void => {
  it('requests a socket ticket without an access token in the URL or body', async (): Promise<void> => {
    axiosInstance.defaults.adapter = envelopeAdapter({ ticket: 'short-lived-ticket', expiresIn: 60 });

    await expect(chatAPI.getSocketTicket()).resolves.toEqual({ ticket: 'short-lived-ticket', expiresIn: 60 });
    expect(captured[0].method).toBe('post');
    expect(requestedUrl(captured[0])).toContain('/api/v1/chat/socket-ticket');
    expect(captured[0].data).toBeUndefined();
    expect(requestedUrl(captured[0])).not.toContain('token');
  });

  it('lists Event Chat summaries with the opaque cursor and limit', async (): Promise<void> => {
    axiosInstance.defaults.adapter = envelopeAdapter(summaryPage);

    await expect(chatAPI.listConversations({ cursor: 'opaque-list-cursor', limit: 20 })).resolves.toEqual(summaryPage);
    expect(requestedUrl(captured[0])).toContain('/api/v1/chat/conversations');
    expect(captured[0].params).toEqual({ type: 'EVENT', cursor: 'opaque-list-cursor', limit: 20 });
  });

  it('resolves a Ganap session and reads history through typed paths', async (): Promise<void> => {
    const session: EventChatSession = {
      conversationId: 'conversation-1',
      ganapId: 'ganap-1',
      type: 'EVENT',
      capability: 'READ_ONLY',
      canRead: true,
      canSend: false,
      isBusinessOnly: false,
      ganapStatus: 'COMPLETED',
    };
    const history: ChatMessagesPage = { items: [message], nextCursor: 'opaque-message-cursor' };
    axiosInstance.defaults.adapter = envelopeAdapter(session);
    await expect(chatAPI.resolveSession('ganap-1')).resolves.toEqual(session);
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/ganap-1/chat');

    captured = [];
    axiosInstance.defaults.adapter = envelopeAdapter(history);
    await expect(chatAPI.listMessages('ganap-1', { cursor: 'opaque-message-cursor', limit: 30 })).resolves.toEqual(
      history,
    );
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/ganap-1/chat/messages');
    expect(captured[0].params).toEqual({ cursor: 'opaque-message-cursor', limit: 30 });
  });

  it('sends the stable idempotency body and marks the read cursor', async (): Promise<void> => {
    axiosInstance.defaults.adapter = envelopeAdapter(message);
    await expect(chatAPI.sendMessage('ganap-1', { clientMessageId: 'client-1', content: 'Welcome' })).resolves.toEqual(
      message,
    );
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/ganap-1/chat/messages');
    expect(JSON.parse(String(captured[0].data))).toEqual({ clientMessageId: 'client-1', content: 'Welcome' });

    const read: ChatReadResult = {
      conversationId: 'conversation-1',
      throughMessageId: 'message-1',
      readAt: '2026-09-01T00:00:00.000Z',
      readCount: 1,
    };
    captured = [];
    axiosInstance.defaults.adapter = envelopeAdapter(read);
    await expect(chatAPI.markRead('ganap-1', { throughMessageId: 'message-1' })).resolves.toEqual(read);
    expect(requestedUrl(captured[0])).toContain('/api/v1/ganaps/ganap-1/chat/read');
    expect(JSON.parse(String(captured[0].data))).toEqual({ throughMessageId: 'message-1' });
  });

  it('preserves a typed forbidden result instead of turning it into a network retry', async (): Promise<void> => {
    axiosInstance.defaults.adapter = async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
      throw new axios.AxiosError('Forbidden', 'ERR_BAD_REQUEST', config as never, undefined, {
        data: { success: false, statusCode: 403, errorCode: 'FORBIDDEN', message: 'Chat unavailable' },
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config: config as AxiosResponse['config'],
      });
    };

    await expect(chatAPI.resolveSession('ganap-1')).rejects.toMatchObject({ status: 403, errorCode: 'FORBIDDEN' });
  });
});
