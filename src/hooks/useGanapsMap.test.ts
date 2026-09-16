import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { Coords } from '@/services/location.service';
import type { GanapListItem, GanapListParams } from '@/types/ganap.types';
import { ganapQueryKeys } from './queries/useGanapsQuery';
import { useGanaps } from './useGanaps';
import { useGanapsMap } from './useGanapsMap';
import type { UseNearbyLocationResult } from './useNearbyLocation';

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

const mockUseNearbyLocation = jest.fn<() => UseNearbyLocationResult>();

jest.mock('./useNearbyLocation', () => ({
  useNearbyLocation: (): UseNearbyLocationResult => mockUseNearbyLocation(),
}));

const ILOILO = { latitude: 10.72, longitude: 122.56 };

function nearbyState(overrides: Partial<UseNearbyLocationResult>): UseNearbyLocationResult {
  return {
    isActive: false,
    isDisabled: false,
    coords: null,
    isPrimingVisible: false,
    isAccuracyNoticeVisible: false,
    errorMessage: null,
    toggle: jest.fn(),
    refresh: jest.fn<() => Promise<Coords | null>>(),
    confirmPriming: jest.fn<() => Promise<void>>(),
    dismissPriming: jest.fn(),
    dismissAccuracyNotice: jest.fn(),
    openSettings: jest.fn<() => Promise<void>>(),
    ...overrides,
  };
}

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

const ALL_TAGS: string[] = ['music', 'sports', 'tech'];

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
    mockUseNearbyLocation.mockReturnValue(nearbyState({}));
  });

  // The hook sets gcTime to 10 minutes, so without this the cache keeps a timer
  // armed past the run and Jest reports it as an open handle instead of exiting.
  afterEach((): void => {
    testClient?.clear();
    testClient = null;
  });

  it('keeps the full tag set when a tag filter narrows the items', async (): Promise<void> => {
    respondByFilter();

    const { result, unmount } = await renderHook(() => useGanapsMap(), { wrapper: createWrapper() });

    await waitFor((): void => expect(result.current.tags).toEqual(ALL_TAGS));

    await act(async (): Promise<void> => {
      result.current.setTag('sports');
    });

    await waitFor((): void =>
      expect(result.current.items.map((g: GanapListItem): string => g.id)).toEqual(['sportsfest']),
    );
    expect(result.current.tags).toEqual(ALL_TAGS);
    await unmount();
  });

  it('keeps the full tag set when a search filter narrows the items', async (): Promise<void> => {
    respondByFilter();

    const { result, unmount } = await renderHook(() => useGanapsMap(), { wrapper: createWrapper() });

    await waitFor((): void => expect(result.current.tags).toEqual(ALL_TAGS));

    await act(async (): Promise<void> => {
      result.current.setSearch('sportsfest');
    });

    await waitFor((): void =>
      expect(result.current.items.map((g: GanapListItem): string => g.id)).toEqual(['sportsfest']),
    );
    // The chip row must not collapse to the search-narrowed vocabulary.
    expect(result.current.tags).toEqual(ALL_TAGS);
    await unmount();
  });

  it('issues one request for a burst of keystrokes rather than one per character', async (): Promise<void> => {
    respondByFilter();

    const { result, unmount } = await renderHook(() => useGanapsMap(), { wrapper: createWrapper() });
    await waitFor((): void => expect(result.current.tags).toEqual(ALL_TAGS));

    const callsAfterMount: number = mockedList.mock.calls.length;

    for (const value of ['s', 'sp', 'spo', 'sport', 'sportsfest']) {
      await act(async (): Promise<void> => {
        result.current.setSearch(value);
      });
    }

    await waitFor((): void =>
      expect(result.current.items.map((g: GanapListItem): string => g.id)).toEqual(['sportsfest']),
    );

    expect(mockedList.mock.calls.length - callsAfterMount).toBe(1);
    expect(mockedList).toHaveBeenLastCalledWith({ search: 'sportsfest', limit: 100 });
    await unmount();
  });

  it('keeps the map page separate from the infinite browse query', async (): Promise<void> => {
    respondByFilter();

    const wrapper = createWrapper();
    const map = await renderHook(() => useGanapsMap(), { wrapper });

    await waitFor((): void => expect(map.result.current.tags).toEqual(ALL_TAGS));

    const events = await renderHook(() => useGanaps(), { wrapper });

    await waitFor((): void => expect(events.result.current.items).toHaveLength(UNFILTERED.length));
    expect(events.result.current.hasNextPage).toBe(false);

    await map.unmount();
    await events.unmount();
  });
});

describe('useGanapsMap geo parameters', (): void => {
  beforeEach((): void => {
    mockedList.mockReset();
  });

  afterEach((): void => {
    testClient?.clear();
    testClient = null;
  });

  it('sends no geo parameters while Nearby is off', async (): Promise<void> => {
    respondByFilter();
    mockUseNearbyLocation.mockReturnValue(nearbyState({ isActive: false, coords: ILOILO }));

    const { unmount } = await renderHook(() => useGanapsMap(), { wrapper: createWrapper() });

    await waitFor((): void => {
      expect(mockedList).toHaveBeenCalled();
    });
    const params = mockedList.mock.calls[0]?.[0] ?? {};
    expect(params.lat).toBeUndefined();
    expect(params.long).toBeUndefined();
    expect(params.radius).toBeUndefined();
    await unmount();
  });

  it('sends all three geo parameters together while Nearby is on', async (): Promise<void> => {
    respondByFilter();
    mockUseNearbyLocation.mockReturnValue(nearbyState({ isActive: true, coords: ILOILO }));

    const { unmount } = await renderHook(() => useGanapsMap(), { wrapper: createWrapper() });

    await waitFor((): void => {
      expect(mockedList).toHaveBeenCalledWith(expect.objectContaining({ lat: 10.72, long: 122.56, radius: 2 }));
    });
    await unmount();
  });

  it('sends no geo parameters when Nearby is on but coords are missing', async (): Promise<void> => {
    respondByFilter();
    mockUseNearbyLocation.mockReturnValue(nearbyState({ isActive: true, coords: null }));

    const { unmount } = await renderHook(() => useGanapsMap(), { wrapper: createWrapper() });

    await waitFor((): void => {
      expect(mockedList).toHaveBeenCalled();
    });
    const params = mockedList.mock.calls[0]?.[0] ?? {};
    expect(params.lat).toBeUndefined();
    expect(params.radius).toBeUndefined();
    await unmount();
  });

  it('varies the query key by geo so a toggle refetches', (): void => {
    const off = ganapQueryKeys.list({ search: undefined, tag: undefined });
    const on = ganapQueryKeys.list({ search: undefined, tag: undefined, lat: 10.72, long: 122.56, radius: 2 });

    expect(off).not.toEqual(on);
  });
});
