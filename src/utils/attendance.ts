import type { QueryClient } from '@tanstack/react-query';
import { ganapQueryKeys } from '@/hooks/queries/useGanapsQuery';
import { profileQueryKeys } from '@/hooks/queries/useProfileQuery';
import type { CheckInReplayOutcome } from '@/services/sync.service';
import { showToast } from '@/store/toast.store';
import type { GanapDetail } from '@/types/ganap.types';

/**
 * Whether and how the attendance scan is offered for a Ganap.
 *
 * - `hidden` — no scan surface at all (not a `REGISTERED`/`ATTENDED` registration)
 * - `locked` — visible but disabled; the attendance window has not opened yet
 * - `available` — the student may scan now
 * - `closed` — visible but disabled; the attendance window has ended
 * - `recorded` — attendance already captured; show confirmation instead
 */
export type AttendanceScanState = 'hidden' | 'locked' | 'available' | 'closed' | 'recorded';

/** Discriminated category of a rejected attendance scan. */
export type CheckInErrorKind =
  | 'invalid-qr'
  | 'already-recorded'
  | 'not-eligible'
  | 'no-active-qr'
  | 'window-not-open'
  | 'window-closed'
  | 'retryable'
  | 'not-registered'
  | 'unknown';

/** Attendance-worded copy for one rejected scan. */
export interface CheckInErrorModel {
  kind: CheckInErrorKind;
  title: string;
  message: string;
}

/**
 * Decides how the attendance scan surface should present for a Ganap.
 *
 * The gate is deliberately client-side and advisory: the server remains the
 * authority for attendance (the organizer's displayed QR is the real control),
 * so this only shapes UX. The configured lead time opens the window before the
 * Ganap starts; an `endDate` closes it after the event ends. Without an
 * `endDate`, the window remains open indefinitely after it starts.
 *
 * @param ganap - Ganap detail including the caller's registration
 * @param now - Current time, injected for deterministic tests
 * @returns The scan surface state
 */
export function getAttendanceScanState(ganap: GanapDetail, now: Date): AttendanceScanState {
  const status = ganap.myRegistration?.status;
  if (status === 'ATTENDED') return 'recorded';
  if (status !== 'REGISTERED') return 'hidden';

  const startTime: number = new Date(ganap.startDate).getTime();
  const nowTime: number = now.getTime();
  if (Number.isNaN(startTime) || Number.isNaN(nowTime)) return 'locked';

  const configuredMinutes: number = ganap.attendanceOpenMinutesBefore;
  const minutesBefore: number = Number.isFinite(configuredMinutes) ? Math.max(0, configuredMinutes) : 0;
  const attendanceWindowStart: number = startTime - minutesBefore * 60 * 1000;
  if (nowTime < attendanceWindowStart) return 'locked';

  if (ganap.endDate) {
    const endTime: number = new Date(ganap.endDate).getTime();
    if (!Number.isNaN(endTime) && nowTime > endTime) return 'closed';
  }

  return 'available';
}

/**
 * Server rejection messages for the check-in endpoint, keyed verbatim.
 *
 * All seven 400s share one generic `errorCode` (plain `BadRequestException`
 * through the global exception filter), so the message string is the only
 * discriminator. Coupled to `GanapService.checkIn` in `ganapps-server` —
 * if a string there changes, the mapping falls back to `unknown`.
 */
const CHECK_IN_ERROR_MODELS: Record<string, CheckInErrorModel> = {
  'Invalid QR code': {
    kind: 'invalid-qr',
    title: 'That code did not work',
    message:
      'The QR code is not valid or has expired. Ask the organizer to show the current attendance code, then scan again.',
  },
  'Already checked in': {
    kind: 'already-recorded',
    title: 'Attendance already recorded',
    message: 'You are already marked as attended for this event.',
  },
  'Only registered attendees can check in': {
    kind: 'not-eligible',
    title: 'Attendance cannot be recorded',
    message: 'Only confirmed registrations can record attendance. Review your status on the event page.',
  },
  'Event has no active QR code': {
    kind: 'no-active-qr',
    title: 'Attendance is not open',
    message: 'This event has no active attendance code right now. Ask the organizer for help.',
  },
  'Attendance check-in is not open yet': {
    kind: 'window-not-open',
    title: 'Attendance is not open yet',
    message: 'Attendance opens shortly before the event starts. Return when the attendance window begins.',
  },
  'Attendance check-in is closed': {
    kind: 'window-closed',
    title: 'Attendance is closed',
    message: 'The attendance window for this event has ended.',
  },
  'Registration status changed before check-in completed': {
    kind: 'retryable',
    title: 'Something changed mid-scan',
    message: 'Your registration changed while recording attendance. Try scanning again.',
  },
  'Not registered for this event': {
    kind: 'not-registered',
    title: 'You are not registered',
    message: 'Attendance can only be recorded for events you have joined.',
  },
};

const UNKNOWN_CHECK_IN_ERROR: CheckInErrorModel = {
  kind: 'unknown',
  title: 'Attendance could not be recorded',
  message: 'Something went wrong. Try scanning again in a moment.',
};

/**
 * Maps a rejected attendance scan to attendance-worded copy.
 *
 * @param error - The normalized error the mutation rejected with
 * @returns The matched model, or the unknown fallback
 */
export function mapCheckInError(error: Error): CheckInErrorModel {
  return CHECK_IN_ERROR_MODELS[error.message] ?? UNKNOWN_CHECK_IN_ERROR;
}

/**
 * Reports a settled offline attendance replay to the student and the cache.
 *
 * Fired by the outbox drain, outside any screen: a toast is the only surface
 * guaranteed to exist. Caches refresh on both outcomes so every screen showing
 * registration state converges on the server's answer.
 *
 * @param queryClient - The app's query client
 * @param outcome - The settled replay outcome
 * @returns Nothing
 */
export function handleCheckInReplayOutcome(queryClient: QueryClient, outcome: CheckInReplayOutcome): void {
  if (outcome.recorded) {
    showToast('success', 'Attendance recorded', 'Your offline scan was saved to the event.');
  } else {
    const model = mapCheckInError(outcome.error ?? new Error('unknown'));
    showToast('error', model.title, model.message);
  }
  queryClient.invalidateQueries({ queryKey: ganapQueryKeys.all });
  queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
}
