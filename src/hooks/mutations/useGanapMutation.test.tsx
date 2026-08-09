import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type { ReactElement, ReactNode } from 'react';
import axiosInstance from '@/api/axios-instance';
import { enqueueOutbox } from '@/services/sync.service';
import { ganapQueryKeys } from '../queries/useGanapsQuery';
import { profileQueryKeys } from '../queries/useProfileQuery';
import { useCheckInMutation } from './useGanapMutation';

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
 * @returns An axios adapter that always rejects
 */
function serverErrorAdapter(status: number, message: string): (config: AxiosRequestConfig) => Promise<never> {
  return async (config: AxiosRequestConfig): Promise<never> => {
    captured.push(config);
    const error = new axios.AxiosError(message, 'ERR_BAD_REQUEST', config as AxiosResponse['config']);
    error.response = {
      data: { success: false, statusCode: status, message, errorCode: 'BAD_REQUEST' },
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
    axiosInstance.defaults.adapter = serverErrorAdapter(400, 'Invalid QR code');
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
