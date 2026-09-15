import { describe, expect, it } from '@jest/globals';
import { AxiosError, AxiosHeaders } from 'axios';
import { ErrorCodes } from '@/constants/errors';
import { parseApiError } from './error-handling';

function axiosError(response?: { status: number; data: unknown }, message = 'Request failed'): AxiosError {
  const error = new AxiosError(
    message,
    undefined,
    undefined,
    undefined,
    response
      ? {
          data: response.data,
          status: response.status,
          statusText: 'ERROR',
          headers: {},
          config: { headers: new AxiosHeaders() },
        }
      : undefined,
  );
  return error;
}

describe('parseApiError', (): void => {
  it('extracts the message and error code from the server envelope', (): void => {
    const error = parseApiError(
      axiosError({
        status: 404,
        data: {
          success: false,
          statusCode: 404,
          errorCode: ErrorCodes.NOT_FOUND,
          message: 'Ganap not found',
          timestamp: 'now',
        },
      }),
    );

    expect(error.message).toBe('Ganap not found');
    expect(error.errorCode).toBe(ErrorCodes.NOT_FOUND);
    expect(error.status).toBe(404);
  });

  it('stamps NETWORK_ERROR when the request never reached the server', (): void => {
    const error = parseApiError(axiosError());

    expect(error.errorCode).toBe(ErrorCodes.NETWORK_ERROR);
    expect(error.status).toBeUndefined();
  });

  it('falls back to the transport status when the envelope lacks one', (): void => {
    const error = parseApiError(
      axiosError({
        status: 500,
        data: {
          success: false,
          statusCode: 500,
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
          message: 'boom',
          timestamp: 'now',
        },
      }),
    );

    expect(error.status).toBe(500);
  });

  it('falls back to a default message when nothing is available', (): void => {
    const error = parseApiError(
      axiosError(
        {
          status: 502,
          data: { success: false, statusCode: 502, errorCode: 'UNKNOWN_CODE', message: '', timestamp: 'now' },
        },
        '',
      ),
    );

    expect(error.message).toBe('An unexpected error occurred');
  });

  it('preserves a positive media Retry-After value from the envelope or header', (): void => {
    const error = parseApiError(
      axiosError({
        status: 503,
        data: {
          success: false,
          statusCode: 503,
          errorCode: ErrorCodes.MEDIA_CAPACITY_EXCEEDED,
          message: 'Media pipeline is busy',
          details: { retryAfterSeconds: 2 },
          timestamp: 'now',
        },
      }),
    );

    expect(error.retryAfterSeconds).toBe(2);
  });

  it('ignores non-positive Retry-After values', (): void => {
    const error = parseApiError(
      axiosError({
        status: 503,
        data: {
          success: false,
          statusCode: 503,
          errorCode: ErrorCodes.MEDIA_CAPACITY_EXCEEDED,
          message: 'Media pipeline is busy',
          details: { retryAfterSeconds: 0 },
          timestamp: 'now',
        },
      }),
    );

    expect(error.retryAfterSeconds).toBeUndefined();
  });
});
