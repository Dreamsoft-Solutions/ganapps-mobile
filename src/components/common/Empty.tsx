import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from './Text';

interface EmptyProps {
  message: string;
  icon?: string;
  /** Counter-rotates the state when it is rendered inside an inverted list. */
  inverted?: boolean;
}

/**
 * Displays a centered message for a collection with no items.
 *
 * @param props - Message, optional icon, and optional inverted-list orientation
 * @returns The centered empty state.
 */
export function Empty({ message, icon, inverted = false }: EmptyProps): ReactElement {
  return (
    <View
      className="flex-1 items-center justify-center p-xl"
      style={inverted ? { transform: [{ scaleY: -1 }] } : undefined}
    >
      {icon && <Text className="text-4xl mb-md">{icon}</Text>}
      <Text className="text-muted-foreground text-body-lg text-center">{message}</Text>
    </View>
  );
}
