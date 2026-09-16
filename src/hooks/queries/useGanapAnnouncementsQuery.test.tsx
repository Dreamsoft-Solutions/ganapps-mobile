import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { useAuthStore } from '@/store/auth.store';
import type { GanapAnnouncement } from '@/types/ganap.types';
import {
  ANNOUNCEMENT_PAGE_SIZE,
  type AnnouncementPage,
  getNextAnnouncementPageParam,
  useGanapAnnouncementsQuery,
} from './useGanapAnnouncementsQuery';
import { ganapQueryKeys } from './useGanapsQuery';

jest.mock('@/api/endpoints/ganaps', () => ({
  ganapsAPI: { listUserAnnouncements: jest.fn() },
}));

const mockedListUserAnnouncements = jest.mocked(ganapsAPI.listUserAnnouncements);
const clients: QueryClient[] = [];

function announcement(overrides: Partial<GanapAnnouncement> = {}): GanapAnnouncement {
  return {
    id: 'announcement_1',
    ganapId: 'g1',
    createdByUserId: 'user_1',
    createdByUsername: 'Miguel Santos',
    type: 'GENERAL',
    title: null,
    content: 'Welcome to the event hub.',
    createdAt: '2026-08-04T00:00:00.000Z',
    ...overrides,
  };
}

function page(items: GanapAnnouncement[], pagination: AnnouncementPage['pagination']): AnnouncementPage {
  return { items, pagination };
}

function wrapperFor(client: QueryClient): ({ children }: { children: ReactNode }) => ReactElement {
  return function QueryWrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function queryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retryDelay: 0, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
    },
  });
  clients.push(client);
  return client;
}

afterEach((): void => {
  clients.forEach((client: QueryClient): void => {
    client.clear();
  });
  clients.length = 0;
  jest.clearAllMocks();
  useAuthStore.setState({ token: null });
});

describe('getNextAnnouncementPageParam', () => {
  it('returns the next offset when more items remain beyond the loaded count', () => {
    const firstPage = page(new Array(20).fill(announcement()), { total: 21, skip: 0, take: 20, pages: 2 });

    expect(getNextAnnouncementPageParam(firstPage, [firstPage])).toBe(20);
  });

  it('returns undefined once the loaded count reaches the total', () => {
    const firstPage = page(new Array(20).fill(announcement()), { total: 21, skip: 0, take: 20, pages: 2 });
    const secondPage = page([announcement()], { total: 21, skip: 20, take: 20, pages: 2 });

    expect(getNextAnnouncementPageParam(secondPage, [firstPage, secondPage])).toBeUndefined();
  });
});

describe('useGanapAnnouncementsQuery', () => {
  it('stays idle without a token', async (): Promise<void> => {
    useAuthStore.setState({ token: null });
    const { result, unmount } = await renderHook(() => useGanapAnnouncementsQuery('g1', true), {
      wrapper: wrapperFor(queryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedListUserAnnouncements).not.toHaveBeenCalled();
    unmount();
  });

  it('stays idle with an empty Ganap id', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const { result, unmount } = await renderHook(() => useGanapAnnouncementsQuery('', true), {
      wrapper: wrapperFor(queryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedListUserAnnouncements).not.toHaveBeenCalled();
    unmount();
  });

  it('stays idle when the caller is not eligible', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const { result, unmount } = await renderHook(() => useGanapAnnouncementsQuery('g1', false), {
      wrapper: wrapperFor(queryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedListUserAnnouncements).not.toHaveBeenCalled();
    unmount();
  });

  it('fetches the first page with skip 0 and the fixed page size when eligible', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedListUserAnnouncements.mockResolvedValue(
      page([announcement()], { total: 1, skip: 0, take: ANNOUNCEMENT_PAGE_SIZE, pages: 1 }),
    );
    const { result, unmount } = await renderHook(() => useGanapAnnouncementsQuery('g1', true), {
      wrapper: wrapperFor(queryClient()),
    });

    await waitFor((): void => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(mockedListUserAnnouncements).toHaveBeenCalledWith('g1', { skip: 0, take: ANNOUNCEMENT_PAGE_SIZE });
    unmount();
  });

  it('uses a query key nested beneath the Ganap detail key', () => {
    expect(ganapQueryKeys.announcements('g1')).toEqual([...ganapQueryKeys.detail('g1'), 'announcements', 'user']);
  });

  it('appends the next page while keeping the first page on fetchNextPage', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const firstPageItems = new Array(ANNOUNCEMENT_PAGE_SIZE)
      .fill(null)
      .map((_, index: number): GanapAnnouncement => announcement({ id: `a${index}` }));
    const secondItem = announcement({ id: 'a-last' });
    mockedListUserAnnouncements
      .mockResolvedValueOnce(page(firstPageItems, { total: 21, skip: 0, take: ANNOUNCEMENT_PAGE_SIZE, pages: 2 }))
      .mockResolvedValueOnce(
        page([secondItem], { total: 21, skip: ANNOUNCEMENT_PAGE_SIZE, take: ANNOUNCEMENT_PAGE_SIZE, pages: 2 }),
      );
    const client = queryClient();
    const { result, unmount } = await renderHook(() => useGanapAnnouncementsQuery('g1', true), {
      wrapper: wrapperFor(client),
    });

    await waitFor((): void => {
      expect(result.current.isSuccess).toBe(true);
    });

    await result.current.fetchNextPage();

    await waitFor((): void => {
      const cached = client.getQueryData<{ pages: AnnouncementPage[] }>(ganapQueryKeys.announcements('g1'));
      expect(cached?.pages).toHaveLength(2);
    });
    const cachedData = client.getQueryData<{ pages: AnnouncementPage[] }>(ganapQueryKeys.announcements('g1'));
    expect(cachedData?.pages[0].items).toEqual(firstPageItems);
    expect(cachedData?.pages[1].items).toEqual([secondItem]);
    expect(mockedListUserAnnouncements).toHaveBeenNthCalledWith(2, 'g1', {
      skip: ANNOUNCEMENT_PAGE_SIZE,
      take: ANNOUNCEMENT_PAGE_SIZE,
    });
    unmount();
  });

  it('exposes an error with no items when the first page fails', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedListUserAnnouncements.mockRejectedValue(new Error('Server error'));
    const { result, unmount } = await renderHook(() => useGanapAnnouncementsQuery('g1', true), {
      wrapper: wrapperFor(queryClient()),
    });

    await waitFor((): void => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
    unmount();
  });

  it('keeps prior items and sets isFetchNextPageError when a later page fails', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const firstItem = announcement({ id: 'a1' });
    mockedListUserAnnouncements
      .mockResolvedValueOnce(page([firstItem], { total: 2, skip: 0, take: ANNOUNCEMENT_PAGE_SIZE, pages: 2 }))
      .mockRejectedValue(new Error('Server error'));
    const { result, unmount } = await renderHook(() => useGanapAnnouncementsQuery('g1', true), {
      wrapper: wrapperFor(queryClient()),
    });

    await waitFor((): void => {
      expect(result.current.isSuccess).toBe(true);
    });

    await result.current.fetchNextPage();

    await waitFor((): void => {
      expect(result.current.isFetchNextPageError).toBe(true);
    });
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0].items).toEqual([firstItem]);
    unmount();
  });

  it('does not retry a normalized 403', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const forbidden = Object.assign(new Error('Forbidden'), { status: 403 });
    mockedListUserAnnouncements.mockRejectedValue(forbidden);
    const { result, unmount } = await renderHook(() => useGanapAnnouncementsQuery('g1', true), {
      wrapper: wrapperFor(queryClient()),
    });

    await waitFor((): void => {
      expect(result.current.isError).toBe(true);
    });
    expect(mockedListUserAnnouncements).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('retries once for a non-403 failure', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedListUserAnnouncements.mockRejectedValue(new Error('Server error'));
    const { result, unmount } = await renderHook(() => useGanapAnnouncementsQuery('g1', true), {
      wrapper: wrapperFor(queryClient()),
    });

    await waitFor((): void => {
      expect(result.current.isError).toBe(true);
    });
    expect(mockedListUserAnnouncements).toHaveBeenCalledTimes(2);
    unmount();
  });
});
