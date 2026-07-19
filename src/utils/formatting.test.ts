import { describe, expect, it } from '@jest/globals';
import { formatDate } from './formatting';

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    expect(formatDate('2024-01-15T00:00:00.000Z')).toBe('Jan 15, 2024');
  });

  it('formats a Date instance', () => {
    expect(formatDate(new Date('2024-01-15T00:00:00.000Z'))).toBe('Jan 15, 2024');
  });
});
