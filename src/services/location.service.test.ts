import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';

type PermissionResponse = {
  granted: boolean;
  canAskAgain: boolean;
  ios?: { scope: string; accuracy: 'full' | 'reduced' };
  android?: { accuracy: 'fine' | 'coarse' };
};

const mockGetForegroundPermissionsAsync = jest.fn<() => Promise<PermissionResponse>>();
const mockRequestForegroundPermissionsAsync = jest.fn<() => Promise<PermissionResponse>>();
const mockGetCurrentPositionAsync = jest.fn<() => Promise<{ coords: { latitude: number; longitude: number } }>>();

jest.mock('expo-location', () => ({
  __esModule: true,
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: (): Promise<PermissionResponse> => mockGetForegroundPermissionsAsync(),
  requestForegroundPermissionsAsync: (): Promise<PermissionResponse> => mockRequestForegroundPermissionsAsync(),
  getCurrentPositionAsync: (): Promise<{ coords: { latitude: number; longitude: number } }> =>
    mockGetCurrentPositionAsync(),
}));

import { getCurrentCoords, getPermissionStatus, requestPermission, roundCoord } from './location.service';

beforeEach((): void => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
});

describe('roundCoord', (): void => {
  it('rounds to two decimal places', (): void => {
    expect(roundCoord(10.731298)).toBe(10.73);
    expect(roundCoord(122.548911)).toBe(122.55);
  });

  it('rounds negative values away from zero at the midpoint boundary consistently', (): void => {
    expect(roundCoord(-122.555)).toBe(-122.55);
    expect(roundCoord(-10.736)).toBe(-10.74);
  });

  it('leaves an already-coarse value unchanged', (): void => {
    expect(roundCoord(10.7)).toBe(10.7);
  });
});

describe('getPermissionStatus', (): void => {
  it('reports the iOS accuracy authorization', async (): Promise<void> => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      ios: { scope: 'whenInUse', accuracy: 'reduced' },
    });

    await expect(getPermissionStatus()).resolves.toEqual({
      granted: true,
      canAskAgain: false,
      accuracy: 'reduced',
    });
  });

  it('reports null accuracy off iOS', async (): Promise<void> => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    mockGetForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: true,
      android: { accuracy: 'fine' },
    });

    await expect(getPermissionStatus()).resolves.toEqual({
      granted: true,
      canAskAgain: true,
      accuracy: null,
    });
  });

  it('never raises the system prompt', async (): Promise<void> => {
    mockGetForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });

    await getPermissionStatus();

    expect(mockRequestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('requestPermission', (): void => {
  it('raises the system prompt exactly once per call', async (): Promise<void> => {
    mockRequestForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      canAskAgain: false,
      ios: { scope: 'whenInUse', accuracy: 'full' },
    });

    await expect(requestPermission()).resolves.toEqual({
      granted: true,
      canAskAgain: false,
      accuracy: 'full',
    });
    expect(mockRequestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
  });
});

describe('getCurrentCoords', (): void => {
  it('returns coordinates rounded to two decimal places', async (): Promise<void> => {
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 10.731298, longitude: 122.548911 },
    });

    await expect(getCurrentCoords()).resolves.toEqual({ latitude: 10.73, longitude: 122.55 });
  });

  it('propagates a position failure to the caller', async (): Promise<void> => {
    mockGetCurrentPositionAsync.mockRejectedValue(new Error('location unavailable'));

    await expect(getCurrentCoords()).rejects.toThrow('location unavailable');
  });
});
