import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { createRef } from 'react';
import type { ShareQrCodeHandle } from './ShareQrCode';

const mockCaptureImage = jest.fn<() => Promise<string>>();

jest.mock('react-native-view-shot', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');

  interface MockViewShotHandle {
    capture: () => Promise<string>;
  }

  interface MockViewShotProps {
    children?: React.ReactNode;
  }

  const ViewShotMock = React.forwardRef<MockViewShotHandle, MockViewShotProps>(
    ({ children }: MockViewShotProps, ref: React.ForwardedRef<MockViewShotHandle>) => {
      React.useImperativeHandle(ref, (): MockViewShotHandle => ({ capture: mockCaptureImage }));
      return React.createElement(View, null, children);
    },
  );

  return { __esModule: true, default: ViewShotMock };
});

jest.mock('react-native-qrcode-svg', () => (): null => null);
jest.mock('expo-media-library', () => ({ requestPermissionsAsync: jest.fn(), Asset: { create: jest.fn() } }));
jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  return {
    Download: (): null => null,
    LucideProvider: ({ children }: { children?: React.ReactNode }): React.ReactElement =>
      React.createElement(React.Fragment, null, children),
  };
});

import { ShareQrCode } from './ShareQrCode';

describe('ShareQrCode', (): void => {
  it('exposes the captured QR image URI to its owner', async (): Promise<void> => {
    mockCaptureImage.mockResolvedValue('file:///captured-qr.png');
    const ref = createRef<ShareQrCodeHandle>();
    await render(<ShareQrCode ref={ref} value="https://ganapps.example/ganaps/one" title="One Ganap" details={[]} />);

    expect(ref.current).not.toBeNull();
    await expect(ref.current?.captureImage()).resolves.toBe('file:///captured-qr.png');
    expect(mockCaptureImage).toHaveBeenCalledTimes(1);
  });
});
