import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { PaginatedResponse } from '@/api/types/api-response';
import { useJoinedGanapsQuery } from '@/hooks/queries/useProfileQuery';
import type { JoinedGanap, JoinedGanapFilters } from '@/types/profile.types';
import { useJoinedGanaps } from './useJoinedGanaps';

jest.mock('@/hooks/queries/useProfileQuery', () => ({
  useJoinedGanapsQuery: jest.fn(),
}));

type JoinedGanapPage = PaginatedResponse<JoinedGanap>;
type QueryResult = UseInfiniteQueryResult<InfiniteData<JoinedGanapPage, number>, Error>;

const mockedUseJoinedGanapsQuery = jest.mocked(useJoinedGanapsQuery);

function joinedGanap(overrides: Partial<JoinedGanap> = {}): JoinedGanap {
  return {
    id: 'joined_1',
    businessId: 'business_1',
    businessName: 'CPU Developers',
    slug: 'campus-day',
    title: 'Campus Day',
    startDate: '2026-08-04T09:00:00.000Z',
    endDate: '2026-08-04T17:00:00.000Z',
    status: 'PUBLISHED',
    tags: ['community'],
    coverImage: null,
    registrationStatus: 'REGISTERED',
    registeredAt: '2026-08-01T00:00:00.000Z',
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

describe('useJoinedGanaps', () => {
  it('flattens pages and forwards filters to the query', async (): Promise<void> => {
    const firstItem = joinedGanap({ id: 'joined_1' });
    const secondItem = joinedGanap({ id: 'joined_2' });
    const filters: JoinedGanapFilters = { search: 'design', time: 'UPCOMING' };
    mockedUseJoinedGanapsQuery.mockReturnValue(
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

    const { result } = await renderHook(() => useJoinedGanaps(20, filters));

    expect(result.current.items).toEqual([firstItem, secondItem]);
    expect(result.current.total).toBe(2);
    expect(mockedUseJoinedGanapsQuery).toHaveBeenCalledWith(20, filters);
  });

  it('exposes refetching state and paging controls', async (): Promise<void> => {
    const refetch = jest.fn<QueryResult['refetch']>();
    const fetchNextPage = jest.fn<QueryResult['fetchNextPage']>();
    mockedUseJoinedGanapsQuery.mockReturnValue(
      buildQueryResult({ isRefetching: true, refetch, fetchNextPage, hasNextPage: true, isFetchingNextPage: true }),
    );

    const { result } = await renderHook(() => useJoinedGanaps(20));

    expect(result.current.isRefetching).toBe(true);
    expect(result.current.refetch).toBe(refetch);
    expect(result.current.fetchNextPage).toBe(fetchNextPage);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.isFetchingNextPage).toBe(true);
  });
});
