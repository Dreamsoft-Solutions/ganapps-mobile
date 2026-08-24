import { MessageSquare } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

/** Props for the Event Hub post-event feedback row. */
export interface FeedbackRowProps {
  /** Whether anything is still outstanding; `false` renders nothing. */
  isPending: boolean;
  onPress: () => void;
}

/**
 * Event Hub row surfacing outstanding post-event feedback.
 *
 * Unlike {@link AttendanceScanRow}, this row has only two states: it either
 * disappears once nothing is pending, or invites the student in. There is no
 * locked variant, since feedback only ever becomes available after `ATTENDED`.
 *
 * @param props - Whether feedback is pending, and the navigate-to-feedback callback.
 * @returns The row when feedback is pending, or null when hidden.
 */
export function FeedbackRow({ isPending, onPress }: FeedbackRowProps): ReactElement | null {
  const theme = useResolvedTheme();

  if (!isPending) return null;

  return (
    <Pressable
      testID="feedback-row"
      accessibilityRole="button"
      accessibilityLabel="Rate this event"
      accessibilityHint="Opens the post-event feedback flow"
      onPress={(): void => onPress()}
      className="flex-row items-center rounded-lg border border-primary bg-background px-md py-sm"
    >
      <View className="mr-sm">
        <MessageSquare size={16} color={Colors[theme].primary} />
      </View>
      <Text className="min-w-0 flex-1 font-inter-semibold text-body-md text-primary">Rate this event</Text>
    </Pressable>
  );
}
