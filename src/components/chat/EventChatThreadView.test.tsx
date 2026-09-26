import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { DeviceEventEmitter, type KeyboardEvent, View as MockView } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { FailedDraft } from '@/hooks/useChat';
import { showToast } from '@/store/toast.store';
import type { ChatImageDraft, ChatMessage, EventChatSession } from '@/types/chat.types';
import { EventChatThreadView } from './EventChatThreadView';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  ImagePlus: (): null => null,
  MoreVertical: (): null => null,
  Send: (): null => null,
  X: (): null => null,
}));

jest.mock('expo-image', () => ({
  Image: (): ReactElement => <MockView testID="avatar-image" />,
}));

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

const mockedShowToast = jest.mocked(showToast);

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

const keyboardEvent: KeyboardEvent = {
  duration: 0,
  easing: 'keyboard',
  endCoordinates: { screenX: 0, screenY: 0, width: 0, height: 0 },
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
  beforeEach((): void => {
    mockedShowToast.mockClear();
  });

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

  it('uses the composer send control for an image and preserves typed text', async (): Promise<void> => {
    const onPickImage = jest.fn<() => void>();
    const onRemoveImage = jest.fn<() => void>();
    const onSendImage = jest.fn<() => void>();
    const onSend = jest.fn<(content: string) => void>();
    const screen = await render(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
          imageDraft,
          onSend,
          onPickImage,
          onRemoveImage,
          onSendImage,
        })}
      />,
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
    expect(screen.queryByText('Checking image…')).toBeNull();
    expect(screen.getAllByLabelText('Send image')).toHaveLength(1);
    expect(screen.queryByLabelText('Retry image')).toBeNull();

    await screen.rerender(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
          imageDraft: { ...imageDraft, status: 'checking' },
          isSending: true,
          onPickImage,
          onRemoveImage,
          onSendImage,
        })}
      />,
    );
    expect(screen.queryByText('Checking image…')).toBeNull();
    expect(screen.getByLabelText('Remove image').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByLabelText('Send image').props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    screen.unmount();
  });

  it('uses the same composer control for retryable images and blocks permanent failures', async (): Promise<void> => {
    const onRetryImage = jest.fn<() => void>();
    const retryable = { ...imageDraft, status: 'retryable-failure' as const, error: new Error('offline') };
    const screen = await render(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
          imageDraft: retryable,
          onRetryImage,
        })}
      />,
    );

    expect(mockedShowToast).toHaveBeenCalledWith(
      'error',
      "Image couldn't be sent. Check your connection and try again.",
    );
    expect(screen.queryByText("Image couldn't be sent. Check your connection and try again.")).toBeNull();
    await fireEvent.press(screen.getByLabelText('Send image'));
    expect(onRetryImage).toHaveBeenCalledTimes(1);

    await screen.rerender(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
          imageDraft: { ...retryable, status: 'permanent-failure' as const },
          onRetryImage,
        })}
      />,
    );
    expect(screen.getByLabelText('Send image').props.accessibilityState).toMatchObject({ disabled: true });
    expect(onRetryImage).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('keeps the one-image picker as an accessible icon in the composer row', async (): Promise<void> => {
    const onPickImage = jest.fn<() => void>();
    const screen = await render(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
          onPickImage,
        })}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Add image'));
    expect(onPickImage).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('hides the image picker after any text and grows the multiline input to about three lines', async (): Promise<void> => {
    const screen = await render(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
        })}
      />,
    );
    const input = screen.getByLabelText('Message');

    expect(input.props.maxLength).toBe(2_000);
    expect(input.props.multiline).toBe(true);
    expect(input.props.textAlignVertical).toBe('top');
    expect(input.props.accessibilityHint).toBe('Enter a text message up to 2,000 characters');
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
    const screen = await render(
      <EventChatThreadView
        {...props({
          session: { ...readOnlySession, capability: 'READ_WRITE', canSend: true, ganapStatus: 'ONGOING' },
        })}
      />,
    );
    const composer = screen.getByTestId('event-chat-composer');

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
    expect(screen.queryByLabelText('React with heart')).toBeNull();
    screen.unmount();
  });
});
