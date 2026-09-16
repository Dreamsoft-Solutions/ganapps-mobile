import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import * as React from 'react';
import { profileAPI } from '@/api/endpoints/profile';
import type { PaginatedResponse } from '@/api/types/api-response';
import { useAuthStore } from '@/store/auth.store';
import type { JoinedGanap, JoinedGanapFilters, JoinedGanapParams } from '@/types/profile.types';
import { getNextJoinedGanapPageParam, profileQueryKeys, useJoinedGanapsQuery } from './useProfileQuery';

jest.mock('@/api/endpoints/profile', () => ({
  profileAPI: { listJoinedGanaps: jest.fn() },
}));

type JoinedGanapPage = PaginatedResponse<JoinedGanap>;

const mockedListJoinedGanaps = jest.mocked(profileAPI.listJoinedGanaps);
const clients: QueryClient[] = [];

function wrapperFor(client: QueryClient): ({ children }: { children: ReactNode }) => ReactElement {
  return function QueryWrapper({ children }: { children: ReactNode }): ReactElement {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

function queryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
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

describe('getNextJoinedGanapPageParam', () => {
  it('returns the next offset while pages remain', () => {
    expect(
      getNextJoinedGanapPageParam({
        items: [],
        pagination: { total: 25, skip: 0, take: 10, pages: 3 },
      }),
    ).toBe(10);
  });

  it('stops after the final page', () => {
    expect(
      getNextJoinedGanapPageParam({
        items: [],
        pagination: { total: 20, skip: 10, take: 10, pages: 2 },
      }),
    ).toBeUndefined();
  });
});

describe('profileQueryKeys.joinedGanaps', () => {
  it('changes the query key when either filter changes', () => {
    expect(profileQueryKeys.joinedGanaps(20, { time: 'UPCOMING' })).not.toEqual(
      profileQueryKeys.joinedGanaps(20, { time: 'PAST' }),
    );
    expect(profileQueryKeys.joinedGanaps(20, { search: 'design', time: 'ALL' })).not.toEqual(
      profileQueryKeys.joinedGanaps(20, { search: 'art', time: 'ALL' }),
    );
  });
});

describe('useJoinedGanapsQuery', () => {
  it('starts a new filter key at offset zero', async (): Promise<void> => {
    const requestedSkips: number[] = [];
    mockedListJoinedGanaps.mockImplementation(async (params: JoinedGanapParams = {}): Promise<JoinedGanapPage> => {
      requestedSkips.push(params.skip ?? -1);
      return {
        items: [],
        pagination: { skip: params.skip ?? 0, take: 20, total: 0, pages: 0 },
      };
    });
    useAuthStore.setState({ token: 'access-token' });

    const screen = await renderHook(
      ({ filters }: { filters: JoinedGanapFilters }): unknown => useJoinedGanapsQuery(20, filters),
      {
        initialProps: { filters: { time: 'UPCOMING' } },
        wrapper: wrapperFor(queryClient()),
      },
    );

    await waitFor((): void => expect(requestedSkips).toContain(0));
    await screen.rerender({ filters: { time: 'PAST' } });
    await waitFor((): void => {
      expect(requestedSkips.filter((skip: number): boolean => skip === 0)).toHaveLength(2);
    });
    await screen.unmount();
  });
});
