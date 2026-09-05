import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';

interface ReducedAccuracyNoticeProps {
  visible: boolean;
  onOpenSettings: () => void;
  onDismiss: () => void;
}

export function ReducedAccuracyNotice({
  visible,
  onOpenSettings,
  onDismiss,
}: ReducedAccuracyNoticeProps): ReactElement {
  if (!visible) return <></>;

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
