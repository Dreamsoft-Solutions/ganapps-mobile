import '../global.css';

import { NavigationBar } from 'expo-navigation-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { cssInterop } from 'nativewind';
import { type ReactElement, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Loading } from '@/components/common/Loading';
import { Routes } from '@/constants/routes';
import { RootProvider } from '@/providers/RootProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { remoteConfigService } from '@/services/remote-config.service';
import { useAuthStore } from '@/store/auth.store';
import { useThemeStore } from '@/store/theme.store';

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

function RootLayoutNav(): ReactElement {
  const router = useRouter();
  const segments = useSegments();
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [hasHiddenSplash, setHasHiddenSplash] = useState(false);

  useEffect(() => {
    useAuthStore.getState().hydrate();
    useThemeStore.getState().hydrate();
    remoteConfigService.initialize();
    NavigationBar.setHidden(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !hasHiddenSplash) {
      SplashScreen.hideAsync();
      setHasHiddenSplash(true);
    }
  }, [isHydrated, hasHiddenSplash]);

  useEffect(() => {
    if (!isHydrated) return;

    const segment = segments[0];

    if (token === null && !isUnauthenticatedGroup(segment)) {
      router.replace(Routes.public.welcome);
    } else if (token !== null && isUnauthenticatedGroup(segment)) {
      router.replace(Routes.app.home);
    }
  }, [token, isHydrated, segments, router]);

  if (!isHydrated) {
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

export default function RootLayout(): ReactElement {
  return (
    <RootProvider>
      <ThemeProvider>
        <RootLayoutNav />
      </ThemeProvider>
    </RootProvider>
  );
}
