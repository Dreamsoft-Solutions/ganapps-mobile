import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { PaginatedResponse } from '@/api/types/api-response';
import { useSavedGanapsQuery } from '@/hooks/queries/useProfileQuery';
import type { SavedGanap } from '@/types/profile.types';
import { useSavedGanaps } from './useSavedGanaps';

jest.mock('@/hooks/queries/useProfileQuery', () => ({
  useSavedGanapsQuery: jest.fn(),
}));

type SavedGanapPage = PaginatedResponse<SavedGanap>;
type QueryResult = UseInfiniteQueryResult<InfiniteData<SavedGanapPage, number>, Error>;

const mockedUseSavedGanapsQuery = jest.mocked(useSavedGanapsQuery);

function savedGanap(overrides: Partial<SavedGanap> = {}): SavedGanap {
  return {
    id: 'saved_1',
    businessId: 'business_1',
    businessName: 'CPU Developers',
    slug: 'campus-day',
    title: 'Campus Day',
    startDate: '2026-08-04T09:00:00.000Z',
    endDate: '2026-08-04T17:00:00.000Z',
    status: 'PUBLISHED',
    tags: ['community'],
    coverImage: null,
    savedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildQueryResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    isRefetching: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    ...overrides,
  } as QueryResult;
}

afterEach((): void => {
  jest.clearAllMocks();
});

describe('useSavedGanaps', () => {
  it('flattens pages and forwards the page size to the query', async (): Promise<void> => {
    const firstItem = savedGanap({ id: 'saved_1' });
    const secondItem = savedGanap({ id: 'saved_2' });
    mockedUseSavedGanapsQuery.mockReturnValue(
      buildQueryResult({
        data: {
          pages: [
            { items: [firstItem], pagination: { total: 2, skip: 0, take: 20, pages: 1 } },
            { items: [secondItem], pagination: { total: 2, skip: 20, take: 20, pages: 1 } },
          ],
          pageParams: [0, 20],
        },
      }),
    );

    const { result } = await renderHook(() => useSavedGanaps(20));

    expect(result.current.items).toEqual([firstItem, secondItem]);
    expect(result.current.total).toBe(2);
    expect(mockedUseSavedGanapsQuery).toHaveBeenCalledWith(20);
  });

  it('reports an empty list and zero total before any page arrives', async (): Promise<void> => {
    mockedUseSavedGanapsQuery.mockReturnValue(buildQueryResult({ isLoading: true }));

    const { result } = await renderHook(() => useSavedGanaps(20));

    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });

  it('exposes refetching state and paging controls', async (): Promise<void> => {
    const refetch = jest.fn<QueryResult['refetch']>();
    const fetchNextPage = jest.fn<QueryResult['fetchNextPage']>();
    mockedUseSavedGanapsQuery.mockReturnValue(
      buildQueryResult({ isRefetching: true, refetch, fetchNextPage, hasNextPage: true, isFetchingNextPage: true }),
    );

    const { result } = await renderHook(() => useSavedGanaps(20));

    expect(result.current.isRefetching).toBe(true);
    expect(result.current.refetch).toBe(refetch);
    expect(result.current.fetchNextPage).toBe(fetchNextPage);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.isFetchingNextPage).toBe(true);
  });
});
