import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { createElement } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage } from '@/api/types/api-response';
import type { GanapListItem } from '@/types/ganap.types';
import { useGanapFilters } from './useGanapFilters';

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (): Record<string, unknown> => ({}),
}));

jest.mock('@/api/endpoints/ganaps', () => ({
  ganapsAPI: { list: jest.fn() },
}));

const mockedList = jest.mocked(ganapsAPI.list);

/** Builds a list item carrying only the fields the hook reads. */
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

function pageWith(items: GanapListItem[]): CursorPage<GanapListItem> {
  return {
    items,
    pagination: { total: items.length, cursor: null, nextCursor: null, limit: 100 },
  };
}

/** Tracks the per-test client so `afterEach` can release its gc timers. */
let testClient: QueryClient | null = null;

function createWrapper(): (props: { children: ReactNode }) => ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  testClient = client;
  return ({ children }: { children: ReactNode }): ReactElement =>
    createElement(QueryClientProvider, { client }, children);
}

const CATALOGUE: GanapListItem[] = [
  ganapWithTags('sportsfest', ['sports', 'tech']),
  ganapWithTags('choir-night', ['music']),
];

describe('useGanapFilters', () => {
  beforeEach((): void => {
    mockedList.mockReset();
    mockedList.mockResolvedValue(pageWith(CATALOGUE));
  });

  /**
   * The vocabulary query sets gcTime to 10 minutes; without this the cache keeps
   * a timer armed past the run and Jest reports an open handle instead of exiting.
   */
  afterEach((): void => {
    testClient?.clear();
    testClient = null;
  });

  it('exposes the whole catalogue vocabulary, sorted, regardless of the active tag', async (): Promise<void> => {
    const { result, unmount } = await renderHook(() => useGanapFilters(), { wrapper: createWrapper() });

    await waitFor((): void => expect(result.current.tags).toEqual(['music', 'sports', 'tech']));

    await act(async (): Promise<void> => {
      result.current.setTag('music');
    });

    expect(result.current.tag).toBe('music');
    expect(result.current.tags).toEqual(['music', 'sports', 'tech']);
    await unmount();
  });

  it('holds the raw search immediately but debounces what consumers filter on', async (): Promise<void> => {
    const { result, unmount } = await renderHook(() => useGanapFilters(), { wrapper: createWrapper() });

    await waitFor((): void => expect(result.current.tags).toHaveLength(3));

    await act(async (): Promise<void> => {
      result.current.setSearch('spo');
    });

    expect(result.current.search).toBe('spo');
    expect(result.current.debouncedSearch).toBeUndefined();

    await waitFor((): void => expect(result.current.debouncedSearch).toBe('spo'), { timeout: 1500 });
    await unmount();
  });

  it('clears the filter again when the search is whitespace only', async (): Promise<void> => {
    const { result, unmount } = await renderHook(() => useGanapFilters(), { wrapper: createWrapper() });

    await act(async (): Promise<void> => {
      result.current.setSearch('sportsfest');
    });
    await waitFor((): void => expect(result.current.debouncedSearch).toBe('sportsfest'), { timeout: 1500 });

    await act(async (): Promise<void> => {
      result.current.setSearch('   ');
    });

    await waitFor((): void => expect(result.current.debouncedSearch).toBeUndefined(), { timeout: 1500 });
    expect(result.current.search).toBe('   ');
    await unmount();
  });

  it('trims a search before publishing it', async (): Promise<void> => {
    const { result, unmount } = await renderHook(() => useGanapFilters(), { wrapper: createWrapper() });

    await act(async (): Promise<void> => {
      result.current.setSearch('  choir  ');
    });

    await waitFor((): void => expect(result.current.debouncedSearch).toBe('choir'), { timeout: 1500 });
    await unmount();
  });
});
