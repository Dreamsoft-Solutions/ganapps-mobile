import { describe, expect, it, jest } from '@jest/globals';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem } from '@/types/ganap.types';

// This module reaches `@/db` transitively — useGanaps imports the mutations,
// which import `enqueueOutbox`. `src/db/index.ts` opens the database at import
// time, which needs a native module Jest does not have.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): Record<string, unknown> => ({}),
}));

import { getNextGanapPageParam } from './useGanaps';

/** Builds a page carrying only the pagination fields under test. */
function pageWith(nextCursor: string | null): CursorPage<GanapListItem> {
  return {
    items: [],
    pagination: { total: 40, cursor: null, nextCursor, limit: 20 },
  };
}

describe('getNextGanapPageParam', () => {
  it('returns the server cursor when more pages remain', () => {
    expect(getNextGanapPageParam(pageWith('ganap-20'))).toBe('ganap-20');
  });

  it('returns undefined on the last page so fetching stops', () => {
    expect(getNextGanapPageParam(pageWith(null))).toBeUndefined();
  });
});
