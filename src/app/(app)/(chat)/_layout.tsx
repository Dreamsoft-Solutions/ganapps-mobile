import { Stack } from 'expo-router';
import type { ReactElement } from 'react';

export default function ChatLayout(): ReactElement {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="chat" options={{ headerShown: false }} />
      <Stack.Screen name="friend-profile/[user-id]" options={{ headerShown: false }} />
      <Stack.Screen name="friend-settings" options={{ headerShown: false }} />
      <Stack.Screen name="event-chat/[ganap-id]" options={{ headerShown: false }} />
      <Stack.Screen name="direct-chat/[conversation-id]" options={{ headerShown: false }} />
    </Stack>
  );
}
