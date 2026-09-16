import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { businessesAPI } from '@/api/endpoints/businesses';
import { ganapQueryKeys } from '@/hooks/queries/useGanapsQuery';
import { useAuthStore } from '@/store/auth.store';
import type { BusinessDetail } from '@/types/business.types';
import { businessQueryKeys, useBusinessDetailQuery } from './useBusinessesQuery';

jest.mock('@/api/endpoints/businesses', () => ({
  businessesAPI: { getById: jest.fn() },
}));

const mockedGetById = jest.mocked(businessesAPI.getById);
const clients: QueryClient[] = [];
const business: BusinessDetail = {
  id: 'business_1',
  name: 'CPU Developers',
  slug: 'cpu-developers',
  verificationStatus: 'ACTIVE',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function wrapperFor(client: QueryClient): ({ children }: { children: ReactNode }) => ReactElement {
  return function QueryWrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function queryClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
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

describe('useBusinessDetailQuery', (): void => {
  it('stays idle without a token', async (): Promise<void> => {
    useAuthStore.setState({ token: null });
    const { result, unmount } = await renderHook(() => useBusinessDetailQuery('business_1'), {
      wrapper: wrapperFor(queryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedGetById).not.toHaveBeenCalled();
    unmount();
  });

  it('stays idle without a business id', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const { result, unmount } = await renderHook(() => useBusinessDetailQuery(undefined), {
      wrapper: wrapperFor(queryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedGetById).not.toHaveBeenCalled();
    unmount();
  });

  it('fetches independently when token and id are present', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedGetById.mockResolvedValue(business);
    const { result, unmount } = await renderHook(() => useBusinessDetailQuery('business_1'), {
      wrapper: wrapperFor(queryClient()),
    });

    await waitFor((): void => {
      expect(result.current.data).toEqual(business);
    });
    expect(mockedGetById).toHaveBeenCalledWith('business_1');
    unmount();
  });

  it('uses a domain-specific key that cannot collide with Ganap detail', (): void => {
    expect(businessQueryKeys.detail('business_1')).not.toEqual(ganapQueryKeys.detail('business_1'));
  });
});
