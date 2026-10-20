import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { View as MockView } from 'react-native';
import { ChatImageViewer, type ChatImageViewerProps } from './ChatImage';

let mockReducedMotion: boolean = false;
jest.mock('react-native-reanimated', (): object => ({ useReducedMotion: (): boolean => mockReducedMotion }));

jest.mock('expo-image', (): object => ({
  Image: (props: {
    source?: unknown;
    accessibilityLabel?: string;
    onLoad?: () => void;
    onError?: (event: { error: string }) => void;
  }): ReactElement => <MockView testID="viewer-image" {...props} />,
}));
jest.mock('lucide-react-native', (): object => ({ X: (): null => null }));
jest.mock('@/hooks/useResolvedTheme', (): object => ({ useResolvedTheme: (): 'light' => 'light' }));
jest.mock('react-native-safe-area-context', (): object => ({
  useSafeAreaInsets: (): object => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function viewerProps(overrides: Partial<ChatImageViewerProps> = {}): ChatImageViewerProps {
  return {
    visible: true,
    media: {
      id: 'media-1',
      url: 'https://example.test/private?sig=first',
      mimeType: 'image/webp',
      width: 100,
      height: 200,
      bytes: 100,
    },
    senderUsername: 'Alex',
    reloadToken: 0,
    loadFailed: false,
    onLoadError: jest.fn(),
    onRetry: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

describe('ChatImageViewer', (): void => {
  beforeEach((): void => {
    mockReducedMotion = false;
  });

  it('removes the modal transition when reduced motion is enabled, including when reopened', async (): Promise<void> => {
    const screen = await render(<ChatImageViewer {...viewerProps()} />);
    expect(screen.getByTestId('chat-photo-viewer').props.animationType).toBe('fade');
    await screen.rerender(<ChatImageViewer {...viewerProps({ visible: false })} />);
    mockReducedMotion = true;
    await screen.rerender(<ChatImageViewer {...viewerProps()} />);
    expect(screen.getByTestId('chat-photo-viewer').props.animationType).toBe('none');
    await screen.unmount();
  });
  it('loads privately in a native modal and closes from its button or native Back', async (): Promise<void> => {
    const onClose = jest.fn<() => void>();
    const screen = await render(<ChatImageViewer {...viewerProps({ onClose })} />);
    expect(screen.getByLabelText('Loading photo')).toBeTruthy();
    await fireEvent(screen.getByTestId('viewer-image'), 'load');
    expect(screen.queryByLabelText('Loading photo')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Close photo'));
    await fireEvent(screen.getByTestId('chat-photo-viewer'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(2);
    await screen.unmount();
  });

  it('uses a renewed signed URL, reports load failures, and offers the existing retry', async (): Promise<void> => {
    const onLoadError = jest.fn<(error: string) => void>();
    const onRetry = jest.fn<() => void>();
    const props = viewerProps({ onLoadError, onRetry });
    const screen = await render(<ChatImageViewer {...props} />);
    await fireEvent(screen.getByTestId('viewer-image'), 'error', { error: '403' });
    expect(onLoadError).toHaveBeenCalledWith('403');
    await screen.rerender(<ChatImageViewer {...props} loadFailed />);
    expect(screen.getByText('Image unavailable.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry image'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await screen.rerender(
      <ChatImageViewer
        {...props}
        media={{ ...props.media, url: 'https://example.test/private?sig=renewed' }}
        reloadToken={1}
      />,
    );
    expect(screen.getByTestId('viewer-image').props.source).toEqual({
      uri: 'https://example.test/private?sig=renewed',
    });
    expect(screen.getByLabelText('Loading photo')).toBeTruthy();
    await screen.rerender(<ChatImageViewer {...props} visible={false} />);
    expect(screen.queryByLabelText('Close photo')).toBeNull();
    await screen.unmount();
  });
});
