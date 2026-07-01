import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';

export default function NotFoundScreen() {
  return (
    <View className="flex-1 bg-lynx-background items-center justify-center p-xl">
      <Stack.Screen options={{ title: 'Not Found' }} />
      <Text className="text-headline-md mb-sm">Page Not Found</Text>
      <Text className="text-lynx-on-surface-variant text-center mb-lg">
        The page you're looking for doesn't exist.
      </Text>
      <Link href="/(app)/(home)" className="text-lynx-primary-container font-semibold">
        Go Home
      </Link>
    </View>
  );
}
