import { MessageCircle } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';

/**
 * Chat screen.
 *
 * Placeholder for event and business conversations.
 *
 * @returns The Chat placeholder screen.
 */
export default function ChatScreen(): ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-lynx-background p-md">
      <MessageCircle size={48} className="text-lynx-primary mb-4" />
      <Text className="text-headline-md text-lynx-on-surface mb-2">Chat</Text>
      <Text className="text-body-md text-lynx-on-surface-variant text-center">
        Event and organization chats will appear here.
      </Text>
    </View>
  );
}
