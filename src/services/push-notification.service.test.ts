import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { EventSubscription } from 'expo-modules-core';
import type {
  DevicePushToken,
  Notification,
  NotificationBehavior,
  NotificationHandler,
  NotificationResponse,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { Routes } from '@/constants/routes';

let mockPushTokenListener: ((token: DevicePushToken) => void) | null = null;
let mockNotificationResponseListener: ((response: NotificationResponse) => void) | null = null;
const mockSetNotificationHandler = jest.fn<(handler: NotificationHandler) => void>();
const mockSetNotificationChannelAsync = jest.fn<(...args: unknown[]) => Promise<null>>();
const mockGetPermissionsAsync = jest.fn<() => Promise<{ granted: boolean }>>();
const mockRequestPermissionsAsync = jest.fn<() => Promise<{ granted: boolean }>>();
const mockGetDevicePushTokenAsync = jest.fn<() => Promise<DevicePushToken>>();
const mockAddPushTokenListener = jest.fn<(listener: (token: DevicePushToken) => void) => EventSubscription>();
const mockAddNotificationResponseReceivedListener =
  jest.fn<(listener: (response: NotificationResponse) => void) => EventSubscription>();
const mockGetLastNotificationResponse = jest.fn<() => NotificationResponse | null>();
const mockClearLastNotificationResponse = jest.fn<() => void>();
const mockRemovePushListener = jest.fn<() => void>();
const mockRemoveResponseListener = jest.fn<() => void>();
const mockRegister =
  jest.fn<(request: { token: string; platform: 'android' | 'ios' }) => Promise<{ registered: boolean }>>();
const mockRevoke = jest.fn<() => Promise<{ revoked: number }>>();

Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });

jest.mock('expo-notifications', () => ({
  __esModule: true,
  AndroidImportance: { DEFAULT: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  setNotificationHandler: mockSetNotificationHandler,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
  getDevicePushTokenAsync: mockGetDevicePushTokenAsync,
  addPushTokenListener: mockAddPushTokenListener,
  addNotificationResponseReceivedListener: mockAddNotificationResponseReceivedListener,
  getLastNotificationResponse: mockGetLastNotificationResponse,
  clearLastNotificationResponse: mockClearLastNotificationResponse,
}));

jest.mock('@/api/endpoints/push-tokens', () => ({
  pushTokensAPI: {
    register: mockRegister,
    revoke: mockRevoke,
  },
}));

let pushNotificationService: typeof import('./push-notification.service');

beforeAll((): void => {
  pushNotificationService = require('./push-notification.service') as typeof import('./push-notification.service');
});

/**
 * Waits for the asynchronous native/API chain to settle in a test.
 *
 * @returns A promise resolved on the next timer turn.
 */
function flushPromises(): Promise<void> {
  return new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, 0);
  });
}

/**
 * Creates the subset of an Expo response used by the routing service.
 *
 * @param identifier - Native notification request identifier.
 * @param data - Notification data payload.
 * @returns A typed test response.
 */
function makeResponse(identifier: string, data: Record<string, unknown>): NotificationResponse {
  return {
    notification: {
      request: {
        identifier,
        content: { data },
      },
    },
  } as unknown as NotificationResponse;
}

beforeEach((): void => {
  mockPushTokenListener = null;
  mockNotificationResponseListener = null;
  mockSetNotificationHandler.mockClear();
  mockSetNotificationChannelAsync.mockClear().mockResolvedValue(null);
  mockGetPermissionsAsync.mockClear().mockResolvedValue({ granted: false });
  mockRequestPermissionsAsync.mockClear().mockResolvedValue({ granted: true });
  mockGetDevicePushTokenAsync.mockClear().mockResolvedValue({ type: 'android', data: 'initial-token' });
  mockAddPushTokenListener
    .mockClear()
    .mockImplementation((listener: (token: DevicePushToken) => void): EventSubscription => {
      mockPushTokenListener = listener;
      return { remove: mockRemovePushListener };
    });
  mockAddNotificationResponseReceivedListener
    .mockClear()
    .mockImplementation((listener: (response: NotificationResponse) => void): EventSubscription => {
      mockNotificationResponseListener = listener;
      return { remove: mockRemoveResponseListener };
    });
  mockGetLastNotificationResponse.mockClear().mockReturnValue(null);
  mockClearLastNotificationResponse.mockClear();
  mockRemovePushListener.mockClear();
  mockRemoveResponseListener.mockClear();
  mockRegister.mockClear().mockResolvedValue({ registered: true });
  mockRevoke.mockClear().mockResolvedValue({ revoked: 1 });
});

describe('Android token lifecycle', (): void => {
  it('creates the channel before permission and token retrieval', async (): Promise<void> => {
    const token = await pushNotificationService.getAndroidDevicePushToken();

    expect(token).toBe('initial-token');
    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'registration-status',
      expect.objectContaining({ name: 'Registration status' }),
    );
    expect(mockSetNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mockGetPermissionsAsync.mock.invocationCallOrder[0],
    );
    expect(mockGetDevicePushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it('does not fetch or register a token after permission is denied', async (): Promise<void> => {
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });

    await expect(pushNotificationService.getAndroidDevicePushToken()).resolves.toBeNull();

    expect(mockGetDevicePushTokenAsync).not.toHaveBeenCalled();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers startup and rotated tokens without fetching inside the listener', async (): Promise<void> => {
    const cleanup = pushNotificationService.startAndroidPushTokenSync();
    await flushPromises();

    expect(mockRegister).toHaveBeenCalledWith({ token: 'initial-token', platform: 'android' });
    expect(mockPushTokenListener).not.toBeNull();

    mockPushTokenListener?.({ type: 'android', data: 'rotated-token' });
    await flushPromises();

    expect(mockGetDevicePushTokenAsync).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenLastCalledWith({ token: 'rotated-token', platform: 'android' });
    cleanup();
    await pushNotificationService.revokeRegisteredAndroidPushToken();
  });

  it('swallows token-revocation failures for best-effort logout cleanup', async (): Promise<void> => {
    const cleanup = pushNotificationService.startAndroidPushTokenSync();
    await flushPromises();
    mockRevoke.mockRejectedValueOnce(new Error('offline'));

    await expect(pushNotificationService.revokeRegisteredAndroidPushToken()).resolves.toBeUndefined();

    cleanup();
  });
});

describe('notification response lifecycle', (): void => {
  it('configures current foreground presentation fields', async (): Promise<void> => {
    pushNotificationService.configureNotificationHandling();

    const handler: NotificationHandler = mockSetNotificationHandler.mock.calls[0][0];
    const behavior: NotificationBehavior = await handler.handleNotification({} as Notification);

    expect(behavior).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('queues a cold-start response, deduplicates the live response, and clears after handling', (): void => {
    const response = makeResponse('response-1', {
      type: 'REGISTRATION_STATUS_UPDATED',
      ganapId: 'ganap-42',
      registrationStatus: 'REGISTERED',
    });
    mockGetLastNotificationResponse.mockReturnValue(response);

    const cleanup = pushNotificationService.startNotificationResponseObserver();
    const secondCleanup = pushNotificationService.startNotificationResponseObserver();
    const target = pushNotificationService.getPendingNotificationTarget();

    expect(target).toEqual(Routes.ganapDetail('ganap-42'));
    expect(mockAddNotificationResponseReceivedListener).toHaveBeenCalledTimes(1);
    mockNotificationResponseListener?.(response);
    expect(pushNotificationService.getPendingNotificationTarget()).toBe(target);

    if (target !== null) pushNotificationService.completePendingNotification(target);
    expect(pushNotificationService.getPendingNotificationTarget()).toBeNull();
    expect(mockClearLastNotificationResponse).toHaveBeenCalledTimes(1);
    cleanup();
    expect(mockRemoveResponseListener).not.toHaveBeenCalled();
    secondCleanup();
    expect(mockRemoveResponseListener).toHaveBeenCalledTimes(1);
  });
});
