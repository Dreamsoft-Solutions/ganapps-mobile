import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { AnnouncementPage } from '@/hooks/queries/useGanapAnnouncementsQuery';
import { useGanapAnnouncementsQuery } from '@/hooks/queries/useGanapAnnouncementsQuery';
import type { GanapAnnouncement } from '@/types/ganap.types';
import { useGanapAnnouncements } from './useGanapAnnouncements';

jest.mock('@/hooks/queries/useGanapAnnouncementsQuery', () => ({
  useGanapAnnouncementsQuery: jest.fn(),
}));

const mockedUseGanapAnnouncementsQuery = jest.mocked(useGanapAnnouncementsQuery);

type QueryResult = UseInfiniteQueryResult<InfiniteData<AnnouncementPage, number>, Error>;

function announcement(overrides: Partial<GanapAnnouncement> = {}): GanapAnnouncement {
  return {
    id: 'announcement_1',
    ganapId: 'g1',
    createdByUserId: 'user_1',
    createdByUsername: 'Miguel Santos',
    type: 'GENERAL',
    title: null,
    content: 'Welcome!',
    createdAt: '2026-08-04T00:00:00.000Z',
    ...overrides,
  };
}

function buildQueryResult(overrides: Partial<QueryResult> = {}): QueryResult {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    ...overrides,
  } as QueryResult;
}

afterEach((): void => {
  jest.clearAllMocks();
});

describe('useGanapAnnouncements', () => {
  it('flattens announcements across pages in server order', async (): Promise<void> => {
    const firstItem = announcement({ id: 'a1' });
    const secondItem = announcement({ id: 'a2' });
    mockedUseGanapAnnouncementsQuery.mockReturnValue(
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

    const { result } = await renderHook(() => useGanapAnnouncements('g1', true));

    expect(result.current.announcements).toEqual([firstItem, secondItem]);
  });

  it('reads total from the first page pagination metadata', async (): Promise<void> => {
    mockedUseGanapAnnouncementsQuery.mockReturnValue(
      buildQueryResult({
        data: {
          pages: [{ items: [announcement()], pagination: { total: 21, skip: 0, take: 20, pages: 2 } }],
          pageParams: [0],
        },
      }),
    );

    const { result } = await renderHook(() => useGanapAnnouncements('g1', true));

    expect(result.current.total).toBe(21);
  });

  it('defaults announcements and total when there is no data yet', async (): Promise<void> => {
    mockedUseGanapAnnouncementsQuery.mockReturnValue(buildQueryResult());

    const { result } = await renderHook(() => useGanapAnnouncements('g1', true));

    expect(result.current.announcements).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('normalizes nullable TanStack booleans', async (): Promise<void> => {
    mockedUseGanapAnnouncementsQuery.mockReturnValue(
      buildQueryResult({
        hasNextPage: undefined as unknown as boolean,
        isFetchingNextPage: undefined as unknown as boolean,
        isFetchNextPageError: undefined as unknown as boolean,
      }),
    );

    const { result } = await renderHook(() => useGanapAnnouncements('g1', true));

    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.isFetchingNextPage).toBe(false);
    expect(result.current.isFetchNextPageError).toBe(false);
  });

  it('reports hasLostAccess for an initial 403 error with no data', async (): Promise<void> => {
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 });
    mockedUseGanapAnnouncementsQuery.mockReturnValue(buildQueryResult({ error: forbidden }));

    const { result } = await renderHook(() => useGanapAnnouncements('g1', true));

    expect(result.current.hasLostAccess).toBe(true);
    expect(result.current.announcements).toEqual([]);
  });

  it('reports hasLostAccess for a later-page 403 error even with cached data', async (): Promise<void> => {
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 });
    mockedUseGanapAnnouncementsQuery.mockReturnValue(
      buildQueryResult({
        error: forbidden,
        data: {
          pages: [{ items: [announcement()], pagination: { total: 1, skip: 0, take: 20, pages: 1 } }],
          pageParams: [0],
        },
      }),
    );

    const { result } = await renderHook(() => useGanapAnnouncements('g1', true));

    expect(result.current.hasLostAccess).toBe(true);
  });

  it('does not report hasLostAccess for a non-403 error', async (): Promise<void> => {
    mockedUseGanapAnnouncementsQuery.mockReturnValue(buildQueryResult({ error: new Error('Server error') }));

    const { result } = await renderHook(() => useGanapAnnouncements('g1', true));

    expect(result.current.hasLostAccess).toBe(false);
  });

  it('forwards the ganap id and eligibility to the underlying query', async (): Promise<void> => {
    mockedUseGanapAnnouncementsQuery.mockReturnValue(buildQueryResult());

    await renderHook(() => useGanapAnnouncements('g1', false));

    expect(mockedUseGanapAnnouncementsQuery).toHaveBeenCalledWith('g1', false);
  });
});
