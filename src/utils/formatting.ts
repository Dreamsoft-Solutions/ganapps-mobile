export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats an event start date for compact display.
 *
 * @param date - ISO date string or Date instance.
 * @returns A short, readable date/time string.
 */
export function formatEventDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Milliseconds in one day, for the calendar-day difference. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Formats a Ganap's start for a feed card.
 *
 * Relative for the near dates a user is actually deciding between — today,
 * tomorrow, the coming week — and absolute beyond that, where a weekday name
 * stops being enough to place the event. A date already in the past also takes
 * the absolute form, since "Sat" would otherwise read as the Saturday ahead.
 *
 * @param date - ISO start date or Date instance
 * @param now - The moment to compare against; defaults to the current time. Injected by tests
 * @returns A short label such as `Today, 8:00 PM` or `Oct 2, 5:00 PM`
 */
export function formatFeedEventDate(date: string | Date, now: Date = new Date()): string {
  const start: Date = typeof date === 'string' ? new Date(date) : date;
  const time: string = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAway: number = Math.round((startDay.getTime() - today.getTime()) / DAY_MS);

  if (daysAway === 0) return `Today, ${time}`;
  if (daysAway === 1) return `Tomorrow, ${time}`;
  if (daysAway > 1 && daysAway < 7) {
    return `${start.toLocaleDateString('en-US', { weekday: 'short' })}, ${time}`;
  }
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

/**
 * Formats a Ganap's start and end for a feed card.
 *
 * An event that runs under a day reads as one sitting, so only the end *time*
 * is appended — a night that crosses midnight stays "9:00 PM – 5:00 AM" rather
 * than dragging tomorrow's date into a single evening. Anything longer is a
 * genuinely multi-day event, where the end date is the part that matters.
 *
 * @param start - ISO start date or Date instance
 * @param end - ISO end date, Date instance, or null when the organizer left it open
 * @param now - The moment to compare against; defaults to the current time. Injected by tests
 * @returns A label such as `Today, 8:00 PM – 11:00 PM`
 */
export function formatFeedEventTimeRange(
  start: string | Date,
  end: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  const startLabel: string = formatFeedEventDate(start, now);
  if (end === null || end === undefined) return startLabel;

  const startDate: Date = typeof start === 'string' ? new Date(start) : start;
  const endDate: Date = typeof end === 'string' ? new Date(end) : end;
  const spansMoreThanADay: boolean = endDate.getTime() - startDate.getTime() > DAY_MS;

  if (spansMoreThanADay) return `${startLabel} – ${formatFeedEventDate(endDate, now)}`;

  const endTime: string = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${startLabel} – ${endTime}`;
}
