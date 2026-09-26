import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View as MockView } from 'react-native';
import type { TestInstance, TestNode } from 'test-renderer';
import type { DirectFailedDraft } from '@/hooks/useDirectChat';
import type { ChatMessage } from '@/types/chat.types';
import type { DirectChatFriendSummary, DirectChatSession } from '@/types/direct-chat.types';
import { DirectChatThreadView } from './DirectChatThreadView';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  ImagePlus: (): null => null,
  MoreVertical: (): null => null,
  Send: (): null => null,
  X: (): null => null,
}));

jest.mock('expo-image', () => ({
  Image: (): ReactElement => <MockView testID="chat-image" />,
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

jest.mock('@/store/toast.store', () => ({
  showToast: jest.fn(),
}));

const session: DirectChatSession = {
  conversationId: 'conversation-1',
  friendUserId: 'friend-1',
  friend: null,
  canRead: true,
  canSend: true,
};

const friend: DirectChatFriendSummary = {
  userId: 'friend-1',
  username: 'miguel',
  displayName: 'Miguel Santos',
  displayPicture: null,
};

const message: ChatMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  senderId: 'friend-1',
  senderUsername: 'miguel',
  senderDisplayPicture: null,
  content: 'Hello from Direct Chat.',
  type: 'TEXT',
  sentAt: '2026-09-07T00:00:00.000Z',
};

function localTimestamp(year: number, month: number, day: number, hour: number, minute: number): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

function dateLabel(sentAt: string): string {
  return new Date(sentAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function textContent(instance: TestInstance): string {
  return instance.children
    .map((child: TestNode): string => (typeof child === 'string' ? child : textContent(child)))
    .join('');
}

function props(
  overrides: Partial<Parameters<typeof DirectChatThreadView>[0]> = {},
): Parameters<typeof DirectChatThreadView>[0] {
  const failedDrafts: DirectFailedDraft[] = [];
  return {
    session,
    friend,
    currentUserId: 'current-user',
    messages: [message],
    failedDrafts,
    latestOutgoingSeenAt: null,
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

describe('DirectChatThreadView', (): void => {
  it('places date labels before newer rows at a paginated day boundary', async (): Promise<void> => {
    const newer: ChatMessage = {
      ...message,
      id: 'newer',
      content: 'Newer direct message',
      sentAt: localTimestamp(2026, 9, 2, 0, 30),
    };
    const older: ChatMessage = {
      ...message,
      id: 'older',
      content: 'Older direct message',
      sentAt: localTimestamp(2026, 9, 1, 23, 30),
    };
    const screen = await render(<DirectChatThreadView {...props({ messages: [newer], hasNextPage: true })} />);
    expect(screen.getByText(dateLabel(newer.sentAt))).toBeTruthy();
    await screen.rerender(<DirectChatThreadView {...props({ messages: [newer, older], hasNextPage: true })} />);
    const renderedTexts: string[] = screen.container
      .queryAll((instance: TestInstance): boolean => instance.type === 'Text')
      .map((instance: TestInstance): string => textContent(instance));
    const newerIndex: number = renderedTexts.indexOf(newer.content ?? '');
    const separatorIndex: number = renderedTexts.indexOf(dateLabel(newer.sentAt));
    const olderIndex: number = renderedTexts.indexOf(older.content ?? '');

    expect(newerIndex).toBeGreaterThanOrEqual(0);
    expect(separatorIndex).toBeLessThan(newerIndex);
    expect(olderIndex).toBeGreaterThan(separatorIndex);
    expect(screen.getByText('Load older messages')).toBeTruthy();
    screen.unmount();
  });

  it('keeps reactions out of message rows while preserving the shared action entry point', async (): Promise<void> => {
    const onMessageActions = jest.fn<(selected: ChatMessage) => void>();
    const screen = await render(<DirectChatThreadView {...props({ onMessageActions })} />);

    expect(screen.queryByLabelText('React with heart')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Message actions for miguel'));
    expect(onMessageActions).toHaveBeenCalledWith(message);
    screen.unmount();
  });

  it('keeps the one-image picker in the composer row with an accessible icon action', async (): Promise<void> => {
    const onPickImage = jest.fn<() => void>();
    const screen = await render(<DirectChatThreadView {...props({ onPickImage })} />);

    await fireEvent.press(screen.getByLabelText('Add image'));
    expect(onPickImage).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('gives a selected image precedence over text and removes it from the thumbnail X', async (): Promise<void> => {
    const onSend = jest.fn<(content: string) => void>();
    const onSendImage = jest.fn<() => void>();
    const onRemoveImage = jest.fn<() => void>();
    const imageDraft: NonNullable<Parameters<typeof DirectChatThreadView>[0]['imageDraft']> = {
      clientMessageId: 'client-image-1',
      asset: {
        uri: 'file:///chat-image.jpg',
        name: 'chat-image.jpg',
        mimeType: 'image/jpeg',
        width: 1600,
        height: 1200,
      },
      status: 'ready',
    };
    const screen = await render(
      <DirectChatThreadView {...props({ imageDraft, onSend, onSendImage, onRemoveImage })} />,
    );

    const input = screen.getByLabelText('Message');
    await fireEvent.changeText(input, 'Keep this text');
    await fireEvent.press(screen.getByLabelText('Send image'));
    await fireEvent.press(screen.getByLabelText('Remove image'));

    expect(onSendImage).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(onRemoveImage).toHaveBeenCalledTimes(1);
    expect(input.props.value).toBe('Keep this text');
    expect(screen.getByLabelText('Remove image').props.hitSlop).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
    expect(screen.queryByText('Ready to send')).toBeNull();
    screen.unmount();
  });
});
