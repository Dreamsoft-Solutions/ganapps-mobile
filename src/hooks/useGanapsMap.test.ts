import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem, GanapListParams } from '@/types/ganap.types';
import { type GanapListFilters, ganapQueryKeys } from './queries/useGanapsQuery';
import { useGanaps } from './useGanaps';
import { useGanapsMap } from './useGanapsMap';

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

const mockedList = jest.mocked(ganapsAPI.list);

/** Builds a Ganap list item carrying only the fields the hook reads. */
function ganapWithTags(id: string, tags: string[]): GanapListItem {
  return {
    id,
    businessId: 'business_1',
    businessName: 'Org',
    slug: id,
    title: id,
    description: '',
    address: null,
    locationLat: 14.5,
    locationLong: 120.9,
    startDate: new Date().toISOString(),
    endDate: null,
    attendanceOpenMinutesBefore: 30,
    tags,
    coverImage: null,
    mapPinImage: null,
    registrationCount: 0,
    likesCount: 0,
    createdAt: new Date().toISOString(),
    isLiked: false,
    isSaved: false,
  };
}

function pageWith(items: GanapListItem[]): CursorPage<GanapListItem> {
  return {
    items,
    pagination: { total: items.length, cursor: null, nextCursor: null, limit: 100 },
  };
}

/** Tracks the per-test client so `afterEach` can release its gc timers. */
let testClient: QueryClient | null = null;

function createWrapper(
  client: QueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
): (props: { children: ReactNode }) => ReactElement {
  testClient = client;
  return ({ children }: { children: ReactNode }): ReactElement =>
    createElement(QueryClientProvider, { client }, children);
}

const UNFILTERED: GanapListItem[] = [
  ganapWithTags('sportsfest', ['sports', 'tech']),
  ganapWithTags('choir-night', ['music']),
];

/** Makes the mocked endpoint filter like the server, so narrowing is real. */
function respondByFilter(): void {
  mockedList.mockImplementation(async (params?: GanapListParams): Promise<CursorPage<GanapListItem>> => {
    let items = UNFILTERED;
    if (params?.tag) {
      const tag: string = params.tag;
      items = items.filter((g: GanapListItem): boolean => g.tags.includes(tag));
    }
    if (params?.search) {
      const search: string = params.search;
      items = items.filter((g: GanapListItem): boolean => g.title.includes(search));
    }
    return pageWith(items);
  });
}

describe('useGanapsMap', () => {
  beforeEach((): void => {
    mockedList.mockReset();
    respondByFilter();
  });

  // The hook sets gcTime to 10 minutes, so without this the cache keeps a timer
  // armed past the run and Jest reports it as an open handle instead of exiting.
  afterEach((): void => {
    testClient?.clear();
    testClient = null;
  });

  it('requests one large page so clustering sees the whole viewport', async (): Promise<void> => {
    const { result, unmount } = await renderHook(() => useGanapsMap(), { wrapper: createWrapper() });

    await waitFor((): void => expect(result.current.items).toHaveLength(2));
    expect(mockedList).toHaveBeenLastCalledWith({ limit: 100 });
    await unmount();
  });

  it('passes the filters it is given straight through to the server', async (): Promise<void> => {
    const { result, unmount } = await renderHook(
      () => useGanapsMap({ tag: 'sports', lat: 10.72, long: 122.56, radius: 2 }),
      { wrapper: createWrapper() },
    );

    await waitFor((): void =>
      expect(result.current.items.map((g: GanapListItem): string => g.id)).toEqual(['sportsfest']),
    );
    expect(mockedList).toHaveBeenLastCalledWith({
      tag: 'sports',
      lat: 10.72,
      long: 122.56,
      radius: 2,
      limit: 100,
    });
    await unmount();
  });

  it('keeps the map page under a different key from the infinite browse query', async (): Promise<void> => {
    const wrapper = createWrapper();

    const map = await renderHook(() => useGanapsMap({ tag: 'sports' }), { wrapper });
    await waitFor((): void => expect(map.result.current.items).toHaveLength(1));

    const feed = await renderHook(() => useGanaps({ tag: 'sports' }), { wrapper });
    await waitFor((): void => expect(feed.result.current.isLoading).toBe(false));

    const sizes = mockedList.mock.calls.map((call): number | undefined => call[0]?.limit);
    expect(sizes).toContain(100);
    expect(sizes).toContain(20);

    await map.unmount();
    await feed.unmount();
  });

  it('holds the previous page on screen while a filter change loads', async (): Promise<void> => {
    const { result, rerender, unmount } = await renderHook(
      ({ filters }: { filters: GanapListFilters }) => useGanapsMap(filters),
      { wrapper: createWrapper(), initialProps: { filters: { tag: 'sports' } as GanapListFilters } },
    );

    await waitFor((): void =>
      expect(result.current.items.map((g: GanapListItem): string => g.id)).toEqual(['sportsfest']),
    );

    await rerender({ filters: { tag: 'music' } });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.items.map((g: GanapListItem): string => g.id)).toEqual(['sportsfest']);

    await waitFor((): void =>
      expect(result.current.items.map((g: GanapListItem): string => g.id)).toEqual(['choir-night']),
    );
    await unmount();
  });
});

describe('ganapQueryKeys', (): void => {
  it('varies the map key by geo so a Nearby toggle refetches', (): void => {
    const off = ganapQueryKeys.list({ search: undefined, tag: undefined });
    const on = ganapQueryKeys.list({ search: undefined, tag: undefined, lat: 10.72, long: 122.56, radius: 2 });

    expect(off).not.toEqual(on);
  });
});
