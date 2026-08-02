import type { ReactElement } from 'react';
import { View } from 'react-native';
import { GanapList } from '@/components/lists/GanapList';

export default function GanapsScreen(): ReactElement {
  return (
    <View className="flex-1 bg-background px-md">
      <GanapList />
    </View>
  );
}
