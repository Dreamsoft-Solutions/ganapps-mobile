import { describe, expect, it } from '@jest/globals';
import { getNextJoinedGanapPageParam } from './useProfileQuery';

describe('getNextJoinedGanapPageParam', () => {
  it('returns the next offset while pages remain', () => {
    expect(
      getNextJoinedGanapPageParam({
        items: [],
        pagination: { total: 25, skip: 0, take: 10, pages: 3 },
      }),
    ).toBe(10);
  });

  it('stops after the final page', () => {
    expect(
      getNextJoinedGanapPageParam({
        items: [],
        pagination: { total: 20, skip: 10, take: 10, pages: 2 },
      }),
    ).toBeUndefined();
  });
});
