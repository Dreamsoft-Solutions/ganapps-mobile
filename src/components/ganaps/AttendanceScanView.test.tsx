import { jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { View as MockView } from 'react-native';
import type { CheckInErrorModel } from '@/utils/attendance';

jest.mock('expo-camera', () => ({
  CameraView: (): ReactElement => <MockView testID="camera-view" />,
}));

jest.mock('lucide-react-native', () => {
  const Icon = (): null => null;
  return {
    ArrowLeft: Icon,
    CircleAlert: Icon,
    CircleCheck: Icon,
    CloudUpload: Icon,
    ImageUp: Icon,
    LucideProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
    Settings: Icon,
  };
});

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

import { AttendanceScanView } from './AttendanceScanView';

const baseProps = {
  eventTitle: 'Coffee & Code',
  onBarcodeScanned: jest.fn<(data: string) => void>(),
  onPickImage: jest.fn<() => void>(),
  onScanAgain: jest.fn<() => void>(),
  onOpenSettings: jest.fn<() => void>(),
  onBack: jest.fn<() => void>(),
  onGiveFeedback: jest.fn<() => void>(),
};

describe('AttendanceScanView image scanning controls', (): void => {
  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('offers photo selection alongside the live camera scanner', async (): Promise<void> => {
    const screen = await render(<AttendanceScanView {...baseProps} phase={{ name: 'scanning' }} />);

    expect(screen.getByTestId('camera-view')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Choose from Photos' }));

    expect(baseProps.onPickImage).toHaveBeenCalledTimes(1);
  });

  it('shows a loading state while the selected image is being read', async (): Promise<void> => {
    const screen = await render(<AttendanceScanView {...baseProps} phase={{ name: 'picking-image' }} />);

    expect(screen.getByText('Reading QR code from image')).toBeTruthy();
    expect(screen.queryByTestId('camera-view')).toBeNull();
  });

  it('offers another attempt for an image-reading error', async (): Promise<void> => {
    const model: CheckInErrorModel = {
      kind: 'unknown',
      title: 'No attendance QR found',
      message: 'Choose another image.',
    };
    const screen = await render(
      <AttendanceScanView {...baseProps} phase={{ name: 'error', model, canRescan: true }} />,
    );

    expect(screen.getByText('No attendance QR found')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan again' }));

    expect(baseProps.onScanAgain).toHaveBeenCalledTimes(1);
  });
});
