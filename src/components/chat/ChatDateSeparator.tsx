import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';

/** Props for a chat message date separator. */
export interface ChatDateSeparatorProps {
  /** Date label formatted in the device locale. */
  label: string;
}

/**
 * Renders a centered date label between message groups.
 *
 * @param props - Date label to show between message groups
 * @returns A semantic, theme-aware chat date separator
 */
export function ChatDateSeparator({ label }: ChatDateSeparatorProps): ReactElement {
  return (
    <View className="my-sm items-center">
      <Text className="text-label-sm text-muted-foreground">{label}</Text>
    </View>
  );
}
