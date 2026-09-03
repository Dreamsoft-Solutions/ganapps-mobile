import { ErrorCodes, ErrorMessages } from '@/constants/errors';
import type { ParsedApiError } from './error-handling';

/** The exact case-insensitive Crockford alphabet accepted by the server. */
export const FRIEND_CODE_ALPHABET: string = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Friend Codes are always exactly twelve characters after normalization. */
export const FRIEND_CODE_LENGTH: number = 12;

/**
 * Removes readability separators and normalizes a Friend Code for transport.
 *
 * @param value - Raw code from a User or input field
 * @returns Uppercase code with spaces and hyphens removed
 */
export function normalizeFriendCode(value: string): string {
  return value.trim().replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Validates the client-visible shape without deciding whether a code exists.
 *
 * @param value - Raw or normalized Friend Code
 * @returns Whether the value has the server's twelve-character Crockford shape
 */
export function isValidFriendCode(value: string): boolean {
  const normalized: string = normalizeFriendCode(value);
  return (
    normalized.length === FRIEND_CODE_LENGTH &&
    [...normalized].every((character: string): boolean => FRIEND_CODE_ALPHABET.includes(character))
  );
}

/**
 * Groups a valid or server-returned code for readability without changing its value.
 *
 * @param value - Friend Code to display
 * @returns Code grouped into three four-character chunks
 */
export function formatFriendCode(value: string): string {
  const normalized: string = normalizeFriendCode(value);
  return normalized.match(/.{1,4}/g)?.join(' ') ?? normalized;
}

/**
 * Reads an ISO retry timestamp from a normalized API error.
 *
 * @param error - Error returned by the API interceptor
 * @returns The server retry timestamp, or `null` when none was supplied
 */
export function getFriendRetryAt(error: Error | null | undefined): string | null {
  if (!error) return null;
  const parsed: ParsedApiError = error as ParsedApiError;
  return typeof parsed.retryAt === 'string' && parsed.retryAt.length > 0 ? parsed.retryAt : null;
}

/**
 * Maps stable social error codes to non-disclosing UI copy.
 *
 * @param error - Error returned by the API interceptor
 * @param fallback - Safe copy for unknown failures
 * @returns User-facing social error copy
 */
export function getFriendErrorMessage(error: Error | null | undefined, fallback: string): string {
  if (!error) return fallback;
  const errorCode: string | undefined = (error as ParsedApiError).errorCode;
  if (errorCode === ErrorCodes.FRIEND_CODE_NOT_FOUND) return 'That Friend Code is not available.';
  if (errorCode === ErrorCodes.SOCIAL_TARGET_UNAVAILABLE) return 'This person is not available to add.';
  if (errorCode === ErrorCodes.ALREADY_FRIENDS) return 'You are already friends.';
  if (errorCode === ErrorCodes.FRIEND_REQUEST_COOLDOWN) {
    const retryAt: string | null = getFriendRetryAt(error);
    return retryAt ? formatFriendRetryWarning(retryAt) : 'This friend request is cooling down.';
  }
  if (errorCode === ErrorCodes.FRIEND_CODE_RATE_LIMITED) {
    const retryAt: string | null = getFriendRetryAt(error);
    return retryAt ? formatFriendRetryWarning(retryAt) : 'Friend Code actions are temporarily limited.';
  }
  if (errorCode && ErrorMessages[errorCode]) return ErrorMessages[errorCode];
  return fallback;
}

/**
 * Formats a server retry timestamp in the device's local timezone.
 *
 * @param retryAt - ISO timestamp supplied by the server
 * @param locale - Optional locale override for deterministic presentation/tests
 * @param timeZone - Optional IANA timezone override; defaults to the device zone
 * @returns Exact local retry warning, or a safe generic warning for malformed input
 */
export function formatFriendRetryWarning(retryAt: string, locale?: string, timeZone?: string): string {
  const date: Date = new Date(retryAt);
  if (Number.isNaN(date.getTime())) return 'Try again later.';

  const resolvedTimeZone: string = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const dateFormatter: Intl.DateTimeFormat = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: resolvedTimeZone,
    year: 'numeric',
  });
  const timeFormatter: Intl.DateTimeFormat = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: resolvedTimeZone,
  });
  return `Try again after ${dateFormatter.format(date)} at ${timeFormatter.format(date)} (${resolvedTimeZone}).`;
}
