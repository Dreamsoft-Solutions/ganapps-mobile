import type { EventSubscription } from 'expo-modules-core';
import type {
  DevicePushToken,
  Notification,
  NotificationBehavior,
  NotificationChannelInput,
  NotificationResponse,
} from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { Platform } from 'react-native';
import { pushTokensAPI } from '@/api/endpoints/push-tokens';
import { notificationRoute } from '@/utils/notification';

/** Stable Android channel used for registration-status notifications. */
export const ANDROID_NOTIFICATION_CHANNEL_ID: string = 'registration-status';

const ANDROID_NOTIFICATION_CHANNEL: NotificationChannelInput = {
  name: 'Registration status',
  importance: Notifications.AndroidImportance.DEFAULT,
  sound: 'default',
  vibrationPattern: [0, 250, 250, 250],
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  showBadge: true,
};

let notificationHandlerConfigured: boolean = false;
let responseSubscription: EventSubscription | null = null;
let responseObserverReferences: number = 0;
let hasReadLastNotificationResponse: boolean = false;
let pendingNotification: { target: Href } | null = null;
const seenResponseKeys: Set<string> = new Set();
const pendingNotificationListeners: Set<(target: Href | null) => void> = new Set();

/**
 * Configures foreground notification presentation with the current Expo behavior fields.
 *
 * @returns Nothing. Configuration is idempotent and best effort on unsupported runtimes.
 */
export function configureNotificationHandling(): void {
  if (notificationHandlerConfigured || Platform.OS === 'web') return;

  try {
    Notifications.setNotificationHandler({
      handleNotification: async (_notification: Notification): Promise<NotificationBehavior> => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    notificationHandlerConfigured = true;
  } catch {
    // Native notification modules can be unavailable in web or a plain Jest runtime.
  }
}

/**
 * Creates the stable Android channel before notification permission or token work begins.
 *
 * @returns A promise that resolves after the channel has been configured.
 */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL_ID, ANDROID_NOTIFICATION_CHANNEL);
}

/**
 * Requests Android notification permission when needed and fetches the native device token.
 *
 * @returns The Android device token, or `null` when this is not Android or permission is denied.
 * @throws Re-throws native permission/token errors for the caller's best-effort boundary.
 */
export async function getAndroidDevicePushToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  await ensureAndroidNotificationChannel();

  const currentPermissions = await Notifications.getPermissionsAsync();
  const permissions = currentPermissions.granted ? currentPermissions : await Notifications.requestPermissionsAsync();
  if (!permissions.granted) return null;

  const deviceToken = await Notifications.getDevicePushTokenAsync();
  return getAndroidTokenValue(deviceToken);
}

/**
 * Starts Android token synchronization and listens for token rotation without re-fetching in the listener.
 *
 * @returns A cleanup function that stops the rotation listener and invalidates in-flight startup work.
 */
export function startAndroidPushTokenSync(): () => void {
  if (Platform.OS !== 'android') return (): void => {};

  let active: boolean = true;
  let tokenSubscription: EventSubscription | null = null;

  try {
    tokenSubscription = Notifications.addPushTokenListener((deviceToken: DevicePushToken): void => {
      if (!active) return;
      void syncKnownAndroidToken(deviceToken, (): boolean => active);
    });
  } catch {
    // Token rotation is optional; the initial sync can still be attempted.
  }

  void syncCurrentAndroidToken((): boolean => active);

  return (): void => {
    if (!active) return;
    active = false;
    tokenSubscription?.remove();
  };
}

/**
 * Revokes all current-user push tokens without delaying logout.
 *
 * @returns A promise that always resolves after the best-effort request finishes or fails.
 */
export async function revokeRegisteredAndroidPushToken(): Promise<void> {
  try {
    await pushTokensAPI.revoke();
  } catch {
    // Push-token cleanup must never block logout or show a global error toast.
  }
}

/**
 * Starts the single root-level notification response observer and reads a cold-start response once.
 *
 * @returns A reference-counted cleanup function for the response observer.
 */
export function startNotificationResponseObserver(): () => void {
  configureNotificationHandling();

  if (Platform.OS === 'web') return (): void => {};

  if (responseSubscription === null) {
    try {
      responseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response: NotificationResponse): void => {
          queueNotificationResponse(response);
        },
      );
    } catch {
      responseSubscription = null;
    }
  }

  responseObserverReferences += 1;

  if (!hasReadLastNotificationResponse) {
    hasReadLastNotificationResponse = true;
    readLastNotificationResponse();
  }

  let released: boolean = false;
  return (): void => {
    if (released) return;
    released = true;
    responseObserverReferences -= 1;
    if (responseObserverReferences > 0) return;
    responseSubscription?.remove();
    responseSubscription = null;
  };
}

/**
 * Subscribes to changes in the validated pending notification target.
 *
 * @param listener - Callback invoked when a target is queued or completed.
 * @returns A cleanup function that removes the listener.
 */
export function subscribeToPendingNotification(listener: (target: Href | null) => void): () => void {
  pendingNotificationListeners.add(listener);
  listener(pendingNotification?.target ?? null);
  return (): void => {
    pendingNotificationListeners.delete(listener);
  };
}

/**
 * Returns the current validated notification target, if one is waiting for authenticated app readiness.
 *
 * @returns The typed Ganap detail href, or `null` when no target is pending.
 */
export function getPendingNotificationTarget(): Href | null {
  return pendingNotification?.target ?? null;
}

/**
 * Completes a notification navigation and clears its native cold-start response.
 *
 * @param target - The exact target returned before navigation.
 * @returns Nothing. A newer target is left queued if one replaced this target.
 */
export function completePendingNotification(target: Href): void {
  if (pendingNotification === null || pendingNotification.target !== target) return;

  pendingNotification = null;
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    // Older or non-native runtimes may not expose the native clearing method.
  }
  notifyPendingNotificationListeners(null);
}

/**
 * Reads the native cold-start response when the current SDK exposes it.
 *
 * @returns Nothing. Invalid or unavailable responses are ignored safely.
 */
function readLastNotificationResponse(): void {
  try {
    if (typeof Notifications.getLastNotificationResponse !== 'function') return;
    const response = Notifications.getLastNotificationResponse();
    if (response !== null) queueNotificationResponse(response);
  } catch {
    // A response API can be unavailable in a non-native runtime.
  }
}

/**
 * Queues a response only once after validating its data and routing it through the route table.
 *
 * @param response - Notification response emitted by Expo.
 * @returns Nothing.
 */
function queueNotificationResponse(response: NotificationResponse): void {
  const responseKey = getNotificationResponseKey(response);
  if (seenResponseKeys.has(responseKey)) return;

  seenResponseKeys.add(responseKey);
  if (seenResponseKeys.size > 32) {
    const oldestKey = seenResponseKeys.values().next().value;
    if (typeof oldestKey === 'string') seenResponseKeys.delete(oldestKey);
  }

  const target = notificationRoute(response.notification.request.content.data);
  if (target === null) return;

  pendingNotification = { target };
  notifyPendingNotificationListeners(target);
}

/**
 * Builds a stable key so cold-start reads and live listener delivery cannot navigate twice.
 *
 * @param response - Notification response emitted by Expo.
 * @returns A process-local response key.
 */
function getNotificationResponseKey(response: NotificationResponse): string {
  const data = response.notification.request.content.data;
  return response.notification.request.identifier || JSON.stringify(data) || '';
}

/**
 * Extracts a native Android token from Expo's platform union.
 *
 * @param deviceToken - Token returned by Expo or a rotation listener.
 * @returns The Android token, or `null` for another platform or malformed token data.
 */
function getAndroidTokenValue(deviceToken: DevicePushToken): string | null {
  if (deviceToken.type !== 'android' || typeof deviceToken.data !== 'string' || deviceToken.data.length === 0) {
    return null;
  }
  return deviceToken.data;
}

/**
 * Performs the startup token lookup and registration behind a non-throwing app lifecycle boundary.
 *
 * @param isActive - Callback indicating that the authenticated layout still owns this sync.
 * @returns A promise that always resolves after best-effort synchronization.
 */
async function syncCurrentAndroidToken(isActive: () => boolean): Promise<void> {
  try {
    const token = await getAndroidDevicePushToken();
    if (token === null || !isActive()) return;
    await registerAndroidToken(token);
  } catch {
    // Permission, native-module, and network failures are intentionally silent here.
  }
}

/**
 * Registers the token delivered by a rotation listener without fetching another token.
 *
 * @param deviceToken - Token delivered by Expo's rotation event.
 * @param isActive - Callback indicating that the authenticated layout still owns this sync.
 * @returns A promise that always resolves after best-effort synchronization.
 */
async function syncKnownAndroidToken(deviceToken: DevicePushToken, isActive: () => boolean): Promise<void> {
  const token = getAndroidTokenValue(deviceToken);
  if (token === null || !isActive()) return;

  try {
    await registerAndroidToken(token);
  } catch {
    // A rotated token can be retried by the next app startup without affecting the UI.
  }
}

/**
 * Sends an Android token to the API.
 *
 * @param token - Native Android token to associate with the current User.
 * @returns A promise that resolves after the API request.
 */
async function registerAndroidToken(token: string): Promise<void> {
  await pushTokensAPI.register({ token, platform: 'android' });
}

/**
 * Notifies local consumers of a pending-target change.
 *
 * @param target - Current target or `null` after successful handling.
 * @returns Nothing.
 */
function notifyPendingNotificationListeners(target: Href | null): void {
  pendingNotificationListeners.forEach((listener: (target: Href | null) => void): void => {
    listener(target);
  });
}
