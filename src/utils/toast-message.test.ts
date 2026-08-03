import { describe, expect, it } from '@jest/globals';
import { ErrorCodes } from '@/constants/errors';
import { DEFAULT_TOAST_TITLE, errorToToastMessage } from './toast-message';

function apiError(
  code: string | undefined,
  message: string,
  status?: number,
): Error & { errorCode?: string; status?: number } {
  const error = new Error(message) as Error & { errorCode?: string; status?: number };
  error.errorCode = code;
  if (status !== undefined) error.status = status;
  return error;
}

describe('errorToToastMessage', (): void => {
  it('maps a known error code to its friendly copy', (): void => {
    const result = errorToToastMessage(apiError(ErrorCodes.NOT_FOUND, 'Ganap not found', 404));

    expect(result).toEqual({
      title: 'The requested resource was not found',
      message: 'Ganap not found',
    });
  });

  it('uses the mapped copy as the title when the code is known', (): void => {
    const result = errorToToastMessage(apiError(ErrorCodes.NETWORK_ERROR, 'Network Error'));

    expect(result).toEqual({ title: 'No internet connection. Please check your network' });
  });

  it('falls back to the error message when the code is unknown', (): void => {
    const result = errorToToastMessage(apiError(undefined, 'Something broke', 500));

    expect(result).toEqual({ title: 'Something broke' });
  });

  it('falls back to a default title when there is no message', (): void => {
    const error = new Error();
    const result = errorToToastMessage(error);

    expect(result?.title).toBe(DEFAULT_TOAST_TITLE);
  });

  it('does not surface transport messages under a mapped title', (): void => {
    const result = errorToToastMessage(
      apiError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Request failed with status code 500'),
    );

    expect(result).toEqual({
      title: 'Something went wrong. Please try again later',
    });
  });

  it('suppresses auth redirect codes handled by navigation', (): void => {
    const redirectCodes = [
      ErrorCodes.UNAUTHORIZED,
      ErrorCodes.REFRESH_TOKEN_EXPIRED,
      ErrorCodes.REFRESH_TOKEN_REVOKED,
      ErrorCodes.TOKEN_THEFT_DETECTED,
      ErrorCodes.EMAIL_NOT_VERIFIED,
    ];

    for (const code of redirectCodes) {
      expect(errorToToastMessage(apiError(code, 'blocked'))).toBeNull();
    }
  });

  it('suppresses codes already rendered inline by forms', (): void => {
    const inlineCodes = [
      ErrorCodes.INVALID_INPUT,
      ErrorCodes.INVALID_CREDENTIALS,
      ErrorCodes.USER_ALREADY_EXISTS,
      ErrorCodes.INVALID_VERIFICATION_CODE,
      ErrorCodes.VERIFICATION_CODE_EXPIRED,
    ];

    for (const code of inlineCodes) {
      expect(errorToToastMessage(apiError(code, 'blocked'))).toBeNull();
    }
  });

  it('returns null for non-Error values', (): void => {
    expect(errorToToastMessage('oops')).toBeNull();
    expect(errorToToastMessage(undefined)).toBeNull();
  });
});
