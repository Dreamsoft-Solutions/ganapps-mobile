import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { Spacing } from '@/constants/theme';
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
 * The tab bar hides on Ganap screens, so the bar pads itself by the bottom safe-area inset.
 *
 * The primary button is keyed by its variant, so a switch from `outline` to `default` mounts a new
 * button. react-native-css-interop cannot add the default variant's shadow variables to a mounted
 * button, and in development its upgrade warning throws "Couldn't find a navigation context".
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
  const insets = useSafeAreaInsets();
  const primaryVariant: 'outline' | 'default' = model.primary?.action === 'leave' ? 'outline' : 'default';

  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-md pt-sm"
      style={{ paddingBottom: insets.bottom + Spacing.xs }}
    >
      <View className="w-full max-w-3xl self-center">
        {model.statusLabel && (
          <Text className="mb-sm text-center text-body-md text-muted-foreground">{model.statusLabel}</Text>
        )}
        {model.primary && (
          <Button
            key={primaryVariant}
            size="lg"
            variant={primaryVariant}
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
          Report event
        </Button>
      </View>
    </View>
  );
}
