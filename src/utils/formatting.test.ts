import { describe, expect, it } from '@jest/globals';
import { formatDate, formatEventDate, formatFeedEventDate } from './formatting';

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    expect(formatDate('2024-01-15T00:00:00.000Z')).toBe('Jan 15, 2024');
  });

  it('formats a Date instance', () => {
    expect(formatDate(new Date('2024-01-15T00:00:00.000Z'))).toBe('Jan 15, 2024');
  });
});

describe('formatEventDate', () => {
  it('formats an event start date with month, day, and time', () => {
    const result = formatEventDate('2024-01-15T10:30:00.000Z');
    expect(result).toContain('Jan 15,');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it('formats a Date instance', () => {
    const result = formatEventDate(new Date('2024-01-15T10:30:00.000Z'));
    expect(result).toContain('Jan 15,');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatFeedEventDate', () => {
  /** A Tuesday, so "the coming week" and the weekday branch are unambiguous. */
  const now = new Date('2026-09-15T09:00:00');

  it('says Today for a start date on the same calendar day', () => {
    expect(formatFeedEventDate(new Date('2026-09-15T20:00:00'), now)).toBe('Today, 8:00 PM');
  });

  it('says Tomorrow for the next calendar day', () => {
    expect(formatFeedEventDate(new Date('2026-09-16T11:00:00'), now)).toBe('Tomorrow, 11:00 AM');
  });

  it('names the weekday inside the coming week', () => {
    expect(formatFeedEventDate(new Date('2026-09-19T17:00:00'), now)).toBe('Sat, 5:00 PM');
  });

  it('falls back to a dated form beyond a week out', () => {
    expect(formatFeedEventDate(new Date('2026-10-02T17:00:00'), now)).toBe('Oct 2, 5:00 PM');
  });

  it('still says Today for a start time that has already passed today', () => {
    expect(formatFeedEventDate(new Date('2026-09-15T07:30:00'), now)).toBe('Today, 7:30 AM');
  });

  it('uses a dated form for an event that has already finished', () => {
    expect(formatFeedEventDate(new Date('2026-09-01T18:00:00'), now)).toBe('Sep 1, 6:00 PM');
  });

  it('accepts an ISO string as well as a Date', () => {
    expect(formatFeedEventDate('2026-09-16T11:00:00', now)).toBe('Tomorrow, 11:00 AM');
  });
});
