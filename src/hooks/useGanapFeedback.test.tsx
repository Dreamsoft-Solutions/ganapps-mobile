import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { useAuthStore } from '@/store/auth.store';
import type { FormBlock, GanapDetail, GanapRating } from '@/types/ganap.types';
import { ganapQueryKeys } from './queries/useGanapsQuery';
import { useGanapFeedback } from './useGanapFeedback';

jest.mock('@/api/endpoints/ganaps', () => ({
  ganapsAPI: {
    getById: jest.fn(),
    listFormBlocks: jest.fn(),
    submitFormAnswers: jest.fn(),
    rateGanap: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    like: jest.fn(),
    unlike: jest.fn(),
    save: jest.fn(),
    unsave: jest.fn(),
  },
}));

jest.mock('@/services/sync.service', () => ({ enqueueOutbox: jest.fn() }));

const mockedGetById = jest.mocked(ganapsAPI.getById);
const mockedListFormBlocks = jest.mocked(ganapsAPI.listFormBlocks);
const mockedRateGanap = jest.mocked(ganapsAPI.rateGanap);
const clients: QueryClient[] = [];

const postAttendanceBlock: FormBlock = {
  id: 'block_1',
  ganapId: 'g1',
  scope: 'POST_ATTENDANCE',
  type: 'TEXT',
  label: 'What did you think?',
  isRequired: false,
  allowMultiple: false,
  order: 1,
  config: null,
  options: [],
  createdAt: '2026-08-18T00:00:00.000Z',
  updatedAt: '2026-08-18T00:00:00.000Z',
};

const ratingRow: GanapRating = {
  id: 'rating_1',
  ganapId: 'g1',
  userId: 'u1',
  rating: 5,
  comment: null,
  createdAt: '2026-08-18T00:00:00.000Z',
  updatedAt: '2026-08-18T00:00:00.000Z',
};

/**
 * An attended Ganap whose rating field is present and null — the state in
 * which the rating step is offered.
 */
const attendedGanapWithNoRating: GanapDetail = {
  id: 'g1',
  businessId: 'b1',
  businessName: 'CPU Republic',
  slug: 'foundation-week',
  title: 'Foundation Week',
  description: 'Campus wide celebration',
  locationLat: 10.7,
  locationLong: 122.5,
  startDate: '2026-08-01T00:00:00.000Z',
  status: 'COMPLETED',
  requiresApproval: false,
  tags: [],
  registrationCount: 10,
  myRating: null,
  myRegistration: {
    id: 'reg_1',
    status: 'ATTENDED',
    createdAt: '2026-08-01T00:00:00.000Z',
    registrationFormSubmittedAt: null,
  },
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function wrapperFor(client: QueryClient): ({ children }: { children: ReactNode }) => ReactElement {
  return function QueryWrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function queryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { gcTime: 0 },
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

describe('useGanapFeedback', (): void => {
  it('derives both pending steps from detail and blocks', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedGetById.mockResolvedValue(attendedGanapWithNoRating);
    mockedListFormBlocks.mockResolvedValue([postAttendanceBlock]);

    const { result, unmount } = await renderHook(() => useGanapFeedback('g1'), { wrapper: wrapperFor(queryClient()) });

    await waitFor((): void => expect(result.current.isLoading).toBe(false));
    expect(result.current.pendingSteps).toEqual(['rating', 'form']);
    unmount();
  });

  it('requests blocks in the POST_ATTENDANCE scope', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedGetById.mockResolvedValue(attendedGanapWithNoRating);
    mockedListFormBlocks.mockResolvedValue([]);

    const { result, unmount } = await renderHook(() => useGanapFeedback('g1'), { wrapper: wrapperFor(queryClient()) });

    await waitFor((): void => expect(result.current.isLoading).toBe(false));
    expect(mockedListFormBlocks).toHaveBeenCalledWith('g1', 'POST_ATTENDANCE');
    unmount();
  });

  it('invalidates the detail and list caches after a rating', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedGetById.mockResolvedValue(attendedGanapWithNoRating);
    mockedListFormBlocks.mockResolvedValue([]);
    mockedRateGanap.mockResolvedValue(ratingRow);

    const client = queryClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useGanapFeedback('g1'), { wrapper: wrapperFor(client) });

    await waitFor((): void => expect(result.current.isLoading).toBe(false));
    await act(async (): Promise<void> => {
      await result.current.submitRating({ ganapId: 'g1', input: { score: 5 } });
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.detail('g1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.lists() });
    unmount();
  });

  it('rejects a duplicate rating so the route can reconcile it', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedGetById.mockResolvedValue(attendedGanapWithNoRating);
    mockedListFormBlocks.mockResolvedValue([]);
    mockedRateGanap.mockRejectedValue(new Error('Already rated this event'));

    const { result, unmount } = await renderHook(() => useGanapFeedback('g1'), { wrapper: wrapperFor(queryClient()) });

    await waitFor((): void => expect(result.current.isLoading).toBe(false));
    await expect(result.current.submitRating({ ganapId: 'g1', input: { score: 5 } })).rejects.toThrow(
      'Already rated this event',
    );
    unmount();
  });
});
