import { describe, expect, it } from '@jest/globals';
import { Routes } from '@/constants/routes';
import { notificationRoute, parseNotificationData } from './notification';

const validData = {
  type: 'REGISTRATION_STATUS_UPDATED' as const,
  notificationId: 'notification-1',
  registrationId: 'registration-1',
  ganapId: 'ganap-1',
  registrationStatus: 'WAITLISTED' as const,
};

describe('parseNotificationData', (): void => {
  it('accepts the registration-status contract', (): void => {
    expect(parseNotificationData(validData)).toEqual(validData);
  });

  it('rejects arbitrary URL fields instead of routing them', (): void => {
    expect(parseNotificationData({ ...validData, url: 'https://malicious.example' })).toBeNull();
  });

  it('rejects malformed status, missing IDs, and unsafe route IDs', (): void => {
    expect(parseNotificationData({ ...validData, registrationStatus: 'PENDING' })).toBeNull();
    expect(parseNotificationData({ ...validData, ganapId: '' })).toBeNull();
    expect(parseNotificationData({ ...validData, ganapId: '../settings' })).toBeNull();
    expect(parseNotificationData({ ...validData, notificationId: null })).toBeNull();
  });

  it('allows the optional identifiers to be omitted', (): void => {
    expect(
      parseNotificationData({
        type: 'REGISTRATION_STATUS_UPDATED',
        ganapId: 'ganap-1',
        registrationStatus: 'REGISTERED',
      }),
    ).toEqual({
      type: 'REGISTRATION_STATUS_UPDATED',
      ganapId: 'ganap-1',
      registrationStatus: 'REGISTERED',
    });
  });
});

describe('notificationRoute', (): void => {
  it('maps valid data to the typed Ganap detail route', (): void => {
    expect(notificationRoute(validData)).toEqual(Routes.ganapDetail('ganap-1'));
  });

  it('does not return a route for malformed data', (): void => {
    expect(notificationRoute({ type: 'REGISTRATION_STATUS_UPDATED', ganapId: 'https://example.com' })).toBeNull();
  });
});
