import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { SharingOptions } from 'expo-sharing';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import type { GanapDetail } from '@/types/ganap.types';

interface MockShareQrCodeHandle {
  captureImage: () => Promise<string>;
}

interface MockShareQrCodeProps {
  value: string;
  title: string;
  details: readonly string[];
}

const mockCaptureImage = jest.fn<() => Promise<string>>();
const mockIsAvailableAsync = jest.fn<() => Promise<boolean>>();
const mockShareAsync = jest.fn<(uri: string, options?: SharingOptions) => Promise<void>>();

jest.mock('@/components/common/ShareQrCode', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');

  const ShareQrCodeMock = React.forwardRef<MockShareQrCodeHandle, MockShareQrCodeProps>(
    (_props: MockShareQrCodeProps, ref: React.ForwardedRef<MockShareQrCodeHandle>) => {
      React.useImperativeHandle(ref, (): MockShareQrCodeHandle => ({ captureImage: mockCaptureImage }));
      return React.createElement(View);
    },
  );

  return { ShareQrCode: ShareQrCodeMock };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: (): Promise<boolean> => mockIsAvailableAsync(),
  shareAsync: (uri: string, options?: SharingOptions): Promise<void> => mockShareAsync(uri, options),
}));

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  return {
    QrCode: (): null => null,
    Share2: (): null => null,
    X: (): null => null,
    LucideProvider: ({ children }: { children?: React.ReactNode }): React.ReactElement =>
      React.createElement(React.Fragment, null, children),
  };
});
jest.mock('@/hooks/useResolvedTheme', () => ({ useResolvedTheme: (): 'light' => 'light' }));

import { GanapShareModal } from './GanapShareModal';

const ganap: GanapDetail = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'Ganapps Demo Business',
  slug: 'student-union-meetup',
  title: 'Student Union Meetup',
  description: 'Meet at the student union.',
  address: 'Student Union',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T06:00:00.000Z',
  attendanceOpenMinutesBefore: 30,
  status: 'PUBLISHED',
  requiresApproval: false,
  maxAttendees: 40,
  tags: ['study'],
  coverImage: null,
  bannerImage: null,
  mapPinImage: null,
  registrationCount: 0,
  likesCount: 0,
  averageRating: null,
  ratingCount: 0,
  isLiked: false,
  isSaved: false,
  myRegistration: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation((): void => {});

function renderModal(onNativeShare: () => void | Promise<void>): ReactElement {
  return (
    <GanapShareModal
      visible
      url="https://ganapps.example/ganaps/student-union-meetup"
      ganap={ganap}
      schedule={{ dateLabel: 'Aug 8, 2026', timeLabel: '10 AM–2 PM' }}
      onClose={(): void => {}}
      onNativeShare={onNativeShare}
    />
  );
}

beforeEach((): void => {
  jest.clearAllMocks();
  mockCaptureImage.mockResolvedValue('file:///captured-qr.png');
  mockIsAvailableAsync.mockResolvedValue(true);
  mockShareAsync.mockResolvedValue(undefined);
});

afterEach((): void => {
  jest.clearAllMocks();
});

describe('GanapShareModal', (): void => {
  it('shares the captured QR card as a PNG file', async (): Promise<void> => {
    const screen = await render(renderModal((): void => {}));

    await fireEvent.press(screen.getByRole('button', { name: 'Share QR image' }));

    await waitFor((): void => {
      expect(mockShareAsync).toHaveBeenCalledWith('file:///captured-qr.png', {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: 'Share QR image',
      });
    });
    expect(mockCaptureImage).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('keeps event-link sharing on its separate action', async (): Promise<void> => {
    const onNativeShare = jest.fn<() => void>();
    const screen = await render(renderModal(onNativeShare));

    await fireEvent.press(screen.getByRole('button', { name: 'Share event link' }));

    expect(onNativeShare).toHaveBeenCalledTimes(1);
    expect(mockIsAvailableAsync).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('explains when file sharing is unavailable', async (): Promise<void> => {
    mockIsAvailableAsync.mockResolvedValue(false);
    const screen = await render(renderModal((): void => {}));

    await fireEvent.press(screen.getByRole('button', { name: 'Share QR image' }));

    await waitFor((): void => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Sharing unavailable',
        'QR image sharing is not available on this device.',
      );
    });
    expect(mockCaptureImage).not.toHaveBeenCalled();
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it('reports share failures without claiming success', async (): Promise<void> => {
    mockShareAsync.mockRejectedValue(new Error('share failed'));
    const screen = await render(renderModal((): void => {}));

    await fireEvent.press(screen.getByRole('button', { name: 'Share QR image' }));

    await waitFor((): void => {
      expect(mockAlert).toHaveBeenCalledWith('Unable to share QR image', 'Please try again.');
    });
    expect(mockAlert).not.toHaveBeenCalledWith('QR image shared', expect.any(String));
  });
});
