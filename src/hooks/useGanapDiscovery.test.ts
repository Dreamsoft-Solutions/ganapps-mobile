import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { Coords } from '@/services/location.service';
import type { GanapListItem, GanapListParams } from '@/types/ganap.types';
import { useGanapDiscovery } from './useGanapDiscovery';
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

const ILOILO: Coords = { latitude: 10.72, longitude: 122.56 };

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

/** Builds a list item carrying only the fields these tests read. */
function ganapWithTags(id: string, tags: string[]): GanapListItem {
  return {
    id,
    businessId: 'business_1',
    businessName: 'Org',
    slug: id,
    title: id,
    description: '',
    address: null,
    locationLat: 10.72,
    locationLong: 122.56,
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

const CATALOGUE: GanapListItem[] = [ganapWithTags('sportsfest', ['sports']), ganapWithTags('choir-night', ['music'])];

function respondByFilter(): void {
  mockedList.mockImplementation(async (params?: GanapListParams): Promise<CursorPage<GanapListItem>> => {
    const items = params?.tag
      ? CATALOGUE.filter((g: GanapListItem): boolean => g.tags.includes(params.tag as string))
      : CATALOGUE;
    return {
      items,
      pagination: { total: items.length, cursor: null, nextCursor: null, limit: params?.limit ?? 100 },
    };
  });
}

/** Tracks the per-test client so `afterEach` can release its gc timers. */
let testClient: QueryClient | null = null;

function createWrapper(): (props: { children: ReactNode }) => ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  testClient = client;
  return ({ children }: { children: ReactNode }): ReactElement =>
    createElement(QueryClientProvider, { client }, children);
}

describe('useGanapDiscovery', () => {
  beforeEach((): void => {
    mockedList.mockReset();
    respondByFilter();
    mockUseNearbyLocation.mockReturnValue(nearbyState({}));
  });

  afterEach((): void => {
    testClient?.clear();
    testClient = null;
  });

  it('sends one tag selection to both the map and the feed', async (): Promise<void> => {
    const { result, unmount } = await renderHook(() => useGanapDiscovery(), { wrapper: createWrapper() });

    await waitFor((): void => expect(mockedList).toHaveBeenCalled());

    await act(async (): Promise<void> => {
      result.current.setTag('music');
    });

    await waitFor((): void => {
      const tagged = mockedList.mock.calls.filter((call): boolean => call[0]?.tag === 'music');
      const sizes = tagged.map((call): number | undefined => (call[0] as GanapListParams).limit);
      expect(sizes).toContain(100);
      expect(sizes).toContain(20);
    });
    await unmount();
  });

  it('adds the geo filter to both surfaces only when nearby is active with coords', async (): Promise<void> => {
    mockUseNearbyLocation.mockReturnValue(nearbyState({ isActive: true, coords: ILOILO }));

    const { result, unmount } = await renderHook(() => useGanapDiscovery(), { wrapper: createWrapper() });

    await waitFor((): void => expect(mockedList).toHaveBeenCalled());

    expect(result.current.filters.lat).toBe(10.72);
    expect(result.current.filters.long).toBe(122.56);
    expect(result.current.filters.radius).toBe(2);
    await unmount();
  });

  it('omits the geo filter when nearby is on but coords have not arrived', async (): Promise<void> => {
    mockUseNearbyLocation.mockReturnValue(nearbyState({ isActive: true, coords: null }));

    const { result, unmount } = await renderHook(() => useGanapDiscovery(), { wrapper: createWrapper() });

    await waitFor((): void => expect(mockedList).toHaveBeenCalled());

    expect(result.current.filters.lat).toBeUndefined();
    expect(result.current.filters.radius).toBeUndefined();
    await unmount();
  });

  it('omits the geo filter while nearby is off even though coords are known', async (): Promise<void> => {
    mockUseNearbyLocation.mockReturnValue(nearbyState({ isActive: false, coords: ILOILO }));

    const { result, unmount } = await renderHook(() => useGanapDiscovery(), { wrapper: createWrapper() });

    await waitFor((): void => expect(mockedList).toHaveBeenCalled());

    expect(result.current.filters.lat).toBeUndefined();
    expect(result.current.filters.radius).toBeUndefined();
    await unmount();
  });

  it('exposes the nearby controls so the screen needs only this hook', async (): Promise<void> => {
    const toggle = jest.fn();
    mockUseNearbyLocation.mockReturnValue(nearbyState({ isActive: true, coords: ILOILO, toggle }));

    const { result, unmount } = await renderHook(() => useGanapDiscovery(), { wrapper: createWrapper() });

    await waitFor((): void => expect(mockedList).toHaveBeenCalled());

    expect(result.current.nearby.isActive).toBe(true);
    expect(result.current.nearby.toggle).toBe(toggle);
    await unmount();
  });

  it('gives the map its own items and the feed its own paging state', async (): Promise<void> => {
    const { result, unmount } = await renderHook(() => useGanapDiscovery(), { wrapper: createWrapper() });

    await waitFor((): void => expect(result.current.map.items).toHaveLength(2));
    await waitFor((): void => expect(result.current.feed.items).toHaveLength(2));

    expect(result.current.feed.hasNextPage).toBe(false);
    await unmount();
  });
});
