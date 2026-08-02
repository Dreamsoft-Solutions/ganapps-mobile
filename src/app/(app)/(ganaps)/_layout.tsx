import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function GanapsLayout(): ReactElement {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="ganaps" options={{ headerShown: false }} />
      <Stack.Screen name="[ganap-id]" options={{ title: 'Event' }} />
    </Stack>
  );
}
