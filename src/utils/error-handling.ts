import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/api/types/api-error';
import { ErrorCodes } from '@/constants/errors';

/**
 * Converts an Axios rejection into a plain Error carrying the server's error code
 * and HTTP status.
 *
 * The status is read from the error envelope's `statusCode` where present, falling
 * back to the transport status. It is absent entirely for network failures that
 * never reached the server, which is how callers tell "the request was rejected"
 * from "the request never arrived" — the offline outbox depends on that
 * distinction.
 *
 * Transport failures are stamped with `NETWORK_ERROR` so error-driven surfaces
 * (toasts) can show friendly copy instead of axios's "Network Error".
 *
 * @param error - The rejected Axios error
 * @returns An Error carrying optional `errorCode` and `status`
 */
export function parseApiError(error: AxiosError): Error & { errorCode?: string; status?: number } {
  const data = error.response?.data as ApiErrorResponse | undefined;

  const customError = new Error(data?.message || error.message || 'An unexpected error occurred') as Error & {
    errorCode?: string;
    status?: number;
  };
  customError.errorCode = data?.errorCode ?? (error.response === undefined ? ErrorCodes.NETWORK_ERROR : undefined);
  customError.status = data?.statusCode ?? error.response?.status;

  return customError;
}
