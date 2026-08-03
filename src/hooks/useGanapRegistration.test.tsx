import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { enqueueOutbox } from '@/services/sync.service';
import { useAuthStore } from '@/store/auth.store';
import type { FormBlock, JoinGanapResult, SubmitFormAnswersInput } from '@/types/ganap.types';
import { useSubmitFormAnswersMutation } from './mutations/useGanapMutation';
import { ganapQueryKeys, useRegistrationFormBlocksQuery } from './queries/useGanapsQuery';
import { profileQueryKeys } from './queries/useProfileQuery';
import { useGanapRegistration } from './useGanapRegistration';

jest.mock('@/api/endpoints/ganaps', () => ({
  ganapsAPI: {
    getById: jest.fn(),
    listFormBlocks: jest.fn(),
    submitFormAnswers: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    like: jest.fn(),
    unlike: jest.fn(),
    save: jest.fn(),
    unsave: jest.fn(),
  },
}));

jest.mock('@/services/sync.service', () => ({ enqueueOutbox: jest.fn() }));

const mockedListFormBlocks = jest.mocked(ganapsAPI.listFormBlocks);
const mockedSubmitFormAnswers = jest.mocked(ganapsAPI.submitFormAnswers);
const mockedEnqueueOutbox = jest.mocked(enqueueOutbox);
const clients: QueryClient[] = [];

const block: FormBlock = {
  id: 'block_text',
  ganapId: 'g1',
  scope: 'REGISTRATION',
  type: 'TEXT',
  label: 'Why do you want to attend?',
  isRequired: true,
  allowMultiple: false,
  order: 1,
  config: null,
  options: [],
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const input: SubmitFormAnswersInput = {
  answers: [{ formBlockId: 'block_text', textValue: 'To learn.' }],
};

const registration: JoinGanapResult = {
  id: 'r1',
  userId: 'u1',
  ganapId: 'g1',
  status: 'REGISTERED',
  createdAt: '2026-08-03T00:00:00.000Z',
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

function variables(): { ganapId: string; input: SubmitFormAnswersInput } {
  return { ganapId: 'g1', input };
}

afterEach((): void => {
  clients.forEach((client: QueryClient): void => {
    client.clear();
  });
  clients.length = 0;
  jest.clearAllMocks();
  useAuthStore.setState({ token: null });
});

describe('useRegistrationFormBlocksQuery', (): void => {
  it('stays idle without a token', async (): Promise<void> => {
    useAuthStore.setState({ token: null });
    const { result, unmount } = await renderHook(() => useRegistrationFormBlocksQuery('g1'), {
      wrapper: wrapperFor(queryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedListFormBlocks).not.toHaveBeenCalled();
    unmount();
  });

  it('stays idle without a Ganap ID', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    const { result, unmount } = await renderHook(() => useRegistrationFormBlocksQuery(''), {
      wrapper: wrapperFor(queryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedListFormBlocks).not.toHaveBeenCalled();
    unmount();
  });

  it('fetches registration-scoped blocks when authenticated', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedListFormBlocks.mockResolvedValue([block]);
    const { result, unmount } = await renderHook(() => useRegistrationFormBlocksQuery('g1'), {
      wrapper: wrapperFor(queryClient()),
    });

    await waitFor((): void => expect(result.current.data).toEqual([block]));
    expect(mockedListFormBlocks).toHaveBeenCalledWith('g1', 'REGISTRATION');
    unmount();
  });

  it('uses a form-block key distinct from Ganap detail and containing the scope', (): void => {
    expect(ganapQueryKeys.formBlocks('g1', 'REGISTRATION')).not.toEqual(ganapQueryKeys.detail('g1'));
    expect(ganapQueryKeys.formBlocks('g1', 'REGISTRATION')).toEqual([
      'ganaps',
      'detail',
      'g1',
      'form-blocks',
      'REGISTRATION',
    ]);
  });
});

describe('useSubmitFormAnswersMutation', (): void => {
  it('submits the untouched Ganap ID and input values', async (): Promise<void> => {
    mockedSubmitFormAnswers.mockResolvedValue(registration);
    const { result, unmount } = await renderHook(() => useSubmitFormAnswersMutation(), {
      wrapper: wrapperFor(queryClient()),
    });

    await act(async (): Promise<void> => {
      await result.current.mutateAsync(variables());
    });

    expect(mockedSubmitFormAnswers).toHaveBeenCalledWith('g1', input);
    unmount();
  });

  it('invalidates detail, browse, and joined Ganap caches on success', async (): Promise<void> => {
    mockedSubmitFormAnswers.mockResolvedValue(registration);
    const client: QueryClient = queryClient();
    const invalidateQueries = jest.spyOn(client, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useSubmitFormAnswersMutation(), {
      wrapper: wrapperFor(client),
    });

    await act(async (): Promise<void> => {
      await result.current.mutateAsync(variables());
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.detail('g1') });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.lists() });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: profileQueryKeys.all });
    unmount();
  });

  it('keeps submission failures on the mutation and never queues them offline', async (): Promise<void> => {
    const error: Error = new Error('Unable to submit answers');
    mockedSubmitFormAnswers.mockRejectedValue(error);
    const { result, unmount } = await renderHook(() => useSubmitFormAnswersMutation(), {
      wrapper: wrapperFor(queryClient()),
    });

    await act(async (): Promise<void> => {
      await expect(result.current.mutateAsync(variables())).rejects.toThrow(error);
    });

    await waitFor((): void => expect(result.current.error).toBe(error));
    expect(mockedEnqueueOutbox).not.toHaveBeenCalled();
    unmount();
  });
});

describe('useGanapRegistration', (): void => {
  it('exposes only the form query and answer mutation state', async (): Promise<void> => {
    useAuthStore.setState({ token: 'access-token' });
    mockedListFormBlocks.mockResolvedValue([block]);
    const client: QueryClient = queryClient();
    const { result, unmount } = await renderHook(() => useGanapRegistration('g1'), {
      wrapper: wrapperFor(client),
    });

    await waitFor((): void => expect(result.current.blocks).toEqual([block]));
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.submitError).toBeNull();
    expect(client.getQueryCache().find({ queryKey: ganapQueryKeys.infiniteList() })).toBeUndefined();
    unmount();
  });
});
