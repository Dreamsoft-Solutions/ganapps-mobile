import type { ReactElement } from 'react';
import { View, type ViewProps } from 'react-native';

export function Card({ className, ...props }: ViewProps): ReactElement {
  return (
    <View className={`bg-white rounded-xl border border-lynx-outline-variant p-md ${className ?? ''}`} {...props} />
  );
}
