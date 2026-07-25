import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function MoreLayout(): ReactElement {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
