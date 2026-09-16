import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

/**
 * Public layout for unauthenticated marketing/welcome screens.
 *
 * @returns The public stack navigator.
 */
export default function PublicLayout(): ReactElement {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
