import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import type { GanapActionModel } from '@/utils/ganap-detail';

interface EventActionBarProps {
  model: GanapActionModel;
  isPending: boolean;
  onAction: () => void | Promise<void>;
}

/**
 * Safe-area-aware sticky action surface for registration decisions.
 *
 * @param props - Action model, pending state, and primary action handler.
 * @returns The fixed registration action bar.
 */
export function EventActionBar({ model, isPending, onAction }: EventActionBarProps): ReactElement {
  const insets = useSafeAreaInsets();
  const actionLabel: string = model.actionLabel ?? '';
  const hasAction: boolean = model.action !== null && actionLabel.length > 0;
  const actionVariant = model.action === 'leave' ? 'outline' : 'default';

  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-md pt-sm"
      style={{ paddingBottom: insets.bottom + 8 }}
    >
      <View className="w-full max-w-3xl self-center">
        {model.statusLabel && (
          <Text className="mb-sm text-center text-body-md text-muted-foreground">{model.statusLabel}</Text>
        )}
        {hasAction && (
          <Button size="lg" variant={actionVariant} loading={isPending} disabled={isPending} onPress={onAction}>
            {actionLabel}
          </Button>
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
