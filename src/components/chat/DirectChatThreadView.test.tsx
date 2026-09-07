import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View as MockView } from 'react-native';
import type { DirectFailedDraft } from '@/hooks/useDirectChat';
import type { ChatMessage } from '@/types/chat.types';
import type { DirectChatFriendSummary, DirectChatSession } from '@/types/direct-chat.types';
import { DirectChatThreadView } from './DirectChatThreadView';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  ImagePlus: (): null => null,
  MoreVertical: (): null => null,
  Send: (): null => null,
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
});
