import { CircleCheck, MessageSquare } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { FeedbackRowState } from '@/utils/feedback';

/** Props for the Event Hub post-event feedback row. */
export interface FeedbackRowProps {
  /** Authoritative feedback state; `hidden` renders nothing. */
  state: FeedbackRowState;
  /** Fired only when the feedback row is actionable. */
  onPress: () => void;
}

/**
 * Event Hub row surfacing authoritative post-event feedback state.
 *
 * Unlike {@link AttendanceScanRow}, this row is hidden while the server
 * metadata is unavailable, confirms a submitted rating statically (an optional
 * form does not count), or invites the student to rate. When the organizer
 * requires the feedback form before rating, the invitation says so.
 *
 * @param props - Authoritative state and the navigate-to-feedback callback.
 * @returns The row for the current state, or null when hidden.
 */
export function FeedbackRow({ state, onPress }: FeedbackRowProps): ReactElement | null {
  const theme = useResolvedTheme();

  if (state.kind === 'hidden') return null;

  if (state.kind === 'submitted') {
    return (
      <View
        testID="feedback-row"
        accessible
        pointerEvents="none"
        accessibilityLabel="Rating submitted"
        className="flex-row items-center rounded-lg border border-border bg-muted px-md py-sm"
      >
        <View className="mr-sm">
          <CircleCheck size={16} color={Colors[theme]['primary-text']} />
        </View>
        <Text className="min-w-0 flex-1 text-body-md">Rating submitted</Text>
      </View>
    );
  }

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
        <MessageSquare size={16} color={Colors[theme]['primary-text']} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-allo-semibold text-body-md text-primary-text">Rate this event</Text>
        {state.formFirst ? <Text className="text-body-md text-muted-foreground">Feedback form first</Text> : null}
      </View>
    </Pressable>
  );
}
