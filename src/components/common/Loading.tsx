import { View, ActivityIndicator } from 'react-native';
import { Text } from './Text';

export function Loading({ message }: { message?: string }) {
  return (
    <View className="flex-1 items-center justify-center p-xl">
      <ActivityIndicator size="large" color="#00c853" />
      {message && (
        <Text className="text-lynx-on-surface-variant mt-md">
          {message}
        </Text>
      )}
    </View>
  );
}
