import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { RootProvider } from '@/providers/RootProvider';
import { useAuthStore } from '@/store/auth.store';
import { remoteConfigService } from '@/services/remote-config.service';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    remoteConfigService.initialize();
  }, []);

  if (token) {
    return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
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
