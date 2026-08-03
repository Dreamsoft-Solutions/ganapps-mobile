import { describe, expect, it } from '@jest/globals';
import type { GanapDetail, RegistrationStatus } from '@/types/ganap.types';
import {
  buildGanapShareMessage,
  getGanapActionModel,
  getGanapCapacityModel,
  getGanapScheduleModel,
} from './ganap-detail';

function ganapWith(overrides: Partial<GanapDetail>): GanapDetail {
  return {
    id: 'ganap_1',
    businessId: 'business_1',
    businessName: 'CPU Developers',
    slug: 'coffee-and-code',
    title: 'Coffee & Code',
    description: 'Bring a laptop.',
    address: 'Student Union',
    locationLat: 10.7313,
    locationLong: 122.5489,
    startDate: '2026-08-08T02:00:00.000Z',
    endDate: '2026-08-08T05:00:00.000Z',
    status: 'PUBLISHED',
    requiresApproval: false,
    maxAttendees: 20,
    tags: ['study'],
    registrationCount: 5,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    myRegistration: null,
    ...overrides,
  };
}

function withRegistration(status: RegistrationStatus): Partial<GanapDetail> {
  return {
    myRegistration: {
      id: 'registration_1',
      status,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  };
}

const BEFORE_EVENT = new Date('2026-08-07T00:00:00.000Z');
const registrationCases: Array<[RegistrationStatus, string, string | null]> = [
  ['REGISTERED', 'Joined', 'Leave event'],
  ['PENDING', 'Awaiting approval', 'Cancel request'],
  ['WAITLISTED', 'On the waitlist', 'Leave waitlist'],
  ['ATTENDED', 'Attended', null],
  ['REJECTED', 'Request declined', null],
  ['EVICTED', 'Removed', null],
  ['CANCELLED', 'Registration cancelled', null],
];

describe('getGanapCapacityModel', (): void => {
  it('invites the first attendee when capacity is available', (): void => {
    expect(getGanapCapacityModel(ganapWith({ registrationCount: 0 }))).toEqual({
      summary: 'Be the first to join',
      detail: '20 spots available',
      isFull: false,
    });
  });

  it('shows an unlimited attendance count', (): void => {
    expect(getGanapCapacityModel(ganapWith({ maxAttendees: null, registrationCount: 17 }))).toEqual({
      summary: '17 attending',
      detail: null,
      isFull: false,
    });
  });

  it('shows filled and remaining capacity', (): void => {
    expect(getGanapCapacityModel(ganapWith({ maxAttendees: 20, registrationCount: 17 }))).toEqual({
      summary: '17 of 20 spots filled',
      detail: '3 remaining',
      isFull: false,
    });
  });

  it('marks at-capacity and over-capacity events full', (): void => {
    expect(getGanapCapacityModel(ganapWith({ maxAttendees: 20, registrationCount: 21 }))).toEqual({
      summary: 'Full',
      detail: 'New joins enter the waitlist',
      isFull: true,
    });
  });
});

describe('getGanapActionModel', (): void => {
  it.each([
    [{}, 'Join event'],
    [{ requiresApproval: true }, 'Request to join'],
    [{ maxAttendees: 5, registrationCount: 5, requiresApproval: true }, 'Join waitlist'],
  ])('chooses the correct pre-join label', (overrides: Partial<GanapDetail>, label: string): void => {
    expect(getGanapActionModel(ganapWith(overrides), BEFORE_EVENT).actionLabel).toBe(label);
  });

  it.each(
    registrationCases,
  )('maps %s without inventing an unsupported action', (status: RegistrationStatus, statusLabel: string, actionLabel:
    | string
    | null): void => {
    expect(getGanapActionModel(ganapWith(withRegistration(status)), BEFORE_EVENT)).toMatchObject({
      statusLabel,
      actionLabel,
    });
  });

  it('disables joining after the start time', (): void => {
    expect(getGanapActionModel(ganapWith({}), new Date('2026-08-09T00:00:00.000Z'))).toEqual({
      statusLabel: 'Event has started',
      action: null,
      actionLabel: null,
      confirmation: null,
    });
  });
});

describe('getGanapScheduleModel', (): void => {
  it('formats a same-day event as one date and a time range', (): void => {
    expect(getGanapScheduleModel('2026-08-08T02:00:00.000Z', '2026-08-08T05:00:00.000Z', 'en-US', 'UTC')).toEqual({
      dateLabel: 'Saturday, August 8, 2026',
      timeLabel: '2:00 AM – 5:00 AM',
    });
  });

  it('makes both dates explicit for a multi-day event', (): void => {
    expect(getGanapScheduleModel('2026-08-08T22:00:00.000Z', '2026-08-09T02:00:00.000Z', 'en-US', 'UTC')).toEqual({
      dateLabel: 'Saturday, August 8, 2026 – Sunday, August 9, 2026',
      timeLabel: '10:00 PM – 2:00 AM',
    });
  });

  it('shows only the start when endDate is absent', (): void => {
    expect(getGanapScheduleModel('2026-08-08T02:00:00.000Z', null, 'en-US', 'UTC')).toEqual({
      dateLabel: 'Saturday, August 8, 2026',
      timeLabel: '2:00 AM',
    });
  });

  it('returns stable fallback copy for an invalid start date', (): void => {
    expect(getGanapScheduleModel('not-a-date', null, 'en-US', 'UTC')).toEqual({
      dateLabel: 'Date unavailable',
      timeLabel: 'Time unavailable',
    });
  });
});

describe('buildGanapShareMessage', (): void => {
  it('shares real event copy without fabricating a URL', (): void => {
    const schedule = getGanapScheduleModel('2026-08-08T02:00:00.000Z', '2026-08-08T05:00:00.000Z', 'en-US', 'UTC');

    const message = buildGanapShareMessage(ganapWith({}), schedule);

    expect(message).toContain('Coffee & Code');
    expect(message).toContain('Saturday, August 8, 2026');
    expect(message).toContain('Student Union');
    expect(message).not.toMatch(/https?:\/\//);
  });
});
