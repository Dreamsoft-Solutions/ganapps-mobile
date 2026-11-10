import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import type { GanapActionModel } from '@/utils/ganap-detail';

interface EventActionBarProps {
  model: GanapActionModel;
  isPending: boolean;
  onPrimaryAction: () => void | Promise<void>;
  onSecondaryAction: () => void | Promise<void>;
  /** Opens the report flow for this Ganap. */
  onReport: () => void;
}

/**
 * Sticky action surface for registration and Event Hub entry decisions.
 *
 * It sits directly above the app tab bar, which already reserves the bottom safe-area
 * inset, so the bar adds only its own padding.
 *
 * @param props - Action model, pending state, primary/secondary action handlers, and the report handler.
 * @returns The fixed action bar with an optional secondary action and the Report Event link.
 */
export function EventActionBar({
  model,
  isPending,
  onPrimaryAction,
  onSecondaryAction,
  onReport,
}: EventActionBarProps): ReactElement {
  return (
    <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-md pb-xs pt-sm">
      <View className="w-full max-w-3xl self-center">
        {model.statusLabel && (
          <Text className="mb-sm text-center text-body-md text-muted-foreground">{model.statusLabel}</Text>
        )}
        {model.primary && (
          <Button
            size="lg"
            variant={model.primary.action === 'leave' ? 'outline' : 'default'}
            loading={isPending}
            disabled={isPending}
            onPress={onPrimaryAction}
          >
            {model.primary.label}
          </Button>
        )}
        {model.secondary && (
          <View className="mt-sm">
            <Button size="lg" variant="outline" loading={isPending} disabled={isPending} onPress={onSecondaryAction}>
              {model.secondary.label}
            </Button>
          </View>
        )}
        <Button variant="link" size="sm" accessibilityHint="Opens a form to report this event" onPress={onReport}>
          Report Event
        </Button>
      </View>
    </View>
  );
}
