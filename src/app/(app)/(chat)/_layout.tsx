import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function ChatLayout(): ReactElement {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
