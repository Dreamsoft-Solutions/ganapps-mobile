import { ErrorCodes, ErrorMessages } from '@/constants/errors';
import { showToast } from '@/store/toast.store';

/** User-facing content for a single error toast. */
export interface ToastMessage {
  /** Primary line; the mapped copy for known codes, the error message otherwise. */
  title: string;
  /** Optional secondary line with the server's own message when it differs. */
  message?: string;
}

/** Shown when an error carries neither a mapped code nor a message. */
export const DEFAULT_TOAST_TITLE = 'An unexpected error occurred';

/**
 * Error codes that must not toast. Navigation already handles the auth
 * redirects (auto-logout, verify-email), and the auth forms already render the
 * remaining ones inline from `mutation.error`.
 */
const SUPPRESSED_ERROR_CODES: ReadonlySet<string> = new Set([
  ErrorCodes.UNAUTHORIZED,
  ErrorCodes.REFRESH_TOKEN_EXPIRED,
  ErrorCodes.REFRESH_TOKEN_REVOKED,
  ErrorCodes.TOKEN_THEFT_DETECTED,
  ErrorCodes.EMAIL_NOT_VERIFIED,
  ErrorCodes.INVALID_INPUT,
  ErrorCodes.INVALID_CREDENTIALS,
  ErrorCodes.USER_ALREADY_EXISTS,
  ErrorCodes.INVALID_VERIFICATION_CODE,
  ErrorCodes.VERIFICATION_CODE_EXPIRED,
]);

/**
 * Converts a failed fetch into toast content, or `null` when the error must
 * not be toasted (suppressed code, or not an Error at all).
 *
 * Known codes map to the friendly copy in `ErrorMessages`; the error message
 * becomes the secondary line only when it came from the server (transport
 * messages like axios's "Network Error" are never surfaced).
 *
 * @param error - The rejection from a query or mutation.
 * @returns The toast content, or `null` when suppressed.
 */
export function errorToToastMessage(error: unknown): ToastMessage | null {
  if (!(error instanceof Error)) return null;

  const code = (error as Error & { errorCode?: string }).errorCode;
  if (code !== undefined && SUPPRESSED_ERROR_CODES.has(code)) return null;

  const mappedTitle = code !== undefined ? ErrorMessages[code] : undefined;
  const title = mappedTitle ?? (error.message || DEFAULT_TOAST_TITLE);

  const status = (error as Error & { status?: number }).status;
  const message = status !== undefined && error.message !== title ? error.message : undefined;

  return { title, message };
}

/**
 * Shows an error toast for a failed query or mutation, unless the error is
 * suppressed.
 *
 * @param error - The rejection from a query or mutation.
 */
export function showErrorToast(error: unknown): void {
  const message = errorToToastMessage(error);
  if (message === null) return;
  showToast('error', message.title, message.message);
}
