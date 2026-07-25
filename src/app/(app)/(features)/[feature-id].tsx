import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';

export default function FeatureDetailScreen() {
  const { 'feature-id': featureId } = useLocalSearchParams<{
    'feature-id': string;
  }>();

  return (
    <View className="flex-1 bg-lynx-background p-md">
      <Stack.Screen options={{ title: `Feature ${featureId}` }} />
      <Text className="text-headline-md">Feature Details</Text>
      <Text className="text-lynx-on-surface-variant mt-sm">Feature ID: {featureId}</Text>
    </View>
  );
}
