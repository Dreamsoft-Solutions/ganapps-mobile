import type { GanapDetail, RegistrationStatus } from '@/types/ganap.types';

/**
 * Formats public attendance without exposing the exact registration count.
 * @param count - Exact internal registration count.
 * @returns A public estimate in buckets of five, with low-count invitation copy.
 */
export function getAttendanceEstimate(count: number): string {
  const safeCount: number = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (safeCount === 0) return 'Be the first';
  if (safeCount < 5) return 'A few attending';
  return `${String(Math.floor(safeCount / 5) * 5)}+ attending`;
}

/**
 * Derives display lifecycle only; absent or invalid ends retain server status.
 * @param ganap - Authoritative lifecycle and optional event end.
 * @param now - Current display time.
 * @returns Terminal display label, preserving cancellation over elapsed time.
 */
export function getGanapLifecycleLabel(
  ganap: { status: string; endDate?: string | null },
  now: Date,
): 'Done' | 'Cancelled' | null {
  if (ganap.status === 'CANCELLED') return 'Cancelled';
  if (ganap.status === 'COMPLETED') return 'Done';
  if (ganap.status !== 'PUBLISHED' && ganap.status !== 'ONGOING') return null;
  const endTime: number = ganap.endDate ? new Date(ganap.endDate).getTime() : Number.NaN;
  return Number.isFinite(endTime) && now.getTime() >= endTime ? 'Done' : null;
}

/** Capacity copy and availability state for a Ganap. */
export interface GanapCapacityModel {
  summary: string;
  detail: string | null;
  isFull: boolean;
}

/** Localized date and time copy for a Ganap. */
export interface GanapScheduleModel {
  dateLabel: string;
  timeLabel: string;
}

/** Supported actions on the Event Details screen. */
export type GanapAction = 'join' | 'leave' | 'complete-registration' | 'enter-hub' | null;

/** Confirmation copy for a destructive registration action. */
export interface GanapActionConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
}

/** One selectable action slot: its kind, label, and optional confirmation copy. */
export interface GanapActionChoice {
  action: GanapAction;
  label: string;
  confirmation: GanapActionConfirmation | null;
}

/** Status copy plus the primary and optional secondary action for a Ganap. */
export interface GanapActionModel {
  statusLabel: string | null;
  primary: GanapActionChoice | null;
  secondary: GanapActionChoice | null;
}

function statusOnly(statusLabel: string): GanapActionModel {
  return { statusLabel, primary: null, secondary: null };
}

function choice(
  action: GanapAction,
  label: string,
  confirmation: GanapActionConfirmation | null = null,
): GanapActionChoice {
  return { action, label, confirmation };
}

const LEAVE_EVENT_CONFIRMATION: GanapActionConfirmation = {
  title: 'Leave this event?',
  message: 'Your registration will be cancelled.',
  confirmLabel: 'Leave event',
};

const CANCEL_REQUEST_CONFIRMATION: GanapActionConfirmation = {
  title: 'Cancel your request?',
  message: 'Your pending registration request will be removed.',
  confirmLabel: 'Cancel request',
};

const LEAVE_WAITLIST_CONFIRMATION: GanapActionConfirmation = {
  title: 'Leave the waitlist?',
  message: 'Your place on the waitlist will be removed.',
  confirmLabel: 'Leave waitlist',
};

/**
 * Builds the Event Hub entry model for a joined or attended registration.
 *
 * `REGISTERED` keeps Leave event available as a secondary action; `ATTENDED`
 * has nothing left to leave, so Enter Event Hub is the only action.
 *
 * @param status - The caller's `REGISTERED` or `ATTENDED` registration status
 * @returns The status label with Enter Event Hub as primary
 */
function eventHubAction(status: 'REGISTERED' | 'ATTENDED'): GanapActionModel {
  const primary = choice('enter-hub', 'Enter Event Hub');
  if (status === 'ATTENDED') {
    return { statusLabel: 'Attended', primary, secondary: null };
  }
  return {
    statusLabel: 'Joined',
    primary,
    secondary: choice('leave', 'Leave event', LEAVE_EVENT_CONFIRMATION),
  };
}

function leaveOnlyAction(status: RegistrationStatus): GanapActionModel {
  switch (status) {
    case 'PENDING':
      return {
        statusLabel: 'Awaiting approval',
        primary: choice('leave', 'Cancel request', CANCEL_REQUEST_CONFIRMATION),
        secondary: null,
      };
    case 'WAITLISTED':
      return {
        statusLabel: 'On the waitlist',
        primary: choice('leave', 'Leave waitlist', LEAVE_WAITLIST_CONFIRMATION),
        secondary: null,
      };
    case 'REJECTED':
      return statusOnly('Request declined');
    case 'EVICTED':
      return statusOnly('Removed');
    case 'CANCELLED':
      return statusOnly('Registration cancelled');
    case 'REGISTERED':
    case 'ATTENDED':
      return eventHubAction(status);
  }
}

/**
 * Derives attendee-facing capacity copy from the server count and limit.
 *
 * @param ganap - Ganap detail returned by the server.
 * @returns Capacity summary, secondary detail, and full state.
 */
export function getGanapCapacityModel(ganap: GanapDetail): GanapCapacityModel {
  const count = Math.max(0, ganap.registrationCount);
  const maximum = ganap.maxAttendees ?? null;
  const isFull = maximum !== null && count >= maximum;

  if (isFull) {
    return { summary: 'Full', detail: 'New joins enter the waitlist', isFull: true };
  }
  return {
    summary: getAttendanceEstimate(count),
    detail: maximum === null ? null : 'Spaces available',
    isFull: false,
  };
}

/**
 * Derives the registration action and status copy for the current time.
 *
 * @param ganap - Ganap detail returned by the server.
 * @param now - Current time, injected for deterministic tests.
 * @returns The status and primary action model.
 */
export function getGanapActionModel(ganap: GanapDetail, now: Date): GanapActionModel {
  const lifecycleLabel = getGanapLifecycleLabel(ganap, now);
  const registration = ganap.myRegistration;
  if (registration?.status === 'PENDING' && registration.registrationFormSubmittedAt === null) {
    return {
      statusLabel: lifecycleLabel ?? 'Registration incomplete',
      primary: choice('complete-registration', 'Complete registration'),
      secondary: null,
    };
  }
  if (registration?.status) {
    const model = leaveOnlyAction(registration.status);
    return { ...model, statusLabel: lifecycleLabel ?? model.statusLabel };
  }

  if (lifecycleLabel) return statusOnly(lifecycleLabel);

  if (ganap.status === 'ONGOING') return statusOnly('Event in progress');
  if (ganap.status === 'COMPLETED') return statusOnly('Event ended');
  if (ganap.status === 'CANCELLED') return statusOnly('Event cancelled');
  if (ganap.status !== 'PUBLISHED') return statusOnly('Event unavailable');
  if (now >= new Date(ganap.startDate)) return statusOnly('Event has started');

  const capacity = getGanapCapacityModel(ganap);
  return {
    statusLabel: null,
    primary: choice(
      'join',
      capacity.isFull ? 'Join waitlist' : ganap.requiresApproval ? 'Request to join' : 'Join event',
    ),
    secondary: null,
  };
}

function formatDate(date: Date, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(date);
}

function formatTime(date: Date, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);
}

function dateKey(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(date);
}

/**
 * Formats a Ganap's date and time with an optional timezone override.
 *
 * @param startDate - ISO start date returned by the server.
 * @param endDate - Optional ISO end date returned by the server.
 * @param locale - Locale used for the formatted labels.
 * @param timeZone - Optional IANA timezone used for deterministic display.
 * @returns Localized date and time labels, or stable fallback copy for an invalid start.
 */
export function getGanapScheduleModel(
  startDate: string,
  endDate?: string | null,
  locale = 'en-US',
  timeZone?: string,
): GanapScheduleModel {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return { dateLabel: 'Date unavailable', timeLabel: 'Time unavailable' };
  }

  const end = endDate ? new Date(endDate) : null;
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;
  if (!validEnd) {
    return { dateLabel: formatDate(start, locale, timeZone), timeLabel: formatTime(start, locale, timeZone) };
  }

  const sameDay = dateKey(start, timeZone) === dateKey(validEnd, timeZone);
  return {
    dateLabel: sameDay
      ? formatDate(start, locale, timeZone)
      : `${formatDate(start, locale, timeZone)} – ${formatDate(validEnd, locale, timeZone)}`,
    timeLabel: `${formatTime(start, locale, timeZone)} – ${formatTime(validEnd, locale, timeZone)}`,
  };
}

/**
 * Builds native-share copy from real Ganap fields without inventing a deep link.
 *
 * @param ganap - Ganap detail returned by the server.
 * @param schedule - Already formatted Ganap schedule.
 * @returns Plain share text containing title, schedule, and address when available.
 */
export function buildGanapShareMessage(ganap: GanapDetail, schedule: GanapScheduleModel): string {
  return [ganap.title, `${schedule.dateLabel} · ${schedule.timeLabel}`, ganap.address?.trim() || null]
    .filter((line: string | null): line is string => Boolean(line))
    .join('\n');
}
