import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';

export default function EditProfileScreen(): ReactElement {
  return (
    <View className="flex-1 bg-lynx-background p-md">
      <Text className="text-headline-md">Edit Profile</Text>
    </View>
  );
}
