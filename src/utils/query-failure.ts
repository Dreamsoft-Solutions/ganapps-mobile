import type { FetchStatus } from '@tanstack/react-query';
import { ErrorCodes } from '@/constants/errors';
import type { ParsedApiError } from '@/utils/error-handling';

/** The parts of a TanStack Query result that decide whether a screen shows an error. */
interface QueryFailureSource {
  data: unknown;
  error: Error | null;
  fetchStatus: FetchStatus;
}

/** Shown when a screen has nothing cached and the device is offline. */
export const OFFLINE_LOAD_MESSAGE = "You're offline. Connect to the internet to load this.";

/** Shown by `ErrorView` instead of Axios's "Network Error" when a request got no response. */
export const NETWORK_LOAD_MESSAGE = "Couldn't connect. Check your connection and try again.";

/**
 * Returns whether a query or mutation failed because the request got no response.
 *
 * @param error - The rejection, usually a `ParsedApiError` from the API layer
 * @returns `true` for offline, timeout, and other transport failures
 */
export function isNetworkFailure(error: Error): boolean {
  return (error as ParsedApiError).errorCode === ErrorCodes.NETWORK_ERROR;
}

/**
 * Decides which error, if any, a screen should show in place of its content.
 *
 * A screen with cached data keeps showing it when a refresh fails for lack of a
 * connection; a server error still replaces it. A screen with nothing cached shows the
 * failure, or an offline message while the query waits for the connection to return.
 *
 * @param query - The query result the screen renders
 * @returns The error to show, or `null` to render the content
 */
export function getQueryFailure(query: QueryFailureSource): Error | null {
  if (query.data !== undefined) {
    return query.error !== null && !isNetworkFailure(query.error) ? query.error : null;
  }
  if (query.error !== null) return query.error;
  return query.fetchStatus === 'paused' ? new Error(OFFLINE_LOAD_MESSAGE) : null;
}
