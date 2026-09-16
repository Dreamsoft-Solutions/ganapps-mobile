import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';

interface ReducedAccuracyNoticeProps {
  visible: boolean;
  onOpenSettings: () => void;
  onDismiss: () => void;
}

/**
 * Targeted notice for users who granted location with Precise Location off.
 *
 * iOS blurs the position to a 1-5 km region in that mode, which is the same
 * order as the distance between Iloilo districts, so results can be wrong with
 * nothing else to signal it. Shown only to affected users; the caller is
 * responsible for not rendering it to denied users, who also read as reduced.
 *
 * @param props - Visibility and the settings and dismiss handlers
 * @returns The notice, or `null` when not applicable
 */
export function ReducedAccuracyNotice({
  visible,
  onOpenSettings,
  onDismiss,
}: ReducedAccuracyNoticeProps): ReactElement | null {
  if (!visible) return null;

  return (
    <View className="mx-4 mt-2 rounded-md bg-card border border-border p-sm gap-1">
      <Text className="text-label-md text-card-foreground">Approximate location</Text>
      <Text className="text-body-md text-muted-foreground">
        Precise Location is off, so nearby results may be several kilometres out.
      </Text>
      <View className="flex-row gap-md mt-1">
        <Pressable onPress={onOpenSettings} accessibilityRole="button">
          <Text className="text-label-md text-primary">Open Settings</Text>
        </Pressable>
        <Pressable onPress={onDismiss} accessibilityRole="button">
          <Text className="text-label-md text-muted-foreground">Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}
