import type { LucideIcon } from 'lucide-react-native';
import { CheckCircle2, CircleAlert, Info } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Text } from '@/components/common/Text';
import type { ToastItem, ToastType } from '@/store/toast.store';

const TOAST_ICONS: Record<ToastType, LucideIcon> = {
  error: CircleAlert,
  success: CheckCircle2,
  info: Info,
};

const TOAST_ICON_CLASSES: Record<ToastType, string> = {
  error: 'text-destructive',
  success: 'text-primary',
  info: 'text-muted-foreground',
};

interface ToastProps {
  /** The toast to render. */
  item: ToastItem;
  /** Called with the toast id when it is tapped. */
  onDismiss: (id: string) => void;
}

/**
 * A single toast card. Tapping it dismisses it immediately.
 *
 * @param props - The toast item and dismissal callback.
 * @returns An animated, dismissible toast card.
 */
export function Toast({ item, onDismiss }: ToastProps): ReactElement {
  const Icon = TOAST_ICONS[item.type];

  return (
    <Animated.View entering={FadeInDown} exiting={FadeOut} className="w-full">
      <Pressable
        onPress={(): void => onDismiss(item.id)}
        accessibilityRole="alert"
        className="flex-row items-center gap-sm rounded-lg border border-border bg-card px-md py-sm shadow-lg"
      >
        <Icon size={18} className={TOAST_ICON_CLASSES[item.type]} />
        <View className="flex-1">
          <Text className="font-inter-semibold text-body-md text-card-foreground">{item.title}</Text>
          {item.message !== undefined && (
            <Text className="text-body-md text-muted-foreground mt-xs">{item.message}</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}
