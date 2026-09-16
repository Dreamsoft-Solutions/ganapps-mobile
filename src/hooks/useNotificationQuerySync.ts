import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { ganapQueryKeys } from '@/hooks/queries/useGanapsQuery';
import { profileQueryKeys } from '@/hooks/queries/useProfileQuery';
import type { NotificationDelivery } from '@/services/push-notification.service';
import { startNotificationResponseObserver } from '@/services/push-notification.service';

/**
 * Invalidates registration-related query families after a notification delivery or app resume.
 *
 * @param queryClient - TanStack Query client whose caches should be marked stale.
 * @param ganapId - Validated Ganap id from a notification, or undefined for a broad refresh.
 * @returns A promise that settles after all selected invalidations finish.
 */
export async function invalidateRegistrationQueries(queryClient: QueryClient, ganapId?: string): Promise<void> {
  const invalidations: Array<Promise<void>> = [];

  if (ganapId !== undefined) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) }),
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() }),
    );
  } else {
    invalidations.push(queryClient.invalidateQueries({ queryKey: ganapQueryKeys.all }));
  }

  invalidations.push(queryClient.invalidateQueries({ queryKey: profileQueryKeys.all }));
  await Promise.all(invalidations);
}

/**
 * Synchronizes notification-driven registration changes and app-resume cache refreshes.
 *
 * @returns Nothing. Lifecycle effects own their native observer cleanups.
 */
export function useNotificationQuerySync(): void {
  const queryClient = useQueryClient();

  useEffect((): (() => void) => {
    const cleanup = startNotificationResponseObserver(({ data }: NotificationDelivery): void => {
      void invalidateRegistrationQueries(queryClient, data.ganapId);
    });
    return cleanup;
  }, [queryClient]);

  useEffect((): (() => void) => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus): void => {
      if (state === 'active') void invalidateRegistrationQueries(queryClient);
    });
    return (): void => subscription.remove();
  }, [queryClient]);
}
