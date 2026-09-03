import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View as MockView } from 'react-native';
import type { FailedDraft } from '@/hooks/useChat';
import type { ChatImageDraft, ChatMessage, EventChatSession } from '@/types/chat.types';
import { EventChatThreadView } from './EventChatThreadView';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  MoreVertical: (): null => null,
  Send: (): null => null,
}));

jest.mock('expo-image', () => ({
  Image: (): ReactElement => <MockView testID="avatar-image" />,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' => 'light',
}));

const readOnlySession: EventChatSession = {
  conversationId: 'conversation-1',
  ganapId: 'ganap-1',
  type: 'EVENT',
  capability: 'READ_ONLY',
  canRead: true,
  canSend: false,
  isBusinessOnly: false,
  ganapStatus: 'COMPLETED',
};

const message: ChatMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  senderId: 'user-1',
  senderUsername: 'Miguel Santos',
  senderDisplayPicture: null,
  content: 'Welcome to the event.',
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

const imageDraft: ChatImageDraft = {
  clientMessageId: 'client-image-1',
  asset: {
    uri: 'file:///chat-image.jpg',
    name: 'chat-image.jpg',
    mimeType: 'image/jpeg',
    fileSize: 4096,
    width: 1600,
    height: 1200,
  },
  status: 'ready',
};

function props(
  overrides: Partial<Parameters<typeof EventChatThreadView>[0]> = {},
): Parameters<typeof EventChatThreadView>[0] {
  return {
    session: readOnlySession,
    messages: [message],
    failedDrafts: [],
    isLoading: false,
    error: null,
    isSending: false,
    isMarkingRead: false,
    connectionState: 'connected',
    hasNextPage: false,
    isFetchingNextPage: false,
    onBack: jest.fn<() => void>(),
    onRetry: jest.fn<() => void>(),
    onLoadMore: jest.fn<() => void>(),
    onSend: jest.fn<(content: string) => void>(),
    onRetryDraft: jest.fn<(clientMessageId: string) => void>(),
    onDiscardDraft: jest.fn<(clientMessageId: string) => void>(),
    accessLost: false,
    ...overrides,
  };
}

describe('EventChatThreadView', (): void => {
  it('shows the exact read-only copy without an enabled composer or Seen UI', async (): Promise<void> => {
    const screen = await render(<EventChatThreadView {...props()} />);

    expect(screen.getByText('You can read this chat, but you cannot send messages.')).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
    expect(screen.queryByText('Seen')).toBeNull();
    screen.unmount();
  });

  it('keeps failed sends explicit with Retry message and Discard message actions', async (): Promise<void> => {
    const onRetryDraft = jest.fn<(clientMessageId: string) => void>();
    const onDiscardDraft = jest.fn<(clientMessageId: string) => void>();
    const draft: FailedDraft = { clientMessageId: 'client-1', content: 'Try this again', error: new Error('offline') };
    const screen = await render(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
          failedDrafts: [draft],
          onRetryDraft,
          onDiscardDraft,
        })}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Retry message'));
    await fireEvent.press(screen.getByLabelText('Discard message'));
    expect(onRetryDraft).toHaveBeenCalledWith('client-1');
    expect(onDiscardDraft).toHaveBeenCalledWith('client-1');
    screen.unmount();
  });

  it('exposes the one-image preview actions and exact Checking image state', async (): Promise<void> => {
    const onPickImage = jest.fn<() => void>();
    const onRemoveImage = jest.fn<() => void>();
    const onSendImage = jest.fn<() => void>();
    const screen = await render(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
          imageDraft,
          onPickImage,
          onRemoveImage,
          onSendImage,
        })}
      />,
    );

    expect(screen.getByText('Ready to send')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Send image'));
    await fireEvent.press(screen.getByLabelText('Remove image'));
    expect(onSendImage).toHaveBeenCalledTimes(1);
    expect(onRemoveImage).toHaveBeenCalledTimes(1);

    await screen.rerender(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
          imageDraft: { ...imageDraft, status: 'checking' },
          onPickImage,
          onRemoveImage,
          onSendImage,
        })}
      />,
    );
    expect(screen.getByText('Checking image…')).toBeTruthy();
    expect(screen.queryByLabelText('Remove image')).toBeNull();
    screen.unmount();
  });

  it('renders canonical Photo dimensions and keeps moderation actions reachable', async (): Promise<void> => {
    const screen = await render(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
          messages: [imageMessage],
        })}
      />,
    );

    expect(screen.getByLabelText('Photo sent by Miguel Santos, 1600 by 1200 pixels')).toBeTruthy();
    expect(screen.getByLabelText('Message actions for Miguel Santos')).toBeTruthy();
    screen.unmount();
  });
});
