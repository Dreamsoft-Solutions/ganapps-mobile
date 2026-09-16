import { ErrorCodes } from '@/constants/errors';
import type { RegistrationStatus } from '@/types/ganap.types';

/** An error shape carrying the normalized fields `parseApiError` attaches. */
type NormalizedError = Error & { errorCode?: string; status?: number };

/**
 * Decides whether a registration status may enter Event Hub.
 *
 * Only `REGISTERED` and `ATTENDED` students may enter, per the approved DS-42
 * access rule. This is stricter than the server's announcement guard, which
 * only checks that a registration row exists in any status.
 *
 * @param status - The caller's registration status for the Ganap, or null/undefined when absent
 * @returns True when Event Hub access is allowed
 */
export function canAccessEventHub(status: RegistrationStatus | null | undefined): boolean {
  return status === 'REGISTERED' || status === 'ATTENDED';
}

/**
 * Decides whether a normalized error represents a lost or denied Event Hub
 * announcement access (an HTTP 403).
 *
 * @param error - A normalized error, or null when there is no error
 * @returns True when the error's status is 403 or its error code is `FORBIDDEN`
 */
export function isEventHubForbidden(error: Error | null): boolean {
  if (!error) return false;
  const normalized = error as NormalizedError;
  return normalized.status === 403 || normalized.errorCode === ErrorCodes.FORBIDDEN;
}
