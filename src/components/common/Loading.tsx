import type { ReactElement } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { Text } from './Text';

interface LoadingProps {
  message?: string;
}

/**
 * Centered loading indicator.
 *
 * @param props - Optional loading message.
 * @returns A centered activity indicator with an optional message.
 */
export function Loading({ message }: LoadingProps): ReactElement {
  const color = Colors[useResolvedTheme()].primary;

  return (
    <View className="flex-1 items-center justify-center p-xl">
      <ActivityIndicator size="large" color={color} />
      {message && <Text className="text-muted-foreground mt-md">{message}</Text>}
    </View>
  );
}
