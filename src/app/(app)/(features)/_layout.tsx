import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function FeaturesLayout(): ReactElement {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[feature-id]" options={{ title: 'Feature Details' }} />
    </Stack>
  );
}
