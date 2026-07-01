import { View } from 'react-native';
import { Text } from './Text';

interface EmptyProps {
  message: string;
  icon?: string;
}

export function Empty({ message, icon }: EmptyProps) {
  return (
    <View className="flex-1 items-center justify-center p-xl">
      {icon && (
        <Text className="text-4xl mb-md">{icon}</Text>
      )}
      <Text className="text-lynx-on-surface-variant text-body-lg text-center">
        {message}
      </Text>
    </View>
  );
}
