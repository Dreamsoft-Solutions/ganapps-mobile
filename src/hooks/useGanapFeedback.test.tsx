import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { useAuthStore } from '@/store/auth.store';
import type { FormBlock, GanapDetail, SubmitFeedbackResponse } from '@/types/ganap.types';
import { ganapQueryKeys } from './queries/useGanapsQuery';
import { profileQueryKeys } from './queries/useProfileQuery';
import { useGanapFeedback } from './useGanapFeedback';

jest.mock('@/api/endpoints/ganaps', () => ({
  ganapsAPI: {
    getById: jest.fn(),
    listFormBlocks: jest.fn(),
    submitFeedback: jest.fn(),
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
const mockedSubmitFeedback = jest.mocked(ganapsAPI.submitFeedback);
const mockedRateGanap = jest.mocked(ganapsAPI.rateGanap);
const mockedSubmitFormAnswers = jest.mocked(ganapsAPI.submitFormAnswers);
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

/**
 * An attended Ganap whose rating is explicitly absent, so the route offers feedback.
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
  attendanceOpenMinutesBefore: 30,
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
    postAttendanceFormSubmittedAt: null,
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

  it('submits feedback atomically and invalidates detail, lists, and profile', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedGetById.mockResolvedValue(attendedGanapWithNoRating);
    mockedListFormBlocks.mockResolvedValue([]);

    const response: SubmitFeedbackResponse = {
      myRating: 5,
      postAttendanceFormSubmittedAt: null,
    };
    let resolveSubmission: ((value: SubmitFeedbackResponse) => void) | undefined;
    const pendingSubmission: Promise<SubmitFeedbackResponse> = new Promise<SubmitFeedbackResponse>(
      (resolve: (value: SubmitFeedbackResponse) => void): void => {
        resolveSubmission = resolve;
      },
    );
    mockedSubmitFeedback.mockReturnValue(pendingSubmission);

    const client = queryClient();
    const invalidateQueries = jest.spyOn(client, 'invalidateQueries');
    invalidateQueries.mockResolvedValue();
    const { result, unmount } = await renderHook(() => useGanapFeedback('g1'), { wrapper: wrapperFor(client) });

    await waitFor((): void => expect(result.current.isLoading).toBe(false));
    let submission: Promise<SubmitFeedbackResponse> | null = null;
    await act(async (): Promise<void> => {
      submission = result.current.submitFeedback({ ganapId: 'g1', input: { rating: 5 } });
      await Promise.resolve();
    });

    await waitFor((): void => expect(result.current.isSubmitting).toBe(true));
    expect(mockedSubmitFeedback).toHaveBeenCalledWith('g1', { rating: 5 });
    expect(mockedRateGanap).not.toHaveBeenCalled();
    expect(mockedSubmitFormAnswers).not.toHaveBeenCalled();

    if (resolveSubmission === undefined || submission === null) {
      throw new Error('The feedback submission promise was not initialized');
    }
    const activeSubmission: Promise<SubmitFeedbackResponse> = submission;
    resolveSubmission(response);
    await act(async (): Promise<void> => {
      await activeSubmission;
    });

    await waitFor((): void => expect(result.current.isSubmitting).toBe(false));
    expect(result.current.submissionError).toBeNull();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.detail('g1') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.lists() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: profileQueryKeys.all });
    unmount();
  });

  it('exposes a rejected combined submission error without calling legacy mutations', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedGetById.mockResolvedValue(attendedGanapWithNoRating);
    mockedListFormBlocks.mockResolvedValue([]);
    const submissionError = new Error('server failed');
    mockedSubmitFeedback.mockRejectedValue(submissionError);

    const { result, unmount } = await renderHook(() => useGanapFeedback('g1'), { wrapper: wrapperFor(queryClient()) });

    await waitFor((): void => expect(result.current.isLoading).toBe(false));
    await act(async (): Promise<void> => {
      await expect(result.current.submitFeedback({ ganapId: 'g1', input: { rating: 5 } })).rejects.toBe(
        submissionError,
      );
    });

    await waitFor((): void => expect(result.current.submissionError).toBe(submissionError));
    expect(result.current.isSubmitting).toBe(false);
    expect(mockedRateGanap).not.toHaveBeenCalled();
    expect(mockedSubmitFormAnswers).not.toHaveBeenCalled();
    unmount();
  });
});
