import { describe, expect, it } from '@jest/globals';
import { formatDate, formatEventDate } from './formatting';

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
