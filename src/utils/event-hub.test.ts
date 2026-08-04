import { describe, expect, it } from '@jest/globals';
import { ErrorCodes } from '@/constants/errors';
import type { RegistrationStatus } from '@/types/ganap.types';
import { canAccessEventHub, isEventHubForbidden } from './event-hub';

describe('canAccessEventHub', () => {
  it.each<RegistrationStatus>(['REGISTERED', 'ATTENDED'])('allows %s', (status: RegistrationStatus): void => {
    expect(canAccessEventHub(status)).toBe(true);
  });

  it.each<RegistrationStatus | null | undefined>([
    'PENDING',
    'WAITLISTED',
    'CANCELLED',
    'REJECTED',
    'EVICTED',
    null,
    undefined,
  ])('denies %s', (status: RegistrationStatus | null | undefined): void => {
    expect(canAccessEventHub(status)).toBe(false);
  });
});

describe('isEventHubForbidden', () => {
  it('accepts a normalized error with status 403', () => {
    const error = Object.assign(new Error('Forbidden'), { status: 403 });
    expect(isEventHubForbidden(error)).toBe(true);
  });

  it('accepts a normalized error with errorCode FORBIDDEN', () => {
    const error = Object.assign(new Error('Forbidden'), { errorCode: ErrorCodes.FORBIDDEN });
    expect(isEventHubForbidden(error)).toBe(true);
  });

  it('rejects null', () => {
    expect(isEventHubForbidden(null)).toBe(false);
  });

  it('rejects a network error', () => {
    const error = Object.assign(new Error('Network Error'), { errorCode: ErrorCodes.NETWORK_ERROR });
    expect(isEventHubForbidden(error)).toBe(false);
  });

  it('rejects a 404', () => {
    const error = Object.assign(new Error('Not found'), { status: 404, errorCode: ErrorCodes.NOT_FOUND });
    expect(isEventHubForbidden(error)).toBe(false);
  });

  it('rejects an ordinary error with no status or code', () => {
    expect(isEventHubForbidden(new Error('Something went wrong'))).toBe(false);
  });
});
