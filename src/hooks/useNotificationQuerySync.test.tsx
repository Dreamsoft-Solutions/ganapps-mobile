import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { AppState, type AppStateEvent, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { ganapQueryKeys } from '@/hooks/queries/useGanapsQuery';
import { profileQueryKeys } from '@/hooks/queries/useProfileQuery';
import type { NotificationDataListener } from '@/services/push-notification.service';

const mockStartNotificationResponseObserver = jest.fn<(listener?: NotificationDataListener) => () => void>();
const mockNotificationObserverCleanup = jest.fn<() => void>();

jest.mock('@/services/push-notification.service', () => ({
  startNotificationResponseObserver: mockStartNotificationResponseObserver,
}));

const { useNotificationQuerySync } =
  require('./useNotificationQuerySync') as typeof import('./useNotificationQuerySync');

let capturedNotificationListeners: NotificationDataListener[] = [];
let mockAppStateChange: ((state: AppStateStatus) => void) | null = null;
let mockAppStateRemove: jest.Mock<() => void>;
let addAppStateListener: jest.SpiedFunction<typeof AppState.addEventListener>;

function queryClientWrapper(client: QueryClient): ({ children }: { children: ReactNode }) => ReactElement {
  return function QueryClientWrapper({ children }: { children: ReactNode }): ReactElement {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeQueryClientSpy(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
    },
  });
  jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
  return queryClient;
}

function captureNotificationListener(): NotificationDataListener {
  const listener = capturedNotificationListeners.at(-1);
  if (listener === undefined) throw new Error('Expected a notification listener to be registered');
  return listener;
}

beforeEach((): void => {
  capturedNotificationListeners = [];
  mockNotificationObserverCleanup.mockClear();
  mockStartNotificationResponseObserver
    .mockClear()
    .mockImplementation((listener?: NotificationDataListener): (() => void) => {
      if (listener !== undefined) capturedNotificationListeners.push(listener);
      return mockNotificationObserverCleanup;
    });

  mockAppStateChange = null;
  mockAppStateRemove = jest.fn<() => void>();
  addAppStateListener = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation(
      (_eventType: AppStateEvent, listener: (state: AppStateStatus) => void): NativeEventSubscription => {
        mockAppStateChange = listener;
        return { remove: mockAppStateRemove };
      },
    );
});

afterEach((): void => {
  addAppStateListener.mockRestore();
});

describe('useNotificationQuerySync', (): void => {
  it('invalidates the affected detail, Ganap lists, and profile families', async (): Promise<void> => {
    const queryClient = makeQueryClientSpy();
    await renderHook(() => useNotificationQuerySync(), { wrapper: queryClientWrapper(queryClient) });

    const notificationListener = captureNotificationListener();
    notificationListener({
      source: 'foreground',
      data: {
        type: 'REGISTRATION_STATUS_UPDATED',
        ganapId: 'ganap-42',
        registrationStatus: 'REJECTED',
      },
    });

    await waitFor(() => expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(3));
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.detail('ganap-42') });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.lists() });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: profileQueryKeys.all });
  });

  it('invalidates all Ganap and profile queries on AppState resume and cleans up', async (): Promise<void> => {
    const queryClient = makeQueryClientSpy();
    const screen = await renderHook(() => useNotificationQuerySync(), { wrapper: queryClientWrapper(queryClient) });

    mockAppStateChange?.('active');
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ganapQueryKeys.all });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: profileQueryKeys.all });

    await screen.unmount();
    expect(mockNotificationObserverCleanup).toHaveBeenCalledTimes(1);
    expect(mockAppStateRemove).toHaveBeenCalledTimes(1);
  });

  it('does not invalidate while AppState is inactive or backgrounded', async (): Promise<void> => {
    const queryClient = makeQueryClientSpy();
    await renderHook(() => useNotificationQuerySync(), { wrapper: queryClientWrapper(queryClient) });

    mockAppStateChange?.('inactive');
    mockAppStateChange?.('background');

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('registers one service listener per mounted hook instance', async (): Promise<void> => {
    const queryClient = makeQueryClientSpy();
    const first = await renderHook(() => useNotificationQuerySync(), { wrapper: queryClientWrapper(queryClient) });
    const second = await renderHook(() => useNotificationQuerySync(), { wrapper: queryClientWrapper(queryClient) });

    expect(mockStartNotificationResponseObserver).toHaveBeenCalledTimes(2);
    expect(addAppStateListener).toHaveBeenCalledTimes(2);

    await first.unmount();
    await second.unmount();
  });
});
