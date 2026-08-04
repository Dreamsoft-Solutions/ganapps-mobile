import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import type { GanapActionModel } from '@/utils/ganap-detail';

interface EventActionBarProps {
  model: GanapActionModel;
  isPending: boolean;
  onPrimaryAction: () => void | Promise<void>;
  onSecondaryAction: () => void | Promise<void>;
}

/**
 * Safe-area-aware sticky action surface for registration and Event Hub entry decisions.
 *
 * @param props - Action model, pending state, and primary/secondary action handlers.
 * @returns The fixed action bar with an optional secondary action beneath the primary.
 */
export function EventActionBar({
  model,
  isPending,
  onPrimaryAction,
  onSecondaryAction,
}: EventActionBarProps): ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-md pt-sm"
      style={{ paddingBottom: insets.bottom + 8 }}
    >
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
        <Button
          variant="link"
          size="sm"
          disabled
          accessibilityHint="Reporting is not available yet"
          onPress={(): void => {}}
        >
          Report Event
        </Button>
      </View>
    </View>
  );
}
