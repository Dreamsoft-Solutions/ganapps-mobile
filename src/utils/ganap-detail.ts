import type { GanapDetail, RegistrationStatus } from '@/types/ganap.types';

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

/** Supported primary actions on the Event Details screen. */
export type GanapAction = 'join' | 'leave' | 'complete-registration' | null;

/** Confirmation copy for a destructive registration action. */
export interface GanapActionConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
}

/** Status copy, action, and confirmation model for a Ganap. */
export interface GanapActionModel {
  statusLabel: string | null;
  action: GanapAction;
  actionLabel: string | null;
  confirmation: GanapActionConfirmation | null;
}

function statusOnly(statusLabel: string): GanapActionModel {
  return { statusLabel, action: null, actionLabel: null, confirmation: null };
}

function leaveAction(status: RegistrationStatus): GanapActionModel {
  switch (status) {
    case 'REGISTERED':
      return {
        statusLabel: 'Joined',
        action: 'leave',
        actionLabel: 'Leave event',
        confirmation: {
          title: 'Leave this event?',
          message: 'Your registration will be cancelled.',
          confirmLabel: 'Leave event',
        },
      };
    case 'PENDING':
      return {
        statusLabel: 'Awaiting approval',
        action: 'leave',
        actionLabel: 'Cancel request',
        confirmation: {
          title: 'Cancel your request?',
          message: 'Your pending registration request will be removed.',
          confirmLabel: 'Cancel request',
        },
      };
    case 'WAITLISTED':
      return {
        statusLabel: 'On the waitlist',
        action: 'leave',
        actionLabel: 'Leave waitlist',
        confirmation: {
          title: 'Leave the waitlist?',
          message: 'Your place on the waitlist will be removed.',
          confirmLabel: 'Leave waitlist',
        },
      };
    case 'ATTENDED':
      return statusOnly('Attended');
    case 'REJECTED':
      return statusOnly('Request declined');
    case 'EVICTED':
      return statusOnly('Removed');
    case 'CANCELLED':
      return statusOnly('Registration cancelled');
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
  if (count === 0) {
    return {
      summary: 'Be the first to join',
      detail: maximum === null ? null : `${String(maximum)} spots available`,
      isFull: false,
    };
  }
  if (maximum === null) {
    return { summary: `${String(count)} attending`, detail: null, isFull: false };
  }
  const remaining = maximum - count;
  return {
    summary: `${String(count)} of ${String(maximum)} spots filled`,
    detail: `${String(remaining)} remaining`,
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
  const registration = ganap.myRegistration;
  if (registration?.status === 'PENDING' && registration.registrationFormSubmittedAt === null) {
    return {
      statusLabel: 'Registration incomplete',
      action: 'complete-registration',
      actionLabel: 'Complete registration',
      confirmation: null,
    };
  }
  if (registration?.status) return leaveAction(registration.status);

  if (ganap.status === 'ONGOING') return statusOnly('Event in progress');
  if (ganap.status === 'COMPLETED') return statusOnly('Event ended');
  if (ganap.status === 'CANCELLED') return statusOnly('Event cancelled');
  if (ganap.status !== 'PUBLISHED') return statusOnly('Event unavailable');
  if (now >= new Date(ganap.startDate)) return statusOnly('Event has started');

  const capacity = getGanapCapacityModel(ganap);
  return {
    statusLabel: null,
    action: 'join',
    actionLabel: capacity.isFull ? 'Join waitlist' : ganap.requiresApproval ? 'Request to join' : 'Join event',
    confirmation: null,
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
