import '../global.css';

import { useQueryClient } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { NavigationBar } from 'expo-navigation-bar';
import { Stack, useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { cssInterop } from 'nativewind';
import { type ReactElement, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { ToastHost } from '@/components/common/ToastHost';
import { Routes } from '@/constants/routes';
import { db } from '@/db';
import { useNotificationQuerySync } from '@/hooks/useNotificationQuerySync';
import { RootProvider } from '@/providers/RootProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { remoteConfigService } from '@/services/remote-config.service';
import { type CheckInReplayOutcome, startOutboxDrain } from '@/services/sync.service';
import { useAuthStore } from '@/store/auth.store';
import { handleCheckInReplayOutcome } from '@/utils/attendance';
import { hasShareLinkReturnTarget } from '@/utils/navigation';
import migrations from '../../drizzle/migrations';

cssInterop(SafeAreaView, { className: 'style' });

SplashScreen.preventAutoHideAsync();

/**
 * Determines whether the current route segment belongs to the unauthenticated groups.
 *
 * @param segment - The first route segment from expo-router.
 * @returns `true` when the segment is `(public)` or `(auth)`.
 */
function isUnauthenticatedGroup(segment: string | undefined): boolean {
  return segment === '(public)' || segment === '(auth)';
}

/** Keeps canonical share routes alive long enough to validate and forward them. */
function isShareLinkRoute(segments: readonly string[]): boolean {
  return segments[0] === '(public)' && (segments[1] === 'friends' || segments[1] === 'ganaps');
}

function RootLayoutNav(): ReactElement {
  const router = useRouter();
  const segments = useSegments();
  const searchParams = useGlobalSearchParams();
  const hasPendingShareReturn: boolean = hasShareLinkReturnTarget(searchParams);
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [hasHiddenSplash, setHasHiddenSplash] = useState(false);
  const { success: migrationsReady, error: migrationError } = useMigrations(db, migrations);

  useNotificationQuerySync();

  useEffect(() => {
    useAuthStore.getState().hydrate();
    remoteConfigService.initialize();
    NavigationBar.setHidden(true);
  }, []);

  useEffect(() => {
    // Settled means ready or failed. Waiting only on `migrationsReady` would leave
    // the splash up forever when a migration errors, hiding the error entirely.
    const migrationsSettled = migrationsReady || !!migrationError;

    if (isHydrated && migrationsSettled && !hasHiddenSplash) {
      SplashScreen.hideAsync();
      setHasHiddenSplash(true);
    }
  }, [isHydrated, migrationsReady, migrationError, hasHiddenSplash]);

  useEffect(() => {
    // The drain reads the outbox table, so it cannot start before migrations have
    // created it. Returns the listener's cleanup so it is torn down on unmount.
    if (!migrationsReady) return;
    return startOutboxDrain((outcome: CheckInReplayOutcome): void => {
      handleCheckInReplayOutcome(queryClient, outcome);
    });
  }, [migrationsReady, queryClient]);

  useEffect(() => {
    if (!isHydrated || !migrationsReady) return;

    const segment = segments[0];
    const isIncomingShareLink: boolean = isShareLinkRoute(segments);

    if (token === null && !isUnauthenticatedGroup(segment)) {
      router.replace(Routes.public.welcome);
    } else if (token !== null && isUnauthenticatedGroup(segment) && !isIncomingShareLink && !hasPendingShareReturn) {
      router.replace(Routes.app.home);
    }
  }, [token, isHydrated, migrationsReady, segments, router, hasPendingShareReturn]);

  // A database that failed to migrate fails confusingly later — every read hits a
  // missing table — so surface it here rather than letting the app start broken.
  if (migrationError) {
    return <ErrorView error={migrationError} />;
  }

  if (!isHydrated || !migrationsReady) {
    return <Loading message="Loading..." />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(public)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="verify-email" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack>
  );
}

/**
 * Root providers, startup services, auth routing, and navigation stack.
 *
 * @returns The root application layout.
 */
export default function RootLayout(): ReactElement {
  return (
    <RootProvider>
      <ThemeProvider>
        <RootLayoutNav />
        <ToastHost />
      </ThemeProvider>
    </RootProvider>
  );
}
