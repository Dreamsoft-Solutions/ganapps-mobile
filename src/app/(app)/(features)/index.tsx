import { View } from 'react-native';
import { FeatureList } from '@/components/lists/FeatureList';

export default function FeaturesScreen() {
  return (
    <View className="flex-1 bg-lynx-background px-md">
      <FeatureList />
    </View>
  );
}
