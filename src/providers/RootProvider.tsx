import type { Mutation, Query } from '@tanstack/react-query';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META, showErrorToast } from '@/utils/toast-message';

/**
 * Decides whether a failed query deserves a toast.
 *
 * Suppresses intermediate retry failures (a final `fetchStatus` is only
 * reached after retries are exhausted) and background refetches of data that
 * already rendered, so a stale-then-failed refresh does not nag the user.
 *
 * @param query - The failed query.
 * @returns `true` when the failure is a foreground, final one.
 */
function isForegroundFinalFailure(query: Query<unknown, unknown, unknown>): boolean {
  return query.state.fetchStatus === 'idle' && query.state.dataUpdateCount === 0;
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: Error, query: Query<unknown, unknown, unknown>): void => {
      if (isForegroundFinalFailure(query)) showErrorToast(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (
      error: Error,
      _variables: unknown,
      _onMutateResult: unknown,
      mutation: Mutation<unknown, unknown, unknown>,
    ): void => {
      // Form-handled mutations opt out via `meta`; they render `mutation.error`
      // inline, and toasting the same failure again would duplicate it.
      if (mutation.meta?.[SUPPRESS_GLOBAL_ERROR_TOAST_META] === true) return;
      showErrorToast(error);
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      gcTime: 1000 * 60 * 5,
    },
  },
});

/**
 * App-wide providers: gesture handling, TanStack Query, and the error-to-toast
 * wiring for every query and mutation.
 *
 * @param props - Provider children.
 * @returns The children wrapped in the app's providers.
 */
export function RootProvider({ children }: { children: ReactNode }): ReactElement {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </GestureHandlerRootView>
  );
}
