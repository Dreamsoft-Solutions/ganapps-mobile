import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { QueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/store/toast.store';
import type { GanapDetail } from '@/types/ganap.types';
import { getAttendanceScanState, handleCheckInReplayOutcome, mapCheckInError } from './attendance';

/** Minimal Ganap detail for scan-state tests; override what each case needs. */
function ganap(overrides: Partial<GanapDetail>): GanapDetail {
  return {
    startDate: '2026-08-08T10:00:00.000Z',
    endDate: '2026-08-08T12:00:00.000Z',
    attendanceOpenMinutesBefore: 30,
    status: 'PUBLISHED',
    myRegistration: {
      id: 'reg-1',
      status: 'REGISTERED',
      createdAt: '2026-08-01T00:00:00.000Z',
      registrationFormSubmittedAt: null,
    },
    ...overrides,
  } as GanapDetail;
}

const BEFORE_WINDOW = new Date('2026-08-08T09:29:00.000Z');
const AT_WINDOW = new Date('2026-08-08T09:30:00.000Z');
const DURING_EVENT = new Date('2026-08-08T11:59:00.000Z');
const AT_END = new Date('2026-08-08T12:00:00.000Z');
const AFTER_END = new Date('2026-08-08T13:00:00.000Z');

describe('getAttendanceScanState', () => {
  it('is recorded once the registration is ATTENDED, regardless of time', () => {
    const g = ganap({
      myRegistration: {
        id: 'reg-1',
        status: 'ATTENDED',
        createdAt: '2026-08-01T00:00:00.000Z',
        registrationFormSubmittedAt: null,
      },
    });
    expect(getAttendanceScanState(g, DURING_EVENT)).toBe('recorded');
  });

  it('is hidden without a registration', () => {
    expect(getAttendanceScanState(ganap({ myRegistration: null }), AFTER_END)).toBe('hidden');
  });

  it('is hidden for non-REGISTERED statuses', () => {
    for (const status of ['PENDING', 'WAITLISTED', 'CANCELLED', 'REJECTED', 'EVICTED'] as const) {
      const g = ganap({
        myRegistration: {
          id: 'reg-1',
          status,
          createdAt: '2026-08-01T00:00:00.000Z',
          registrationFormSubmittedAt: null,
        },
      });
      expect(getAttendanceScanState(g, AFTER_END)).toBe('hidden');
    }
  });

  it('opens at the configured lead time and remains available through the inclusive end', () => {
    expect(getAttendanceScanState(ganap({}), BEFORE_WINDOW)).toBe('locked');
    expect(getAttendanceScanState(ganap({}), AT_WINDOW)).toBe('available');
    expect(getAttendanceScanState(ganap({}), DURING_EVENT)).toBe('available');
    expect(getAttendanceScanState(ganap({}), AT_END)).toBe('available');
    expect(getAttendanceScanState(ganap({}), AFTER_END)).toBe('closed');
  });

  it('uses the configured number of minutes rather than a fixed opening window', () => {
    const g = ganap({ attendanceOpenMinutesBefore: 60 });

    expect(getAttendanceScanState(g, new Date('2026-08-08T08:59:00.000Z'))).toBe('locked');
    expect(getAttendanceScanState(g, new Date('2026-08-08T09:00:00.000Z'))).toBe('available');
  });

  it('without endDate, stays open after the event starts', () => {
    const g = ganap({ endDate: null, status: 'ONGOING' });
    expect(getAttendanceScanState(g, BEFORE_WINDOW)).toBe('locked');
    expect(getAttendanceScanState(g, AT_WINDOW)).toBe('available');
    expect(getAttendanceScanState(g, AFTER_END)).toBe('available');
  });

  it('does not rely on status when the configured window is open', () => {
    const g = ganap({ endDate: null, status: 'PUBLISHED' });
    expect(getAttendanceScanState(g, new Date('2026-08-08T09:00:00.000Z'))).toBe('locked');
    expect(getAttendanceScanState(g, new Date('2026-08-08T09:30:00.000Z'))).toBe('available');
    expect(getAttendanceScanState(g, new Date('2026-08-08T10:00:00.000Z'))).toBe('available');
  });

  it('treats an invalid startDate string as locked', () => {
    const invalidDate = ganap({ startDate: 'not-a-date', status: 'PUBLISHED' });
    expect(getAttendanceScanState(invalidDate, DURING_EVENT)).toBe('locked');

    const g = ganap({ endDate: 'not-a-date', status: 'ONGOING' });
    expect(getAttendanceScanState(g, DURING_EVENT)).toBe('available');
  });
});

/** Builds the normalized error `parseApiError` produces. */
function serverError(message: string, status: number): Error {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

describe('mapCheckInError', () => {
  it('maps each server rejection to a distinct attendance-worded model', () => {
    expect(mapCheckInError(serverError('Invalid QR code', 400)).kind).toBe('invalid-qr');
    expect(mapCheckInError(serverError('Already checked in', 400)).kind).toBe('already-recorded');
    expect(mapCheckInError(serverError('Only registered attendees can check in', 400)).kind).toBe('not-eligible');
    expect(mapCheckInError(serverError('Event has no active QR code', 400)).kind).toBe('no-active-qr');
    expect(mapCheckInError(serverError('Attendance check-in is not open yet', 400)).kind).toBe('window-not-open');
    expect(mapCheckInError(serverError('Attendance check-in is closed', 400)).kind).toBe('window-closed');
    expect(mapCheckInError(serverError('Registration status changed before check-in completed', 400)).kind).toBe(
      'retryable',
    );
    expect(mapCheckInError(serverError('Not registered for this event', 404)).kind).toBe('not-registered');
  });

  it('falls back to unknown for anything unrecognised', () => {
    expect(mapCheckInError(serverError('Event not found', 404)).kind).toBe('unknown');
    expect(mapCheckInError(new Error('boom')).kind).toBe('unknown');
  });

  it('never surfaces check-in wording or the raw server string', () => {
    const messages = [
      'Invalid QR code',
      'Already checked in',
      'Only registered attendees can check in',
      'Event has no active QR code',
      'Attendance check-in is not open yet',
      'Attendance check-in is closed',
      'Registration status changed before check-in completed',
      'Not registered for this event',
      'Event not found',
    ];
    for (const message of messages) {
      const model = mapCheckInError(serverError(message, 400));
      const copy = `${model.title} ${model.message}`.toLowerCase();
      expect(copy).not.toContain('check in');
      expect(copy).not.toContain('check-in');
      expect(copy).not.toBe(message.toLowerCase());
    }
  });
});

describe('handleCheckInReplayOutcome', () => {
  function fakeQueryClient(): { invalidateQueries: jest.Mock } {
    return { invalidateQueries: jest.fn() };
  }

  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('toasts success and refreshes ganap and profile caches when recorded', () => {
    const client = fakeQueryClient();
    handleCheckInReplayOutcome(client as unknown as QueryClient, { ganapId: 'g-1', recorded: true });
    expect(useToastStore.getState().toasts[0].type).toBe('success');
    expect(useToastStore.getState().toasts[0].title).toBe('Attendance recorded');
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['ganaps'] });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile'] });
  });

  it('toasts the mapped attendance error when the replay was rejected', () => {
    const client = fakeQueryClient();
    handleCheckInReplayOutcome(client as unknown as QueryClient, {
      ganapId: 'g-1',
      recorded: false,
      error: Object.assign(new Error('Invalid QR code'), { status: 400 }),
    });
    const toast = useToastStore.getState().toasts[0];
    expect(toast.type).toBe('error');
    expect(toast.title).toBe('That code did not work');
  });

  it('still refreshes caches on failure so stale optimistic state cannot linger', () => {
    const client = fakeQueryClient();
    handleCheckInReplayOutcome(client as unknown as QueryClient, {
      ganapId: 'g-1',
      recorded: false,
      error: new Error('x'),
    });
    expect(client.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['ganaps'] });
  });
});
