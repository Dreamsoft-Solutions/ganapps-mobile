import type { ReactElement } from 'react';
import { View, type ViewProps } from 'react-native';

export function Card({ className, ...props }: ViewProps): ReactElement {
  return <View className={`bg-card rounded-xl border border-border p-md ${className ?? ''}`} {...props} />;
}
