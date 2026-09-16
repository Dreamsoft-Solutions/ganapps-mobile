import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/api/types/api-error';
import { ErrorCodes } from '@/constants/errors';

/** Normalized error metadata consumed by inline retry and access surfaces. */
export interface ParsedApiError extends Error {
  errorCode?: string;
  status?: number;
  retryAfterSeconds?: number;
  retryAt?: string;
}

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
 * @returns An Error carrying optional server code, status, and retry delay
 */
export function parseApiError(error: AxiosError): ParsedApiError {
  const data = error.response?.data as ApiErrorResponse | undefined;

  const customError = new Error(data?.message || error.message || 'An unexpected error occurred') as ParsedApiError;
  customError.errorCode = data?.errorCode ?? (error.response === undefined ? ErrorCodes.NETWORK_ERROR : undefined);
  customError.status = data?.statusCode ?? error.response?.status;
  const retryAt: unknown = data?.retryAt ?? data?.details?.retryAt;
  if (typeof retryAt === 'string' && !Number.isNaN(new Date(retryAt).getTime())) customError.retryAt = retryAt;

  const retryAfterSeconds: unknown = data?.details?.retryAfterSeconds ?? error.response?.headers?.['retry-after'];
  if (typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    customError.retryAfterSeconds = retryAfterSeconds;
  } else if (typeof retryAfterSeconds === 'string') {
    const parsedRetryAfterSeconds: number = Number(retryAfterSeconds);
    if (Number.isFinite(parsedRetryAfterSeconds) && parsedRetryAfterSeconds > 0) {
      customError.retryAfterSeconds = parsedRetryAfterSeconds;
    }
  }

  return customError;
}
