import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { InfiniteData } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { ReactElement, ReactNode } from 'react';
import axiosInstance from '@/api/axios-instance';
import type { PaginatedResponse } from '@/api/types/api-response';
import { ErrorCodes } from '@/constants/errors';
import { enqueueOutbox } from '@/services/sync.service';
import type { SubmitFeedbackResponse } from '@/types/ganap.types';
import type { SavedGanap } from '@/types/profile.types';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';
import { ganapQueryKeys } from '../queries/useGanapsQuery';
import { profileQueryKeys } from '../queries/useProfileQuery';
import {
  useCheckInMutation,
  useRateGanapMutation,
  useSaveGanapMutation,
  useSubmitFeedbackMutation,
  useSubmitFormAnswersMutation,
} from './useGanapMutation';

jest.mock('@/services/sync.service', () => ({
  enqueueOutbox: jest.fn(),
}));

const mockedEnqueueOutbox = jest.mocked(enqueueOutbox);

/** Requests captured by the fake adapter during a test. */
let captured: AxiosRequestConfig[] = [];

/**
 * Builds an axios adapter that records the outgoing request and replies with
 * the server's standard response envelope wrapping `payload`.
 *
 * @param payload - The inner value the server would return inside `data`
 * @returns An axios adapter suitable for `axiosInstance.defaults.adapter`
 */
function envelopeAdapter(payload: unknown): (config: AxiosRequestConfig) => Promise<AxiosResponse> {
  return async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
    captured.push(config);
    return {
      data: { success: true, statusCode: 200, data: payload, message: 'Success' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: config as AxiosResponse['config'],
    };
  };
}

/**
 * Builds an axios adapter that rejects with a server-shaped error response,
 * as `axios-instance`'s error interceptor's `parseApiError` expects.
 *
 * @param status - HTTP status the simulated response carries
 * @param message - Error message the server would send
 * @param errorCode - Error code the server would send
 * @returns An axios adapter that always rejects
 */
function serverErrorAdapter(
  status: number,
  message: string,
  errorCode: string,
): (config: AxiosRequestConfig) => Promise<never> {
  return async (config: AxiosRequestConfig): Promise<never> => {
    captured.push(config);
    const error = new axios.AxiosError(message, 'ERR_BAD_REQUEST', config as AxiosResponse['config']);
    error.response = {
      data: { success: false, statusCode: status, message, errorCode },
      status,
      statusText: 'Error',
      headers: {},
      config: config as AxiosResponse['config'],
    };
    throw error;
  };
}

/**
 * Builds an axios adapter that rejects as a transport failure that never
 * reached the server — no `.response` at all.
 *
 * @returns An axios adapter that always rejects with a response-less error
 */
function transportErrorAdapter(): (config: AxiosRequestConfig) => Promise<never> {
  return async (config: AxiosRequestConfig): Promise<never> => {
    captured.push(config);
    throw new axios.AxiosError('Network Error', 'ERR_NETWORK', config as AxiosResponse['config']);
  };
}

function wrapperFor(client: QueryClient): ({ children }: { children: ReactNode }) => ReactElement {
  return function QueryWrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function queryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
}

beforeEach(() => {
  captured = [];
});

afterEach(() => {
  axiosInstance.defaults.adapter = undefined;
  jest.clearAllMocks();
});

describe('useCheckInMutation', () => {
  it('resolves recorded on success and invalidates detail, lists, and profile', async () => {
    const resultPayload = {
      id: 'reg-1',
      userId: 'u-1',
      ganapId: 'g-1',
      status: 'ATTENDED',
      createdAt: '2026-08-08T13:00:00.000Z',
    };
    axiosInstance.defaults.adapter = envelopeAdapter(resultPayload);
    const client = queryClient();
    const invalidateQueries = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useCheckInMutation(), { wrapper: wrapperFor(client) });

    let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        ganapId: 'g-1',
        qrHash: 'hash-abc',
        scannedAt: '2026-08-08T13:00:00.000Z',
      });
    });

    expect(outcome).toEqual({ kind: 'recorded', result: resultPayload });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.detail('g-1') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.lists() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: profileQueryKeys.all });
    unmount();
  });

  it('queues the scan with its original scannedAt when the request never reached the server', async () => {
    axiosInstance.defaults.adapter = transportErrorAdapter();
    const client = queryClient();
    const invalidateQueries = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useCheckInMutation(), { wrapper: wrapperFor(client) });

    let outcome: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        ganapId: 'g-1',
        qrHash: 'hash-abc',
        scannedAt: '2026-08-08T13:00:00.000Z',
      });
    });

    expect(outcome).toEqual({ kind: 'queued' });
    expect(mockedEnqueueOutbox).toHaveBeenCalledWith('ganap', 'check-in', {
      ganapId: 'g-1',
      qrHash: 'hash-abc',
      scannedAt: '2026-08-08T13:00:00.000Z',
    });
    expect(invalidateQueries).not.toHaveBeenCalled();
    unmount();
  });

  it('rejects without queueing when the server answered with an error', async () => {
    axiosInstance.defaults.adapter = serverErrorAdapter(400, 'Invalid QR code', 'BAD_REQUEST');
    const client = queryClient();
    const { result, unmount } = await renderHook(() => useCheckInMutation(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ ganapId: 'g-1', qrHash: 'hash-abc', scannedAt: '2026-08-08T13:00:00.000Z' }),
      ).rejects.toThrow('Invalid QR code');
    });

    expect(mockedEnqueueOutbox).not.toHaveBeenCalled();
    unmount();
  });
});

describe('useSubmitFeedbackMutation', () => {
  it('resolves the combined feedback response and invalidates detail, lists, and profile', async () => {
    const response: SubmitFeedbackResponse = {
      myRating: 5,
      postAttendanceFormSubmittedAt: '2026-08-29T04:00:00.000Z',
    };
    axiosInstance.defaults.adapter = envelopeAdapter(response);
    const client = queryClient();
    const invalidateQueries = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useSubmitFeedbackMutation(), { wrapper: wrapperFor(client) });

    let returned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      returned = await result.current.mutateAsync({ ganapId: 'g1', input: { rating: 5 } });
    });

    expect(returned).toEqual(response);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.detail('g1') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.lists() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: profileQueryKeys.all });
    unmount();
  });

  it('rejects a conflicting rating with parsed server metadata', async () => {
    axiosInstance.defaults.adapter = serverErrorAdapter(
      409,
      'This Ganap already has a rating',
      ErrorCodes.FEEDBACK_RATING_CONFLICT,
    );
    const client = queryClient();
    const { result, unmount } = await renderHook(() => useSubmitFeedbackMutation(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await expect(result.current.mutateAsync({ ganapId: 'g1', input: { rating: 5 } })).rejects.toMatchObject({
        errorCode: ErrorCodes.FEEDBACK_RATING_CONFLICT,
        message: 'This Ganap already has a rating',
        status: 409,
      });
    });

    unmount();
  });
});

describe('global error toast suppression', () => {
  /**
   * Reads the `meta` recorded on the single mutation in a client's cache.
   *
   * `useMutation` does not expose its options on the returned result, so the
   * cache entry is the only place the flag can be observed after a run.
   *
   * @param client - The client the mutation ran against
   * @returns The cached mutation's `meta`, or undefined when it carries none
   */
  function metaOf(client: QueryClient): Record<string, unknown> | undefined {
    const [mutation] = client.getMutationCache().getAll();
    return mutation?.meta;
  }

  it('suppresses the global toast for check-in', async () => {
    axiosInstance.defaults.adapter = serverErrorAdapter(400, 'Invalid QR code', 'BAD_REQUEST');
    const client = queryClient();
    const { result, unmount } = await renderHook(() => useCheckInMutation(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ ganapId: 'g-1', qrHash: 'hash-abc', scannedAt: '2026-08-08T13:00:00.000Z' }),
      ).rejects.toThrow('Invalid QR code');
    });

    expect(metaOf(client)).toEqual({ [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true });
    unmount();
  });

  // The feedback route treats `Already rated this event` as silent step
  // completion. A global toast would surface a reconciliation the student is
  // never meant to see, so the flag is part of the behaviour, not a detail.
  it('suppresses the global toast for rating', async () => {
    axiosInstance.defaults.adapter = serverErrorAdapter(400, 'Already rated this event', 'BAD_REQUEST');
    const client = queryClient();
    const { result, unmount } = await renderHook(() => useRateGanapMutation(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await expect(result.current.mutateAsync({ ganapId: 'g-1', input: { score: 4 } })).rejects.toThrow(
        'Already rated this event',
      );
    });

    expect(metaOf(client)).toEqual({ [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true });
    unmount();
  });

  // Shared by the registration and feedback routes; both render the failure
  // inline against the form still on screen.
  it('suppresses the global toast for form answers', async () => {
    axiosInstance.defaults.adapter = serverErrorAdapter(400, 'Required field "Shirt size" is missing', 'BAD_REQUEST');
    const client = queryClient();
    const { result, unmount } = await renderHook(() => useSubmitFormAnswersMutation(), {
      wrapper: wrapperFor(client),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ ganapId: 'g-1', input: { answers: [], scope: 'POST_ATTENDANCE' } }),
      ).rejects.toThrow('Required field "Shirt size" is missing');
    });

    expect(metaOf(client)).toEqual({ [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true });
    unmount();
  });

  it('suppresses the global toast for combined feedback', async () => {
    axiosInstance.defaults.adapter = serverErrorAdapter(
      409,
      'This Ganap already has a rating',
      ErrorCodes.FEEDBACK_RATING_CONFLICT,
    );
    const client = queryClient();
    const { result, unmount } = await renderHook(() => useSubmitFeedbackMutation(), { wrapper: wrapperFor(client) });

    await act(async () => {
      await expect(result.current.mutateAsync({ ganapId: 'g1', input: { rating: 5 } })).rejects.toThrow(
        'This Ganap already has a rating',
      );
    });

    expect(metaOf(client)).toEqual({ [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true });
    unmount();
  });
});

describe('useSaveGanapMutation', () => {
  /**
   * A query client whose cache outlives the assertions.
   *
   * The shared `queryClient()` sets `gcTime: 0`, which collects a query
   * populated by `setQueryData` before it is read back, since nothing observes
   * it. Every cache assertion then sees `undefined` no matter how the mutation
   * behaves, so these tests need a cache that survives.
   *
   * @returns A client that retains query data for the length of the test.
   */
  function savedCacheClient(): QueryClient {
    return new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
        mutations: { retry: false, gcTime: 0 },
      },
    });
  }

  function savedPage(ids: string[]): InfiniteData<PaginatedResponse<SavedGanap>, number> {
    return {
      pages: [
        {
          items: ids.map(
            (id: string): SavedGanap => ({
              id,
              businessId: 'b-1',
              businessName: 'CPU Developers',
              slug: id,
              title: `Event ${id}`,
              startDate: '2026-09-30T00:00:00.000Z',
              endDate: null,
              status: 'PUBLISHED',
              tags: [],
              coverImage: null,
              savedAt: '2026-09-01T00:00:00.000Z',
            }),
          ),
          pagination: { total: ids.length, skip: 0, take: 20, pages: 1 },
        },
      ],
      pageParams: [0],
    };
  }

  function savedIds(client: QueryClient): string[] | undefined {
    return client
      .getQueryData<InfiniteData<PaginatedResponse<SavedGanap>, number>>(profileQueryKeys.savedGanaps(20))
      ?.pages[0].items.map((item: SavedGanap): string => item.id);
  }

  it('removes the row from the saved cache before the request settles', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(undefined);
    const client = savedCacheClient();
    client.setQueryData(profileQueryKeys.savedGanaps(20), savedPage(['g-1', 'g-2']));
    const { result, unmount } = await renderHook(() => useSaveGanapMutation(), { wrapper: wrapperFor(client) });

    await act(async (): Promise<void> => {
      await result.current.mutateAsync({ ganapId: 'g-1', isSaved: true });
    });

    expect(savedIds(client)).toEqual(['g-2']);
    expect(
      client.getQueryData<InfiniteData<PaginatedResponse<SavedGanap>, number>>(profileQueryKeys.savedGanaps(20))
        ?.pages[0].pagination.total,
    ).toBe(1);
    unmount();
  });

  it('invalidates detail, lists, and profile on success', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(undefined);
    const client = savedCacheClient();
    const invalidateQueries = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useSaveGanapMutation(), { wrapper: wrapperFor(client) });

    await act(async (): Promise<void> => {
      await result.current.mutateAsync({ ganapId: 'g-1', isSaved: false });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.detail('g-1') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.lists() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: profileQueryKeys.all });
    unmount();
  });

  it('restores the removed row when the server rejects the unsave', async () => {
    axiosInstance.defaults.adapter = serverErrorAdapter(404, 'Save not found', ErrorCodes.NOT_FOUND);
    const client = savedCacheClient();
    client.setQueryData(profileQueryKeys.savedGanaps(20), savedPage(['g-1', 'g-2']));
    const { result, unmount } = await renderHook(() => useSaveGanapMutation(), { wrapper: wrapperFor(client) });

    await act(async (): Promise<void> => {
      await expect(result.current.mutateAsync({ ganapId: 'g-1', isSaved: true })).rejects.toThrow();
    });

    expect(savedIds(client)).toEqual(['g-1', 'g-2']);
    expect(mockedEnqueueOutbox).not.toHaveBeenCalled();
    unmount();
  });

  it('keeps the row removed and queues replay when the request never reached the server', async () => {
    axiosInstance.defaults.adapter = transportErrorAdapter();
    const client = savedCacheClient();
    client.setQueryData(profileQueryKeys.savedGanaps(20), savedPage(['g-1', 'g-2']));
    const { result, unmount } = await renderHook(() => useSaveGanapMutation(), { wrapper: wrapperFor(client) });

    await act(async (): Promise<void> => {
      await expect(result.current.mutateAsync({ ganapId: 'g-1', isSaved: true })).rejects.toThrow();
    });

    expect(savedIds(client)).toEqual(['g-2']);
    expect(mockedEnqueueOutbox).toHaveBeenCalledWith('ganap', 'unsave', { ganapId: 'g-1' });
    unmount();
  });

  it('leaves the saved cache alone when saving rather than unsaving', async () => {
    axiosInstance.defaults.adapter = envelopeAdapter(undefined);
    const client = savedCacheClient();
    client.setQueryData(profileQueryKeys.savedGanaps(20), savedPage(['g-1']));
    const { result, unmount } = await renderHook(() => useSaveGanapMutation(), { wrapper: wrapperFor(client) });

    await act(async (): Promise<void> => {
      await result.current.mutateAsync({ ganapId: 'g-2', isSaved: false });
    });

    expect(savedIds(client)).toEqual(['g-1']);
    unmount();
  });
});
