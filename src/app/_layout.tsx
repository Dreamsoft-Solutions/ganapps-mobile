import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Loading } from '@/components/common/Loading';
import { RootProvider } from '@/providers/RootProvider';
import { remoteConfigService } from '@/services/remote-config.service';
import { useAuthStore } from '@/store/auth.store';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [hasHiddenSplash, setHasHiddenSplash] = useState(false);

  useEffect(() => {
    useAuthStore.getState().hydrate();
    remoteConfigService.initialize();
  }, []);

  useEffect(() => {
    if (isHydrated && !hasHiddenSplash) {
      SplashScreen.hideAsync();
      setHasHiddenSplash(true);
    }
  }, [isHydrated, hasHiddenSplash]);

  if (!isHydrated) {
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

export default function RootLayout() {
  return (
    <RootProvider>
      <RootLayoutNav />
    </RootProvider>
  );
}
