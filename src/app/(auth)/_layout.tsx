import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

/**
 * Authentication layout for the login/sign-up flow.
 *
 * @returns The auth stack navigator.
 */
export default function AuthLayout(): ReactElement {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
