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
const nativeFormData: typeof FormData = globalThis.FormData;

class TestFormData {
  readonly fields: Map<string, unknown> = new Map<string, unknown>();

  append(name: string, value: unknown): void {
    this.fields.set(name, value);
  }
}

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

const imageMessage: ChatMessage = {
  ...message,
  id: 'image-message-1',
  content: null,
  type: 'IMAGE',
  media: {
    id: 'media-1',
    url: 'https://api.example.test/secure-assets/chat/media-1?exp=1&sig=signed',
    mimeType: 'image/webp',
    bytes: 4096,
    width: 1600,
    height: 1200,
  },
};

beforeEach((): void => {
  captured = [];
});

afterEach((): void => {
  axiosInstance.defaults.adapter = undefined;
  jest.restoreAllMocks();
  Object.defineProperty(globalThis, 'FormData', { configurable: true, value: nativeFormData, writable: true });
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

  it('sends exactly one multipart file and stable client id while preserving native boundaries', async (): Promise<void> => {
    Object.defineProperty(globalThis, 'FormData', { configurable: true, value: TestFormData, writable: true });
    const post = jest.spyOn(axiosInstance, 'post').mockResolvedValue({
      data: imageMessage,
      status: 201,
      statusText: 'Created',
      headers: {},
      config: {} as AxiosResponse['config'],
    });
    const file = {
      uri: 'file:///chat-image.jpg',
      name: 'chat-image.jpg',
      mimeType: 'image/jpeg',
    };

    await expect(chatAPI.sendImage('ganap-1', { clientMessageId: 'client-image-1', file })).resolves.toEqual(
      imageMessage,
    );

    expect(post).toHaveBeenCalledTimes(1);
    const call: readonly [string, unknown, AxiosRequestConfig?] = post.mock.calls[0] as unknown as readonly [
      string,
      unknown,
      AxiosRequestConfig?,
    ];
    expect(call[0]).toBe('/ganaps/ganap-1/chat/messages');
    const formData: TestFormData = call[1] as TestFormData;
    expect(formData.fields.get('clientMessageId')).toBe('client-image-1');
    expect(formData.fields.get('file')).toEqual({ uri: file.uri, name: file.name, type: file.mimeType });
    expect(formData.fields.size).toBe(2);
    const config: AxiosRequestConfig | undefined = call[2];
    const headers: Record<string, unknown> | undefined = config?.headers as unknown as
      | Record<string, unknown>
      | undefined;
    expect(headers?.['Content-Type']).toBeUndefined();
    expect(config?.transformRequest).toHaveLength(1);
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
