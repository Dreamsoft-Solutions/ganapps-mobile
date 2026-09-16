import type { Href } from 'expo-router';
import { Routes } from '@/constants/routes';
import type { NotificationData, RegistrationStatusNotificationStatus } from '@/types/notification.types';

const NOTIFICATION_DATA_KEYS: ReadonlySet<string> = new Set([
  'type',
  'notificationId',
  'registrationId',
  'ganapId',
  'registrationStatus',
]);

const NOTIFICATION_STATUSES: ReadonlySet<RegistrationStatusNotificationStatus> = new Set([
  'REGISTERED',
  'WAITLISTED',
  'REJECTED',
]);

/**
 * Narrows an unknown notification payload to a plain string-keyed record.
 *
 * @param value - Value received from Expo notification data.
 * @returns `true` when the value can be inspected as an object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks that a notification field is a non-empty string.
 *
 * @param value - Unknown field value.
 * @returns `true` when the value is a non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Checks that an identifier is safe to put in the typed dynamic route.
 *
 * @param value - Unknown Ganap identifier.
 * @returns `true` when the identifier contains only route-safe characters.
 */
function isSafeGanapId(value: unknown): value is string {
  return isNonEmptyString(value) && /^[A-Za-z0-9_-]+$/.test(value);
}

/**
 * Validates the supported notification data contract without accepting arbitrary URLs or fields.
 *
 * @param value - Unknown data from an Expo notification response.
 * @returns The validated registration-status data, or `null` for malformed data.
 */
export function parseNotificationData(value: unknown): NotificationData | null {
  if (!isRecord(value)) return null;
  if (!Object.keys(value).every((key: string): boolean => NOTIFICATION_DATA_KEYS.has(key))) return null;
  if (value.type !== 'REGISTRATION_STATUS_UPDATED') return null;
  if (!isSafeGanapId(value.ganapId)) return null;
  if (
    typeof value.registrationStatus !== 'string' ||
    !NOTIFICATION_STATUSES.has(value.registrationStatus as RegistrationStatusNotificationStatus)
  ) {
    return null;
  }
  if (value.notificationId !== undefined && !isNonEmptyString(value.notificationId)) return null;
  if (value.registrationId !== undefined && !isNonEmptyString(value.registrationId)) return null;

  const data: NotificationData = {
    type: 'REGISTRATION_STATUS_UPDATED',
    ganapId: value.ganapId,
    registrationStatus: value.registrationStatus as RegistrationStatusNotificationStatus,
  };

  if (value.notificationId !== undefined) data.notificationId = value.notificationId;
  if (value.registrationId !== undefined) data.registrationId = value.registrationId;

  return data;
}

/**
 * Converts valid notification data into the only route supported by this notification flow.
 *
 * @param value - Unknown data from an Expo notification response.
 * @returns A typed Ganap detail href, or `null` when validation fails.
 */
export function notificationRoute(value: unknown): Href | null {
  const data = parseNotificationData(value);
  return data === null ? null : Routes.ganapDetail(data.ganapId);
}
