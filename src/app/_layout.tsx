import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { type ReactElement, useEffect, useState } from 'react';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { db } from '@/db';
import { RootProvider } from '@/providers/RootProvider';
import { remoteConfigService } from '@/services/remote-config.service';
import { startOutboxDrain } from '@/services/sync.service';
import { useAuthStore } from '@/store/auth.store';
import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav(): ReactElement {
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [hasHiddenSplash, setHasHiddenSplash] = useState(false);
  const { success: migrationsReady, error: migrationError } = useMigrations(db, migrations);

  useEffect(() => {
    useAuthStore.getState().hydrate();
    remoteConfigService.initialize();
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
    return startOutboxDrain();
  }, [migrationsReady]);

  // A database that failed to migrate fails confusingly later — every read hits a
  // missing table — so surface it here rather than letting the app start broken.
  if (migrationError) {
    return <ErrorView error={migrationError} />;
  }

  if (!isHydrated || !migrationsReady) {
    return <Loading message="Loading..." />;
  }

  if (token) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="verify-email" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

export default function RootLayout(): ReactElement {
  return (
    <RootProvider>
      <RootLayoutNav />
    </RootProvider>
  );
}
