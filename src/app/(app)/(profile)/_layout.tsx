import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function ProfileLayout(): ReactElement {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="profile" />
      <Stack.Screen name="edit" />
      <Stack.Screen name="joined" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
