import { jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import type { ComponentProps, ReactElement } from 'react';
import { View as MockView } from 'react-native';

const mockMutate = jest.fn<(variables: unknown, options: unknown) => void>();
const mockRouter = {
  canDismiss: jest.fn((): boolean => false),
  back: jest.fn((): void => {}),
  dismiss: jest.fn((): void => {}),
  push: jest.fn((): void => {}),
  replace: jest.fn((): void => {}),
};

jest.mock('expo-camera', () => ({
  Camera: { scanFromURLAsync: jest.fn() },
  useCameraPermissions: (): [{ granted: boolean; canAskAgain: boolean }, jest.Mock] => [
    { granted: true, canAskAgain: false },
    jest.fn(),
  ],
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: (): { 'ganap-id': string } => ({ 'ganap-id': 'ganap-1' }),
  useRouter: (): typeof mockRouter => mockRouter,
}));

jest.mock('@/hooks/mutations/useGanapMutation', () => ({
  useCheckInMutation: (): { mutate: jest.Mock } => ({ mutate: mockMutate }),
}));

jest.mock('@/hooks/queries/useGanapsQuery', () => ({
  useGanapDetailQuery: (): { data: { title: string } } => ({ data: { title: 'Coffee & Code' } }),
}));

jest.mock('@/components/ganaps/AttendanceScanView', () => ({
  AttendanceScanView: (props: Record<string, unknown>): ReactElement => (
    <MockView testID="attendance-view" {...(props as unknown as ComponentProps<typeof MockView>)} />
  ),
}));

const mockLaunchImageLibraryAsync = jest.mocked(ImagePicker.launchImageLibraryAsync);
const mockScanFromURLAsync = jest.mocked(Camera.scanFromURLAsync);

import type { AttendanceScanPhase } from '@/components/ganaps/AttendanceScanView';
import AttendanceScanScreen from './[ganap-id]';

interface MockAttendanceViewProps {
  phase: AttendanceScanPhase;
  onBarcodeScanned: (data: string) => void;
  onPickImage: () => void | Promise<void>;
}

function getAttendanceViewProps(screen: Awaited<ReturnType<typeof render>>): MockAttendanceViewProps {
  return screen.getByTestId('attendance-view').props as unknown as MockAttendanceViewProps;
}

describe('AttendanceScanScreen image QR scanning', (): void => {
  beforeEach((): void => {
    jest.clearAllMocks();
  });

  it('scans one selected image for a QR and submits its data through the normal flow', async (): Promise<void> => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///attendance.png', width: 100, height: 100, type: 'image' }],
    });
    mockScanFromURLAsync.mockResolvedValue([
      {
        type: 'qr',
        data: 'qr-hash',
        bounds: { origin: { x: 0, y: 0 }, size: { width: 100, height: 100 } },
        cornerPoints: [],
      },
    ]);
    const screen = await render(<AttendanceScanScreen />);

    await act(async (): Promise<void> => {
      await getAttendanceViewProps(screen).onPickImage();
    });
    expect(mockLaunchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    expect(mockScanFromURLAsync).toHaveBeenCalledWith('file:///attendance.png', ['qr']);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ ganapId: 'ganap-1', qrHash: 'qr-hash' }),
      expect.anything(),
    );
    expect(getAttendanceViewProps(screen).phase.name).toBe('submitting');
  });

  it('returns to camera scanning when the photo picker is cancelled', async (): Promise<void> => {
    mockLaunchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });
    const screen = await render(<AttendanceScanScreen />);

    await act(async (): Promise<void> => {
      await getAttendanceViewProps(screen).onPickImage();
    });

    expect(mockScanFromURLAsync).not.toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
    expect(getAttendanceViewProps(screen).phase).toEqual({ name: 'scanning' });
  });

  it('shows a rescan error when the selected image has no QR code', async (): Promise<void> => {
    mockLaunchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///no-qr.png', width: 100, height: 100, type: 'image' }],
    });
    mockScanFromURLAsync.mockResolvedValue([]);
    const screen = await render(<AttendanceScanScreen />);

    await act(async (): Promise<void> => {
      await getAttendanceViewProps(screen).onPickImage();
    });

    expect(getAttendanceViewProps(screen).phase).toMatchObject({
      name: 'error',
      canRescan: true,
      model: { title: 'No attendance QR found' },
    });
  });

  it('shows a rescan error when image selection or scanning fails', async (): Promise<void> => {
    mockLaunchImageLibraryAsync.mockRejectedValue(new Error('picker unavailable'));
    const screen = await render(<AttendanceScanScreen />);

    await act(async (): Promise<void> => {
      await getAttendanceViewProps(screen).onPickImage();
    });

    expect(getAttendanceViewProps(screen).phase).toMatchObject({
      name: 'error',
      canRescan: true,
      model: { title: 'Could not read that image' },
    });
  });

  it('does not open the picker after a camera scan has already submitted', async (): Promise<void> => {
    const screen = await render(<AttendanceScanScreen />);
    await act(async (): Promise<void> => {
      getAttendanceViewProps(screen).onBarcodeScanned('camera-qr');
    });

    await act(async (): Promise<void> => {
      await getAttendanceViewProps(screen).onPickImage();
    });

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockLaunchImageLibraryAsync).not.toHaveBeenCalled();
  });
});
