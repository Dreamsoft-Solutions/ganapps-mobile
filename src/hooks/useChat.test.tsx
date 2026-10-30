import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, type RenderHookResult, renderHook, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ReactElement, ReactNode } from 'react';
import { chatAPI } from '@/api/endpoints/chat';
import type { ChatSocketEvent } from '@/services/chat-socket.service';
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
    sendImage: jest.fn(),
    markRead: jest.fn(),
  },
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('@/services/chat-socket.service', () => ({
  chatSocketClient: {
    getConnectionState: jest.fn(() => 'idle'),
    onConnectionStateChange: jest.fn(() => (): void => {}),
    onModerationEvent: jest.fn(() => (): void => {}),
    setBeforeJoin: jest.fn(() => (): void => {}),
    subscribe: jest.fn(
      (_conversationId: string, _ganapId: string, listener: (event: ChatSocketEvent) => void): (() => void) => {
        mockChatSocketListener = listener;
        return (): void => {
          if (mockChatSocketListener === listener) mockChatSocketListener = undefined;
        };
      },
    ),
    leaveConversation: jest.fn(),
  },
}));

let mockChatSocketListener: ((event: ChatSocketEvent) => void) | undefined;

const mockedChatAPI = jest.mocked(chatAPI);
const mockedRequestMediaLibraryPermissionsAsync = jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync);
const mockedLaunchImageLibraryAsync = jest.mocked(ImagePicker.launchImageLibraryAsync);

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

const pickerAsset: ImagePicker.ImagePickerAsset = {
  uri: 'file:///valid-jpeg-under-5m.jpg',
  width: 1600,
  height: 1200,
  type: 'image',
  fileName: 'valid-jpeg-under-5m.jpg',
  fileSize: 1024,
  mimeType: 'image/jpeg',
};

const canonicalImageMessage: ChatMessage = {
  id: 'canonical-image-1',
  conversationId: 'conversation-1',
  senderId: 'user-1',
  senderUsername: 'Miguel Santos',
  senderDisplayPicture: null,
  content: null,
  type: 'IMAGE',
  sentAt: '2026-09-01T00:00:00.000Z',
  media: {
    id: 'media-1',
    url: 'https://api.example.test/secure-assets/chat/media-1?exp=1&sig=signed',
    mimeType: 'image/webp',
    bytes: 4096,
    width: 1600,
    height: 1200,
  },
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
  mockChatSocketListener = undefined;
  mockedChatAPI.sendImage.mockReset();
  mockedRequestMediaLibraryPermissionsAsync.mockResolvedValue({
    status: 'granted' as ImagePicker.MediaLibraryPermissionResponse['status'],
    expires: 'never',
    granted: true,
    canAskAgain: true,
  });
  mockedLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
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
  mockChatSocketListener = undefined;
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

describe('useChat send permission', (): void => {
  const readOnlySession: EventChatSession = { ...session, capability: 'READ_ONLY', canSend: false };

  function sendRefused(): Error {
    return Object.assign(new Error('You can read this chat but cannot send messages'), {
      status: 403,
      errorCode: 'FORBIDDEN',
    });
  }

  it('turns read-only when the server refuses a text message', async (): Promise<void> => {
    mockedChatAPI.sendMessage.mockRejectedValue(sendRefused());
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useChat('ganap-1'), { wrapper: wrapperFor(client) });
    await waitFor((): void => expect(result.current.session).toEqual(session));
    mockedChatAPI.resolveSession.mockResolvedValue(readOnlySession);

    await act(async (): Promise<void> => {
      await result.current.sendMessage('hello');
    });

    await waitFor((): void => expect(result.current.isReadOnly).toBe(true));
    expect(result.current.accessLost).toBe(false);
    expect(result.current.failedDrafts).toEqual([]);
    await unmount();
    client.clear();
  });

  it('turns read-only when the server refuses an image', async (): Promise<void> => {
    mockedLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [pickerAsset] });
    mockedChatAPI.sendImage.mockRejectedValue(sendRefused());
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useChat('ganap-1'), { wrapper: wrapperFor(client) });
    await waitFor((): void => expect(result.current.session).toEqual(session));
    await act(async (): Promise<void> => {
      await result.current.pickImage();
    });
    mockedChatAPI.resolveSession.mockResolvedValue(readOnlySession);

    await act(async (): Promise<void> => {
      await result.current.sendImage();
    });

    await waitFor((): void => expect(result.current.isReadOnly).toBe(true));
    expect(result.current.accessLost).toBe(false);
    await unmount();
    client.clear();
  });

  it('checks send permission again when the chat is reopened', async (): Promise<void> => {
    const client: QueryClient = makeClient();
    const first = await renderHook(() => useChat('ganap-1'), { wrapper: wrapperFor(client) });
    await waitFor((): void => expect(first.result.current.session).toEqual(session));
    await first.unmount();
    mockedChatAPI.resolveSession.mockResolvedValue(readOnlySession);

    const reopened = await renderHook(() => useChat('ganap-1'), { wrapper: wrapperFor(client) });

    await waitFor((): void => expect(reopened.result.current.isReadOnly).toBe(true));
    expect(mockedChatAPI.resolveSession).toHaveBeenCalledTimes(2);
    await reopened.unmount();
    client.clear();
  });
});

describe('useChat image drafts', (): void => {
  async function renderImageChat(): Promise<{
    result: RenderHookResult<ReturnType<typeof useChat>, unknown>['result'];
    unmount: () => Promise<void>;
    client: QueryClient;
  }> {
    const client: QueryClient = makeClient();
    const rendered = await renderHook(() => useChat('ganap-1'), { wrapper: wrapperFor(client) });
    await waitFor((): void => expect(rendered.result.current.session).toEqual(session));
    return { result: rendered.result, unmount: rendered.unmount, client };
  }

  it('keeps WebP eligible locally, configures one library image, and removes it without sending', async (): Promise<void> => {
    const webpAsset: ImagePicker.ImagePickerAsset = {
      ...pickerAsset,
      fileName: 'candidate.webp',
      mimeType: 'image/webp',
    };
    mockedLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [webpAsset] });
    const { result, unmount, client } = await renderImageChat();

    await act(async (): Promise<void> => {
      await result.current.pickImage();
    });

    expect(mockedLaunchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        selectionLimit: 1,
        allowsEditing: false,
      }),
    );
    expect(result.current.imageDraft).toMatchObject({ status: 'ready', asset: { mimeType: 'image/webp' } });
    await act(async (): Promise<void> => {
      result.current.removeImage();
    });
    expect(result.current.imageDraft).toBeNull();
    expect(mockedChatAPI.sendImage).not.toHaveBeenCalled();
    await unmount();
    client.clear();
  });

  it('enters Checking image only after Send image and reconciles the canonical response without an optimistic message', async (): Promise<void> => {
    let resolveImage: ((message: ChatMessage) => void) | undefined;
    mockedLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [pickerAsset] });
    mockedChatAPI.sendImage.mockImplementation(
      async (): Promise<ChatMessage> =>
        new Promise<ChatMessage>((resolve): void => {
          resolveImage = resolve;
        }),
    );
    const { result, unmount, client } = await renderImageChat();

    await act(async (): Promise<void> => {
      await result.current.pickImage();
    });
    expect(result.current.imageDraft?.status).toBe('ready');
    let sendPromise: Promise<void> | undefined;
    await act(async (): Promise<void> => {
      sendPromise = result.current.sendImage();
    });
    await waitFor((): void => expect(result.current.imageDraft?.status).toBe('checking'));
    await waitFor((): void => expect(resolveImage).toBeDefined());
    expect(result.current.messages).toEqual([]);
    expect(mockedChatAPI.sendImage).toHaveBeenCalledWith(
      'ganap-1',
      expect.objectContaining({ clientMessageId: result.current.imageDraft?.clientMessageId }),
    );

    await act(async (): Promise<void> => {
      resolveImage?.(canonicalImageMessage);
      await sendPromise;
    });
    expect(result.current.imageDraft).toBeNull();
    expect(result.current.messages).toEqual([canonicalImageMessage]);
    await unmount();
    client.clear();
  });

  it('retains a retryable image draft and reuses its client id for one explicit retry', async (): Promise<void> => {
    const networkError: Error & { errorCode: string } = Object.assign(new Error('offline'), {
      errorCode: 'NETWORK_ERROR',
    });
    mockedLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [pickerAsset] });
    mockedChatAPI.sendImage.mockRejectedValueOnce(networkError).mockResolvedValueOnce(canonicalImageMessage);
    const { result, unmount, client } = await renderImageChat();

    await act(async (): Promise<void> => {
      await result.current.pickImage();
    });
    await waitFor((): void => expect(result.current.imageDraft?.status).toBe('ready'));
    await act(async (): Promise<void> => {
      await result.current.sendImage();
    });
    const clientMessageId: string | undefined = result.current.imageDraft?.clientMessageId;
    expect(result.current.imageDraft?.status).toBe('retryable-failure');
    expect(clientMessageId).toBeTruthy();

    await act(async (): Promise<void> => {
      await result.current.retryImage();
    });
    expect(mockedChatAPI.sendImage).toHaveBeenNthCalledWith(2, 'ganap-1', expect.objectContaining({ clientMessageId }));
    expect(result.current.imageDraft).toBeNull();
    await unmount();
    client.clear();
  });

  it('gates a capacity retry until the server-provided delay elapses', async (): Promise<void> => {
    const capacityError: Error & { errorCode: string; retryAfterSeconds: number } = Object.assign(new Error('busy'), {
      errorCode: 'MEDIA_CAPACITY_EXCEEDED',
      retryAfterSeconds: 30,
    });
    mockedLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [pickerAsset] });
    mockedChatAPI.sendImage.mockRejectedValue(capacityError);
    const { result, unmount, client } = await renderImageChat();

    await act(async (): Promise<void> => {
      await result.current.pickImage();
    });
    await waitFor((): void => expect(result.current.imageDraft?.status).toBe('ready'));
    await act(async (): Promise<void> => {
      await result.current.sendImage();
    });
    expect(result.current.imageDraft?.status).toBe('retryable-failure');
    expect(result.current.imageRetryAfterSeconds).toBeGreaterThan(0);

    await act(async (): Promise<void> => {
      await result.current.retryImage();
    });
    expect(mockedChatAPI.sendImage).toHaveBeenCalledTimes(1);
    await unmount();
    client.clear();
  });

  it('rejects known oversized picker input before upload and keeps permanent server failures non-retryable', async (): Promise<void> => {
    mockedLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ ...pickerAsset, fileSize: 5 * 1024 * 1024 + 1 }],
    });
    const { result, unmount, client } = await renderImageChat();
    await act(async (): Promise<void> => {
      await result.current.pickImage();
    });
    expect(result.current.imagePickerError?.message).toBe('Choose a JPEG, PNG, or WebP image under 5 MiB.');
    expect(result.current.imageDraft).toBeNull();
    expect(mockedChatAPI.sendImage).not.toHaveBeenCalled();

    mockedLaunchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [pickerAsset] });
    const malformedError: Error & { errorCode: string } = Object.assign(new Error('malformed'), {
      errorCode: 'IMAGE_MALFORMED',
    });
    mockedChatAPI.sendImage.mockRejectedValue(malformedError);
    await act(async (): Promise<void> => {
      await result.current.pickImage();
    });
    await waitFor((): void => expect(result.current.imageDraft?.status).toBe('ready'));
    await act(async (): Promise<void> => {
      await result.current.sendImage();
    });
    expect(result.current.imageDraft?.status).toBe('permanent-failure');
    await act(async (): Promise<void> => {
      await result.current.retryImage();
    });
    expect(mockedChatAPI.sendImage).toHaveBeenCalledTimes(1);
    await act(async (): Promise<void> => {
      result.current.removeImage();
    });
    expect(result.current.imageDraft).toBeNull();
    await unmount();
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

describe('useChat inbound socket reconciliation', (): void => {
  it('retains the server reaction summary on a newly delivered message when engagement is enabled', async (): Promise<void> => {
    const reactionSummary = {
      total: 1,
      counts: [
        { type: 'HEART' as const, count: 1 },
        { type: 'LAUGH' as const, count: 0 },
        { type: 'THUMBS_UP' as const, count: 0 },
        { type: 'SAD' as const, count: 0 },
        { type: 'ANGRY' as const, count: 0 },
      ],
      myReaction: null,
    };
    const incoming: ChatMessage = {
      ...message('socket-message-1', '2026-09-01T00:00:00.000Z'),
      reactionSummary,
    };
    const client: QueryClient = makeClient();
    const { result, unmount } = await renderHook(() => useChat('ganap-1'), { wrapper: wrapperFor(client) });
    await waitFor((): void => expect(result.current.session).toEqual(session));
    await waitFor((): void => expect(mockChatSocketListener).toBeDefined());

    await act(async (): Promise<void> => {
      mockChatSocketListener?.({ type: 'message', message: incoming });
    });

    await waitFor((): void => expect(result.current.messages).toEqual([incoming]));
    expect(result.current.messages[0]?.reactionSummary).toEqual(reactionSummary);
    unmount();
    client.clear();
  });
});
