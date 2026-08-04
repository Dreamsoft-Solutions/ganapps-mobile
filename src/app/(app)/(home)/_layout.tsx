import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function HomeLayout(): ReactElement {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[ganap-id]" options={{ headerShown: false }} />
      <Stack.Screen name="registration/[ganap-id]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="event-hub/[ganap-id]" options={{ headerShown: false }} />
    </Stack>
  );
}
