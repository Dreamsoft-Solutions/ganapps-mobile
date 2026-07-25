import { Stack } from 'expo-router';

export default function FeaturesLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[feature-id]" options={{ title: 'Feature Details' }} />
    </Stack>
  );
}
