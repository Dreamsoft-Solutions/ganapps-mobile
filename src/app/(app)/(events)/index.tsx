import { Calendar } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Text } from '@/components/common/Text';

/**
 * My Events screen.
 *
 * Placeholder for the user's registered/saved events.
 *
 * @returns The My Events placeholder screen.
 */
export default function MyEventsScreen(): ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-lynx-background p-md">
      <Calendar size={48} className="text-lynx-primary mb-4" />
      <Text className="text-headline-md text-lynx-on-surface mb-2">My Events</Text>
      <Text className="text-body-md text-lynx-on-surface-variant text-center">
        Events you have registered for will appear here.
      </Text>
    </View>
  );
}
