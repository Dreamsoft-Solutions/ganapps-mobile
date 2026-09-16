import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from './Text';

interface DividerProps {
  label?: string;
}

/**
 * Horizontal divider with optional centered text.
 *
 * @param props - Optional label to display between divider lines.
 * @returns A themed divider.
 */
export function Divider({ label }: DividerProps): ReactElement {
  return (
    <View className="flex-row items-center gap-3 my-5">
      <View className="flex-1 h-px bg-border" />
      {label && <Text className="text-muted-foreground text-label-md uppercase tracking-widest">{label}</Text>}
      <View className="flex-1 h-px bg-border" />
    </View>
  );
}
