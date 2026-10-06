import { describe, expect, it } from '@jest/globals';
import type { GanapDetail, RegistrationStatus } from '@/types/ganap.types';
import {
  buildGanapShareMessage,
  getAttendanceEstimate,
  getGanapActionModel,
  getGanapCapacityModel,
  getGanapLifecycleLabel,
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
    attendanceOpenMinutesBefore: 30,
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

function withRegistration(
  status: RegistrationStatus,
  registrationFormSubmittedAt: string | null = '2026-08-02T00:00:00.000Z',
): Partial<GanapDetail> {
  return {
    myRegistration: {
      id: 'registration_1',
      status,
      createdAt: '2026-08-01T00:00:00.000Z',
      registrationFormSubmittedAt,
    },
  };
}

const BEFORE_EVENT = new Date('2026-08-07T00:00:00.000Z');
const ALL_STATUSES: RegistrationStatus[] = [
  'PENDING',
  'REGISTERED',
  'WAITLISTED',
  'CANCELLED',
  'REJECTED',
  'ATTENDED',
  'EVICTED',
];

/** Statuses whose leave/cancel action carries no Event Hub entry. */
const leaveOnlyCases: Array<[RegistrationStatus, string, string]> = [
  ['PENDING', 'Awaiting approval', 'Cancel request'],
  ['WAITLISTED', 'On the waitlist', 'Leave waitlist'],
];

/** Terminal statuses with no action at all. */
const terminalCases: Array<[RegistrationStatus, string]> = [
  ['REJECTED', 'Request declined'],
  ['EVICTED', 'Removed'],
  ['CANCELLED', 'Registration cancelled'],
];

describe('getGanapCapacityModel', (): void => {
  it('invites the first attendee when capacity is available', (): void => {
    expect(getGanapCapacityModel(ganapWith({ registrationCount: 0 }))).toEqual({
      summary: 'Be the first',
      detail: 'Spaces available',
      isFull: false,
    });
  });

  it('shows an unlimited attendance count', (): void => {
    expect(getGanapCapacityModel(ganapWith({ maxAttendees: null, registrationCount: 17 }))).toEqual({
      summary: '15+ attending',
      detail: null,
      isFull: false,
    });
  });

  it('shows filled and remaining capacity', (): void => {
    expect(getGanapCapacityModel(ganapWith({ maxAttendees: 20, registrationCount: 17 }))).toEqual({
      summary: '15+ attending',
      detail: 'Spaces available',
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
  ])('chooses the correct pre-join label with no secondary action', (overrides: Partial<GanapDetail>, label: string): void => {
    const model = getGanapActionModel(ganapWith(overrides), BEFORE_EVENT);
    expect(model.primary).toMatchObject({ action: 'join', label });
    expect(model.secondary).toBeNull();
  });

  it('makes Enter Event Hub primary and Leave event secondary for REGISTERED', (): void => {
    const model = getGanapActionModel(ganapWith(withRegistration('REGISTERED')), BEFORE_EVENT);

    expect(model.statusLabel).toBe('Joined');
    expect(model.primary).toMatchObject({ action: 'enter-hub', label: 'Enter Event Hub', confirmation: null });
    expect(model.secondary).toMatchObject({
      action: 'leave',
      label: 'Leave event',
      confirmation: {
        title: 'Leave this event?',
        message: 'Your registration will be cancelled.',
        confirmLabel: 'Leave event',
      },
    });
  });

  it('makes Enter Event Hub primary with no secondary action for ATTENDED', (): void => {
    const model = getGanapActionModel(ganapWith(withRegistration('ATTENDED')), BEFORE_EVENT);

    expect(model.statusLabel).toBe('Attended');
    expect(model.primary).toMatchObject({ action: 'enter-hub', label: 'Enter Event Hub', confirmation: null });
    expect(model.secondary).toBeNull();
  });

  it.each(
    leaveOnlyCases,
  )('keeps the existing leave/cancel action as primary for %s with no Hub action', (status: RegistrationStatus, statusLabel: string, primaryLabel: string): void => {
    const model = getGanapActionModel(ganapWith(withRegistration(status)), BEFORE_EVENT);

    expect(model.statusLabel).toBe(statusLabel);
    expect(model.primary).toMatchObject({ action: 'leave', label: primaryLabel });
    expect(model.secondary).toBeNull();
  });

  it.each(terminalCases)('exposes only status copy for %s', (status: RegistrationStatus, statusLabel: string): void => {
    const model = getGanapActionModel(ganapWith(withRegistration(status)), BEFORE_EVENT);

    expect(model).toEqual({ statusLabel, primary: null, secondary: null });
  });

  it('asks an attendee to complete an unsubmitted registration form', (): void => {
    expect(
      getGanapActionModel(
        ganapWith({
          requiresApproval: true,
          myRegistration: {
            id: 'r1',
            status: 'PENDING',
            createdAt: '2026-08-01T00:00:00.000Z',
            registrationFormSubmittedAt: null,
          },
        }),
        new Date('2026-08-03T00:00:00.000Z'),
      ),
    ).toEqual({
      statusLabel: 'Registration incomplete',
      primary: { action: 'complete-registration', label: 'Complete registration', confirmation: null },
      secondary: null,
    });
  });

  it('disables joining after the start time', (): void => {
    expect(getGanapActionModel(ganapWith({}), new Date('2026-08-09T00:00:00.000Z'))).toEqual({
      statusLabel: 'Done',
      primary: null,
      secondary: null,
    });
  });

  it('never exposes enter-hub outside REGISTERED and ATTENDED', (): void => {
    const nonHubStatuses = ALL_STATUSES.filter(
      (status: RegistrationStatus): boolean => status !== 'REGISTERED' && status !== 'ATTENDED',
    );

    for (const status of nonHubStatuses) {
      const model = getGanapActionModel(ganapWith(withRegistration(status)), BEFORE_EVENT);
      expect(model.primary?.action).not.toBe('enter-hub');
      expect(model.secondary?.action).not.toBe('enter-hub');
    }

    const unregisteredModel = getGanapActionModel(ganapWith({}), BEFORE_EVENT);
    expect(unregisteredModel.primary?.action).not.toBe('enter-hub');
    expect(unregisteredModel.secondary?.action).not.toBe('enter-hub');
  });
});

describe('attendance estimates and lifecycle', (): void => {
  it.each([
    [0, 'Be the first'],
    [1, 'A few attending'],
    [4, 'A few attending'],
    [5, '5+ attending'],
    [9, '5+ attending'],
    [10, '10+ attending'],
    [-1, 'Be the first'],
  ])('estimates %s attendees', (count, label): void => {
    expect(getAttendanceEstimate(Number(count))).toBe(label);
  });

  it('marks an event done at its end, with cancellation winning', (): void => {
    const now = new Date('2026-08-08T05:00:00.000Z');
    expect(getGanapLifecycleLabel(ganapWith({}), now)).toBe('Done');
    expect(getGanapLifecycleLabel(ganapWith({ status: 'ONGOING' }), now)).toBe('Done');
    expect(getGanapLifecycleLabel(ganapWith({ status: 'CANCELLED' }), now)).toBe('Cancelled');
    expect(getGanapLifecycleLabel(ganapWith({ status: 'DRAFT' }), now)).toBeNull();
    expect(getGanapLifecycleLabel(ganapWith({ endDate: null }), now)).toBeNull();
    expect(getGanapLifecycleLabel(ganapWith({ endDate: 'invalid' }), now)).toBeNull();
    expect(getGanapLifecycleLabel(ganapWith({}), new Date('2026-08-08T04:59:59.999Z'))).toBeNull();
  });

  it('keeps historical hub access and leave actions when displaying Done', (): void => {
    const model = getGanapActionModel(ganapWith(withRegistration('REGISTERED')), new Date('2026-08-09'));
    expect(model.statusLabel).toBe('Done');
    expect(model.primary?.action).toBe('enter-hub');
    expect(model.secondary?.action).toBe('leave');
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
