import { getMessaging, getToken, onTokenRefresh } from '@react-native-firebase/messaging';
import type { EventSubscription } from 'expo-modules-core';
import type {
  DevicePushToken,
  Notification,
  NotificationBehavior,
  NotificationChannelInput,
  NotificationPermissionsStatus,
  NotificationResponse,
  NotificationTrigger,
} from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import type { Href } from 'expo-router';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { pushTokensAPI } from '@/api/endpoints/push-tokens';
import type { NotificationData } from '@/types/notification.types';
import { notificationRoute, parseNotificationData, pickNotificationDataFields } from '@/utils/notification';

/** Stable Android channel used for registration-status notifications. */
export const ANDROID_NOTIFICATION_CHANNEL_ID: string = 'registration-status';

/** Longest logout waits for each push-token revoke attempt before it signs the session out anyway. */
export const PUSH_TOKEN_REVOKE_TIMEOUT_MS: number = 5000;

/** Native source that produced a validated registration-status notification delivery. */
export type NotificationDeliverySource = 'foreground' | 'response' | 'cold-start';

/** Validated notification data and the native lifecycle event that delivered it. */
export interface NotificationDelivery {
  data: NotificationData;
  source: NotificationDeliverySource;
}

/** Receives validated notification data before response navigation is queued. */
export type NotificationDataListener = (delivery: NotificationDelivery) => void;

const ANDROID_NOTIFICATION_CHANNEL: NotificationChannelInput = {
  name: 'Registration status',
  importance: Notifications.AndroidImportance.DEFAULT,
  sound: 'default',
  vibrationPattern: [0, 250, 250, 250],
  lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  showBadge: true,
};

let notificationHandlerConfigured: boolean = false;
let foregroundSubscription: EventSubscription | null = null;
let responseSubscription: EventSubscription | null = null;
let responseObserverReferences: number = 0;
let hasReadLastNotificationResponse: boolean = false;
let pendingNotification: { target: Href } | null = null;
const seenResponseKeys: Set<string> = new Set();
const notificationDataListeners: Set<NotificationDataListener> = new Set();
const pendingNotificationListeners: Set<(target: Href | null) => void> = new Set();
let activeIosTokenSync: IosPushTokenSync | null = null;
let pushTokenRegistrationSuspended: boolean = false;

/** Lifetime of one signed-in iOS token sync, and the token it last sent to the API. */
interface IosPushTokenSync {
  isActive: () => boolean;
  registeredToken: string | null;
}

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
async function getAndroidDevicePushToken(): Promise<string | null> {
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
function startAndroidPushTokenSync(): () => void {
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
 * Stops registering tokens and revokes every push token the server holds for the current User.
 *
 * Logout awaits this before it ends the session: once logout has revoked the access token, the server answers this
 * request with 401 and the tokens stay registered. Registration stays suspended until the next
 * {@link startPushTokenSync}, so a token rotated during logout cannot be registered again for the User signing out.
 * Each request attempt is capped at {@link PUSH_TOKEN_REVOKE_TIMEOUT_MS}.
 *
 * @returns A promise that always resolves after the best-effort request finishes, fails or times out.
 */
export async function revokeRegisteredPushTokens(): Promise<void> {
  pushTokenRegistrationSuspended = true;
  try {
    await pushTokensAPI.revoke({ timeout: PUSH_TOKEN_REVOKE_TIMEOUT_MS });
  } catch {
    // Push-token cleanup must never block logout or show a global error toast.
  }
}

/**
 * Starts push-token synchronization for the signed-in User and re-registers every rotated token.
 *
 * Android asks for notification permission here whenever it is not granted, as it always has. iOS only reads the
 * permission here; its prompt waits for {@link requestPushPermissionInContext}.
 *
 * @returns A cleanup function that stops the rotation listener and invalidates in-flight startup work.
 */
export function startPushTokenSync(): () => void {
  pushTokenRegistrationSuspended = false;
  if (Platform.OS === 'ios') return startIosPushTokenSync();
  return startAndroidPushTokenSync();
}

/**
 * Shows the iOS notification prompt right after the User registers for an event, then registers the token.
 *
 * iOS shows its system prompt once per install, so it waits for a moment the User can connect it to: updates about the
 * registration they just made (ADR 0008). It does nothing:
 *
 * - on Android, which asks on the first signed-in launch;
 * - once the User has answered the iOS prompt, either way;
 * - while no signed-in token sync is running.
 *
 * @returns A promise that always resolves. Permission, token and network failures stay silent.
 */
export async function requestPushPermissionInContext(): Promise<void> {
  const sync = activeIosTokenSync;
  if (Platform.OS !== 'ios' || sync === null) return;

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.ios?.status !== Notifications.IosAuthorizationStatus.NOT_DETERMINED || !sync.isActive()) return;
    const requested = await Notifications.requestPermissionsAsync();
    if (!isIosPushAuthorized(requested)) return;
  } catch {
    return;
  }

  await syncCurrentIosToken(sync);
}

/**
 * Starts the single root-level notification response observer and reads a cold-start response once.
 *
 * @param listener - Optional callback for validated foreground, response, and cold-start deliveries.
 * @returns A reference-counted cleanup function for the response observer.
 */
export function startNotificationResponseObserver(listener?: NotificationDataListener): () => void {
  configureNotificationHandling();

  if (Platform.OS === 'web') return (): void => {};

  if (listener !== undefined) notificationDataListeners.add(listener);

  if (foregroundSubscription === null) {
    try {
      foregroundSubscription = Notifications.addNotificationReceivedListener((notification: Notification): void => {
        emitNotificationDelivery(getNotificationDataValue(notification), 'foreground');
      });
    } catch {
      foregroundSubscription = null;
    }
  }

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
    if (listener !== undefined) notificationDataListeners.delete(listener);
    responseObserverReferences -= 1;
    if (responseObserverReferences > 0) return;
    foregroundSubscription?.remove();
    foregroundSubscription = null;
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
    if (response !== null) queueNotificationResponse(response, 'cold-start');
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
function queueNotificationResponse(
  response: NotificationResponse,
  source: 'response' | 'cold-start' = 'response',
): void {
  const responseKey = getNotificationResponseKey(response);
  if (seenResponseKeys.has(responseKey)) return;

  seenResponseKeys.add(responseKey);
  if (seenResponseKeys.size > 32) {
    const oldestKey = seenResponseKeys.values().next().value;
    if (typeof oldestKey === 'string') seenResponseKeys.delete(oldestKey);
  }

  const notificationValue = getNotificationDataValue(response.notification);
  const data = emitNotificationDelivery(notificationValue, source);
  if (data === null) return;

  const target = notificationRoute(notificationValue);
  if (target === null) return;

  pendingNotification = { target };
  notifyPendingNotificationListeners(target);
}

/**
 * Validates a native notification payload and delivers it to active consumers.
 *
 * @param value - Unknown data received from Expo Notifications.
 * @param source - Native lifecycle source for this delivery.
 * @returns The validated data, or `null` when the payload is unsupported.
 */
function emitNotificationDelivery(value: unknown, source: NotificationDeliverySource): NotificationData | null {
  const data = parseNotificationData(value);
  if (data === null) return null;

  const delivery: NotificationDelivery = { data, source };
  notificationDataListeners.forEach((listener: NotificationDataListener): void => {
    listener(delivery);
  });
  return data;
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
 * Sends an Android token to the API, unless a logout has suspended registration.
 *
 * @param token - Native Android token to associate with the current User.
 * @returns A promise that resolves after the API request, or at once while registration is suspended.
 */
async function registerAndroidToken(token: string): Promise<void> {
  if (pushTokenRegistrationSuspended) return;
  await pushTokensAPI.register({ token, platform: 'android' });
}

/**
 * Starts iOS token synchronization without prompting, and follows Firebase token rotation.
 *
 * It registers a token only when the User already allows notifications, and checks again each time the app returns to
 * the foreground, which covers notifications turned on in iOS Settings and a registration that failed earlier. The
 * prompt itself waits for {@link requestPushPermissionInContext}, which reuses this sync through `activeIosTokenSync`.
 *
 * @returns A cleanup function that stops the listeners and invalidates in-flight work.
 */
function startIosPushTokenSync(): () => void {
  let active: boolean = true;
  const sync: IosPushTokenSync = { isActive: (): boolean => active, registeredToken: null };
  let unsubscribeTokenRefresh: (() => void) | null = null;
  activeIosTokenSync = sync;

  try {
    unsubscribeTokenRefresh = onTokenRefresh(getMessaging(), (token: string): void => {
      if (!active) return;
      void syncRotatedIosToken(token, sync);
    });
  } catch {
    unsubscribeTokenRefresh = null;
  }

  const appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus): void => {
    if (state === 'active' && active) void syncCurrentIosToken(sync);
  });

  void syncCurrentIosToken(sync);

  return (): void => {
    if (!active) return;
    active = false;
    if (activeIosTokenSync === sync) activeIosTokenSync = null;
    unsubscribeTokenRefresh?.();
    appStateSubscription.remove();
  };
}

/**
 * Reads the iOS Firebase Cloud Messaging token without showing the permission prompt.
 *
 * React Native Firebase registers the app with APNs at launch, so Firebase can issue the token as soon as the User has
 * allowed notifications.
 *
 * @returns The token, or `null` while the User has not allowed notifications.
 * @throws Re-throws native permission/token errors for the caller's best-effort boundary.
 */
async function getIosPushToken(): Promise<string | null> {
  const permissions = await Notifications.getPermissionsAsync();
  if (!isIosPushAuthorized(permissions)) return null;

  const token = await getToken(getMessaging());
  return token.length > 0 ? token : null;
}

/**
 * Tells whether iOS will deliver notifications to this app.
 *
 * Expo reports provisional and ephemeral authorization as `undetermined`, so this reads the native iOS status.
 *
 * @param permissions - Permission status returned by Expo Notifications.
 * @returns `true` when iOS has authorized notifications, provisionally or fully.
 */
function isIosPushAuthorized(permissions: NotificationPermissionsStatus): boolean {
  const status = permissions.ios?.status;
  return (
    status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    status === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

/**
 * Registers the current iOS token, if the User allows notifications, behind a non-throwing boundary.
 *
 * @param sync - The signed-in sync this registration belongs to.
 * @returns A promise that always resolves. A failed registration is retried on the next foreground.
 */
async function syncCurrentIosToken(sync: IosPushTokenSync): Promise<void> {
  try {
    const token = await getIosPushToken();
    if (token !== null) await registerIosToken(token, sync);
  } catch {
    return;
  }
}

/**
 * Registers a token Firebase rotated or re-issued on iOS, if the User allows notifications.
 *
 * Firebase reports the current token on every launch, including before the User has answered the prompt, so the
 * permission is checked here rather than assumed.
 *
 * @param token - Token delivered by Firebase's token-refresh event.
 * @param sync - The signed-in sync this registration belongs to.
 * @returns A promise that always resolves. A failed registration is retried on the next foreground.
 */
async function syncRotatedIosToken(token: string, sync: IosPushTokenSync): Promise<void> {
  if (token.length === 0) return;

  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (isIosPushAuthorized(permissions)) await registerIosToken(token, sync);
  } catch {
    return;
  }
}

/**
 * Sends an iOS token to the API once per signed-in sync.
 *
 * The startup read, Firebase's launch-time refresh event and each return to the foreground all report the same token,
 * so a token this sync has already sent, or is sending, is skipped. A failed request clears it for the next attempt.
 *
 * @param token - Firebase Cloud Messaging token to associate with the current User.
 * @param sync - The signed-in sync this registration belongs to.
 * @returns A promise that resolves after the API request, or at once when there is nothing to send.
 * @throws Re-throws the API error after clearing the token, for the caller's best-effort boundary.
 */
async function registerIosToken(token: string, sync: IosPushTokenSync): Promise<void> {
  if (!sync.isActive() || pushTokenRegistrationSuspended || sync.registeredToken === token) return;

  sync.registeredToken = token;
  try {
    await pushTokensAPI.register({ token, platform: 'ios' });
  } catch (error) {
    if (sync.registeredToken === token) sync.registeredToken = null;
    throw error;
  }
}

/**
 * Reads the server's data fields from a delivered notification.
 *
 * Android and local notifications carry them in `content.data`. Expo fills that on iOS only from the `body` key its own
 * push service writes, while Firebase puts the server's fields at the top level of the APNs payload. For an iOS push
 * whose `content.data` holds no valid fields, they are picked from the trigger's payload instead.
 *
 * @param notification - Notification delivered by Expo.
 * @returns The unvalidated data, for {@link parseNotificationData} and {@link notificationRoute}.
 */
function getNotificationDataValue(notification: Notification): unknown {
  const { content, trigger } = notification.request;
  if (Platform.OS !== 'ios' || parseNotificationData(content.data) !== null) return content.data;

  const payload = getIosPushPayload(trigger);
  return payload === undefined ? content.data : pickNotificationDataFields(payload);
}

/**
 * Returns the full APNs payload of an iOS push trigger.
 *
 * @param trigger - Trigger of a delivered notification.
 * @returns The payload, or `undefined` for local notifications and triggers without one.
 */
function getIosPushPayload(trigger: NotificationTrigger): unknown {
  if (trigger === null || typeof trigger !== 'object' || !('type' in trigger) || trigger.type !== 'push') {
    return undefined;
  }
  return 'payload' in trigger ? trigger.payload : undefined;
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
