import { View } from 'react-native';
import { Text } from '@/components/common/Text';

export default function MoreScreen() {
  return (
    <View className="flex-1 bg-lynx-background p-md items-center justify-center">
      <Text className="text-headline-md">More</Text>
      <Text className="text-lynx-on-surface-variant mt-sm">Additional options coming soon</Text>
    </View>
  );
}
