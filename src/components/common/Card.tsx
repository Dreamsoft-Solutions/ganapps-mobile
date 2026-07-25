import { View, type ViewProps } from 'react-native';

export function Card({ className, ...props }: ViewProps) {
  return (
    <View className={`bg-white rounded-xl border border-lynx-outline-variant p-md ${className ?? ''}`} {...props} />
  );
}
