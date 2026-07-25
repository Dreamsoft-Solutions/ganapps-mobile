import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function AuthLayout(): ReactElement {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
