import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem, GanapListParams } from '@/types/ganap.types';

// This module reaches `@/db` transitively — useGanaps imports the mutations,
// which import `enqueueOutbox`. `src/db/index.ts` opens the database at import
// time, which needs a native module Jest does not have.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): Record<string, unknown> => ({}),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (): Promise<string | null> => null),
  setItemAsync: jest.fn(async (): Promise<void> => undefined),
  deleteItemAsync: jest.fn(async (): Promise<void> => undefined),
}));

jest.mock('@/api/endpoints/ganaps', () => ({
  ganapsAPI: { list: jest.fn() },
}));

import { getNextGanapPageParam, useGanaps } from './useGanaps';

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

describe('useGanaps filtering', () => {
  const mockedList = jest.mocked(ganapsAPI.list);

  /** Tracks the per-test client so `afterEach` can release its gc timers. */
  let testClient: QueryClient | null = null;

  function createWrapper(): (props: { children: ReactNode }) => ReactElement {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    testClient = client;
    return ({ children }: { children: ReactNode }): ReactElement =>
      createElement(QueryClientProvider, { client }, children);
  }

  beforeEach((): void => {
    mockedList.mockReset();
    mockedList.mockResolvedValue(pageWith(null));
  });

  afterEach((): void => {
    testClient?.clear();
    testClient = null;
  });

  it('sends the active filters to the server rather than filtering fetched pages', async (): Promise<void> => {
    const { unmount } = await renderHook(() => useGanaps({ search: 'choir', tag: 'music' }), {
      wrapper: createWrapper(),
    });

    await waitFor((): void => expect(mockedList).toHaveBeenCalled());

    const params = mockedList.mock.calls.at(-1)?.[0] as GanapListParams;
    expect(params.search).toBe('choir');
    expect(params.tag).toBe('music');
    expect(params.limit).toBe(20);
    await unmount();
  });

  it('forwards the nearby geo filter untouched', async (): Promise<void> => {
    const { unmount } = await renderHook(() => useGanaps({ lat: 10.72, long: 122.56, radius: 2 }), {
      wrapper: createWrapper(),
    });

    await waitFor((): void => expect(mockedList).toHaveBeenCalled());

    const params = mockedList.mock.calls.at(-1)?.[0] as GanapListParams;
    expect(params.lat).toBe(10.72);
    expect(params.long).toBe(122.56);
    expect(params.radius).toBe(2);
    await unmount();
  });

  it('caches each filter combination separately so paging does not reset', async (): Promise<void> => {
    const wrapper = createWrapper();

    const first = await renderHook(() => useGanaps({ tag: 'music' }), { wrapper });
    await waitFor((): void => expect(first.result.current.isLoading).toBe(false));
    await first.unmount();

    const callsAfterFirst: number = mockedList.mock.calls.length;

    const again = await renderHook(() => useGanaps({ tag: 'music' }), { wrapper });
    await waitFor((): void => expect(again.result.current.isLoading).toBe(false));

    expect(mockedList.mock.calls.length).toBe(callsAfterFirst);
    await again.unmount();
  });

  it('gives a different filter its own cache entry rather than reusing the last one', async (): Promise<void> => {
    const wrapper = createWrapper();

    const music = await renderHook(() => useGanaps({ tag: 'music' }), { wrapper });
    await waitFor((): void => expect(music.result.current.isLoading).toBe(false));
    await music.unmount();

    const callsAfterMusic: number = mockedList.mock.calls.length;

    const sports = await renderHook(() => useGanaps({ tag: 'sports' }), { wrapper });
    await waitFor((): void => expect(sports.result.current.isLoading).toBe(false));

    expect(mockedList.mock.calls.length).toBe(callsAfterMusic + 1);
    expect(mockedList.mock.calls.at(-1)?.[0]?.tag).toBe('sports');
    await sports.unmount();
  });
});
