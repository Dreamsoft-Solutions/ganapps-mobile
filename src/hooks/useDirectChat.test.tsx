import { expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import type { ReactElement, ReactNode } from 'react';
import { chatAPI } from '@/api/endpoints/chat';
import { chatQueryKeys } from '@/hooks/queries/useChatQuery';
import { type ChatSocketEvent, chatSocketClient } from '@/services/chat-socket.service';
import { useAuthStore } from '@/store/auth.store';
import type { ChatMessage } from '@/types/chat.types';
import { type UseDirectChatResult, useDirectChat } from './useDirectChat';

jest.mock('@/api/endpoints/chat', (): object => ({
  chatAPI: {
    sendDirectMessageByFriend: jest.fn(),
    sendDirectMessage: jest.fn(),
    listDirectMessages: jest.fn(),
    sendDirectImageByFriend: jest.fn(),
    sendDirectImage: jest.fn(),
    markDirectRead: jest.fn(),
  },
}));
jest.mock('expo-image-picker', (): object => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@/services/chat-socket.service', (): object => ({
  chatSocketClient: {
    getConnectionState: (): string => 'idle',
    onConnectionStateChange: (): (() => void) => (): void => {},
    onModerationEvent: (): (() => void) => (): void => {},
    setBeforeJoin: (): (() => void) => (): void => {},
    setDirectFocus: (): void => {},
    subscribeDirect: jest.fn(
      (_id: string, _listener: (event: ChatSocketEvent) => void): (() => void) =>
        (): void => {},
    ),
    leaveConversation: jest.fn(),
  },
}));

it('preserves Direct retry identity, socket messages, and reused-image recovery', async (): Promise<void> => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const api = jest.mocked(chatAPI);
  const message: ChatMessage = {
    id: 'message-1',
    conversationId: 'conversation-1',
    senderId: 'user-1',
    senderUsername: 'user',
    senderDisplayPicture: null,
    content: 'Hello',
    type: 'TEXT',
    sentAt: '2026-09-10T00:00:00Z',
  };
  api.listDirectMessages.mockResolvedValue({ items: [message], nextCursor: null });
  api.sendDirectMessageByFriend.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValue(message);
  api.sendDirectImage.mockRejectedValue(Object.assign(new Error('Reused'), { errorCode: 'CLIENT_MESSAGE_ID_REUSED' }));
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///image.jpg', width: 100, height: 100, fileSize: 100, mimeType: 'image/jpeg' }],
  });
  useAuthStore.setState({ token: 'test-token', user: null });
  const hook = await renderHook(
    (): UseDirectChatResult => useDirectChat({ friendUserId: 'friend-1', canRead: false, canSend: true }),
    {
      wrapper: ({ children }: { children: ReactNode }): ReactElement => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  try {
    expect(hook.result.current.conversationId).toBeNull();
    expect(api.listDirectMessages).not.toHaveBeenCalled();
    await act(async (): Promise<void> => {
      await hook.result.current.sendMessage('Hello');
    });
    await waitFor((): void => expect(hook.result.current.failedDrafts).toHaveLength(1));
    const draftId: string = hook.result.current.failedDrafts[0].clientMessageId;
    expect(draftId).not.toBe('');
    expect(hook.result.current.failedDrafts[0]).toMatchObject({
      content: 'Hello',
      target: { type: 'friend', id: 'friend-1' },
    });
    expect(api.sendDirectMessageByFriend).toHaveBeenNthCalledWith(1, 'friend-1', {
      clientMessageId: draftId,
      content: 'Hello',
    });
    expect(hook.result.current.conversationId).toBeNull();
    expect(api.listDirectMessages).not.toHaveBeenCalled();
    await act(async (): Promise<void> => {
      await hook.result.current.retryDraft(draftId);
    });
    expect(api.sendDirectMessageByFriend).toHaveBeenNthCalledWith(2, 'friend-1', {
      clientMessageId: draftId,
      content: 'Hello',
    });
    expect(api.sendDirectMessage).not.toHaveBeenCalled();
    await waitFor((): void => expect(hook.result.current.conversationId).toBe('conversation-1'));
    await waitFor((): void => expect(hook.result.current.messages).toEqual([message]));
    expect(hook.result.current.canRead).toBe(true);
    expect(hook.result.current.failedDrafts).toHaveLength(0);
    expect(chatSocketClient.subscribeDirect).toHaveBeenCalledWith('conversation-1', expect.any(Function));
    const listener: (event: ChatSocketEvent) => void = jest.mocked(chatSocketClient.subscribeDirect).mock.calls[0][1];
    const incoming: ChatMessage = {
      ...message,
      id: 'message-2',
      senderId: 'friend-1',
      content: 'Socket message',
      sentAt: '2026-09-10T00:01:00Z',
    };
    await act(async (): Promise<void> => {
      listener({ type: 'message', message: incoming });
    });
    await waitFor((): void =>
      expect(hook.result.current.messages).toEqual(expect.arrayContaining([incoming, message])),
    );
    expect(hook.result.current.messages).toHaveLength(2);
    expect(client.getQueryData(chatQueryKeys.directMessages('conversation-1'))).toMatchObject({
      pages: [{ items: expect.arrayContaining([incoming, message]) }],
    });
    await act(async (): Promise<void> => {
      await hook.result.current.pickImage();
    });
    await waitFor((): void => expect(hook.result.current.imageDraft?.status).toBe('ready'));
    const imageDraft = hook.result.current.imageDraft;
    const recoveredMessage: ChatMessage = {
      ...message,
      id: 'message-recovered',
      content: 'Recovered from server',
      sentAt: '2026-09-10T00:02:00Z',
    };
    api.listDirectMessages.mockResolvedValue({ items: [recoveredMessage, incoming, message], nextCursor: null });
    await act(async (): Promise<void> => {
      await hook.result.current.sendImage();
    });
    expect(api.sendDirectImage).toHaveBeenCalledWith('conversation-1', {
      clientMessageId: imageDraft?.clientMessageId,
      file: imageDraft?.asset,
    });
    await waitFor((): void => expect(hook.result.current.imageDraft).toBeNull());
    expect(hook.result.current.imagePickerError?.message).toBe('This image could not be sent. Choose it again.');
    await waitFor((): void => expect(hook.result.current.messages).toEqual([recoveredMessage, incoming, message]));
  } finally {
    await hook.unmount();
    client.clear();
    useAuthStore.setState({ token: null, user: null });
    jest.clearAllMocks();
  }
});
