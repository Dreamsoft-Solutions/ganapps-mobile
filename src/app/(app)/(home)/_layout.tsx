import { Stack } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';
import { NoGlassBackdrop } from '@/components/common/GlassBackdrop';

/**
 * Keeps every screen pushed over the map off the glass backdrop, so their panes draw Solid.
 *
 * @param props - The route and its screen.
 * @returns The screen, fenced unless it is the map.
 */
function renderHomeScreen({ route, children }: { route: { name: string }; children: ReactNode }): ReactElement {
  return <NoGlassBackdrop when={route.name !== 'index'}>{children}</NoGlassBackdrop>;
}

export default function HomeLayout(): ReactElement {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }} screenLayout={renderHomeScreen}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[ganap-id]" options={{ headerShown: false }} />
      <Stack.Screen name="registration/[ganap-id]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="event-hub/[ganap-id]" options={{ headerShown: false }} />
      <Stack.Screen name="scan/[ganap-id]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="feedback/[ganap-id]" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
