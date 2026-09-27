import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { DeviceEventEmitter, type KeyboardEvent, View as MockView } from 'react-native';
import type { TestInstance, TestNode } from 'test-renderer';
import { Spacing } from '@/constants/theme';
import type { DirectFailedDraft } from '@/hooks/useDirectChat';
import type { ChatMessage, ReactionSummary, ReactionType } from '@/types/chat.types';
import type { DirectChatFriendSummary, DirectChatSession } from '@/types/direct-chat.types';
import { DirectChatThreadView } from './DirectChatThreadView';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  ImagePlus: (): null => null,
  Plus: (): null => null,
  Send: (): null => null,
  X: (): null => null,
}));

jest.mock('expo-image', () => ({
  Image: (): ReactElement => <MockView testID="chat-image" />,
}));

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react') as typeof import('react');

  function MockModal({ visible, children }: { visible: boolean; children: ReactNode }): ReactElement | null {
    return visible ? React.createElement(React.Fragment, null, children) : null;
  }

  return { __esModule: true, default: MockModal };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 0,
    bottom: 40,
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

const keyboardEvent: KeyboardEvent = {
  duration: 0,
  easing: 'keyboard',
  endCoordinates: { screenX: 0, screenY: 0, width: 0, height: 0 },
};

const reactionSummary: ReactionSummary = {
  counts: [{ type: 'HEART', count: 2 }],
  myReaction: 'HEART',
  total: 2,
};

const reactedMessage: ChatMessage = { ...message, reactionSummary };
const secondReactedMessage: ChatMessage = { ...reactedMessage, id: 'message-2', content: 'Another message' };
const unsentMessage: ChatMessage = {
  ...message,
  content: null,
  type: 'UNSENT',
  unsentAt: '2026-09-07T00:01:00.000Z',
  reactionSummary: null,
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

  it('keeps an empty message state upright by disabling list inversion until messages exist', async (): Promise<void> => {
    const screen = await render(<DirectChatThreadView {...props({ messages: [] })} />);

    expect(screen.getByTestId('direct-chat-messages').props.inverted).toBe(false);
    expect(screen.getByText('No messages yet. Start the conversation.').parent?.props.style).toBeUndefined();
    screen.unmount();
  });

  it('opens message actions on long press and offers a reaction picker for an unreactioned message', async (): Promise<void> => {
    const onMessageActions = jest.fn<(selected: ChatMessage) => void>();
    const onMessageReaction = jest.fn<(selected: ChatMessage, reaction: ReactionType | null) => void>();
    const screen = await render(<DirectChatThreadView {...props({ onMessageActions, onMessageReaction })} />);
    const messageTarget = screen.getByLabelText('Hello from Direct Chat. from miguel');

    expect(screen.queryByLabelText('React with heart')).toBeNull();
    expect(screen.queryByLabelText('Message actions for miguel')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Add reaction'));
    expect(screen.getByLabelText('Choose a message reaction')).toBeTruthy();
    expect(screen.getByLabelText('React with heart')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dismiss reactions'));
    await fireEvent(messageTarget, 'longPress');
    expect(onMessageActions).toHaveBeenCalledWith(message);
    expect(screen.queryByLabelText('Choose a message reaction')).toBeNull();
    screen.unmount();
  });

  it('shows overlapping reaction badges and opens the floating picker from Add reaction', async (): Promise<void> => {
    const onMessageActions = jest.fn<(selected: ChatMessage) => void>();
    const onMessageReaction = jest.fn<(selected: ChatMessage, reaction: ReactionType | null) => void>();
    const screen = await render(
      <DirectChatThreadView {...props({ messages: [reactedMessage], onMessageActions, onMessageReaction })} />,
    );
    const messageTarget = screen.getByLabelText('Hello from Direct Chat. from miguel');

    expect(screen.getByLabelText('Remove heart reaction')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByLabelText('React with angry face')).toBeNull();
    expect(screen.getByLabelText('Message reactions').props.style).toMatchObject({
      position: 'absolute',
      bottom: 0,
      left: 0,
    });
    await fireEvent.press(screen.getByLabelText('Add reaction'));
    expect(screen.getByLabelText('Choose a message reaction')).toBeTruthy();
    expect(screen.getByLabelText('React with angry face')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dismiss reactions'));
    expect(screen.queryByLabelText('Choose a message reaction')).toBeNull();

    await fireEvent.press(screen.getByLabelText('Add reaction'));
    await fireEvent.press(screen.getByLabelText('React with laughing face'));
    expect(onMessageReaction).toHaveBeenCalledWith(reactedMessage, 'LAUGH');
    expect(screen.queryByLabelText('Choose a message reaction')).toBeNull();
    await fireEvent(messageTarget, 'longPress');
    expect(onMessageActions).toHaveBeenCalledWith(reactedMessage);
    screen.unmount();
  });

  it('disables every reaction control during a pending mutation but marks only its message busy', async (): Promise<void> => {
    const onMessageReaction = jest.fn<(selected: ChatMessage, reaction: ReactionType | null) => void>();
    const screen = await render(
      <DirectChatThreadView
        {...props({
          messages: [reactedMessage, secondReactedMessage],
          onMessageReaction,
          reactionPendingMessageId: secondReactedMessage.id,
        })}
      />,
    );
    const reactionControls = screen.getAllByLabelText('Remove heart reaction');
    const activeControl = reactionControls.find((control) => control.props.accessibilityState?.busy === true);
    const blockedControl = reactionControls.find((control) => control.props.accessibilityState?.busy !== true);

    expect(activeControl?.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(blockedControl?.props.accessibilityState).toMatchObject({ disabled: true, busy: false });
    const addReactionControls = screen.getAllByLabelText('Add reaction');
    expect(addReactionControls).toHaveLength(2);
    const activeAddReactionControl = addReactionControls.find(
      (control) => control.props.accessibilityState?.busy === true,
    );
    const blockedAddReactionControl = addReactionControls.find(
      (control) => control.props.accessibilityState?.busy !== true,
    );
    expect(activeAddReactionControl?.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(blockedAddReactionControl?.props.accessibilityState).toMatchObject({ disabled: true, busy: false });
    if (blockedControl) await fireEvent.press(blockedControl);
    expect(onMessageReaction).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('directs read-only and unsent long presses to message actions without announcing reaction support', async (): Promise<void> => {
    const onMessageActions = jest.fn<(selected: ChatMessage) => void>();
    const onMessageReaction = jest.fn<(selected: ChatMessage, reaction: ReactionType | null) => void>();
    const screen = await render(
      <DirectChatThreadView
        {...props({
          session: { ...session, canSend: false },
          messages: [reactedMessage],
          onMessageActions,
          onMessageReaction,
        })}
      />,
    );
    const readOnlyTarget = screen.getByLabelText('Hello from Direct Chat. from miguel');

    expect(readOnlyTarget.props.accessibilityHint).toBe('Long press to open message actions');
    expect(screen.getByLabelText('Remove heart reaction').props.accessibilityState).toMatchObject({
      disabled: true,
      busy: false,
    });
    await fireEvent(readOnlyTarget, 'longPress');
    expect(onMessageActions).toHaveBeenCalledWith(reactedMessage);

    await screen.rerender(
      <DirectChatThreadView {...props({ messages: [unsentMessage], onMessageActions, onMessageReaction })} />,
    );
    const unsentTarget = screen.getByLabelText('Message unsent from miguel');

    expect(unsentTarget.props.accessibilityHint).toBe('Long press to open message actions');
    await fireEvent(unsentTarget, 'longPress');
    expect(onMessageActions).toHaveBeenLastCalledWith(unsentMessage);
    screen.unmount();
  });

  it('keeps the one-image picker in the composer row with an accessible icon action', async (): Promise<void> => {
    const onPickImage = jest.fn<() => void>();
    const screen = await render(<DirectChatThreadView {...props({ onPickImage })} />);

    await fireEvent.press(screen.getByLabelText('Add image'));
    expect(onPickImage).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('hides the image picker after any text and grows the multiline input to about three lines', async (): Promise<void> => {
    const screen = await render(<DirectChatThreadView {...props()} />);
    const input = screen.getByLabelText('Message');

    expect(input.props.maxLength).toBe(2_000);
    expect(input.props.multiline).toBe(true);
    expect(input.props.textAlignVertical).toBe('top');
    expect(input.props.accessibilityHint).toBe('Enter a direct message up to 2,000 characters');
    expect(input.props.className).toContain('max-h-20');
    expect(screen.queryByText('0/2000')).toBeNull();

    await fireEvent.changeText(input, ' ');

    expect(screen.queryByLabelText('Add image')).toBeNull();
    expect(screen.getByLabelText('Send message').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByText('1/2000')).toBeNull();
    screen.unmount();
  });

  it('removes the bottom safe-area inset while the keyboard is visible', async (): Promise<void> => {
    DeviceEventEmitter.emit('keyboardDidHide', keyboardEvent);
    const screen = await render(<DirectChatThreadView {...props()} />);
    const composer = screen.getByTestId('direct-chat-composer');

    expect(composer.props.style).toMatchObject({ paddingBottom: 40 + Spacing.sm });
    await act(async (): Promise<void> => {
      DeviceEventEmitter.emit('keyboardDidShow', keyboardEvent);
    });
    expect(composer.props.style).toMatchObject({ paddingBottom: Spacing.sm });

    await act(async (): Promise<void> => {
      DeviceEventEmitter.emit('keyboardDidHide', keyboardEvent);
    });
    expect(composer.props.style).toMatchObject({ paddingBottom: 40 + Spacing.sm });
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

    expect(screen.getByLabelText('Add image').props.accessibilityState).toMatchObject({ disabled: true });
    const input = screen.getByLabelText('Message');
    await fireEvent.changeText(input, 'Keep this text');
    expect(screen.queryByLabelText('Add image')).toBeNull();
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
