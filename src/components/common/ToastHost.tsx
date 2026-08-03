import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from '@/components/common/Toast';
import { Spacing } from '@/constants/theme';
import { useToastStore } from '@/store/toast.store';

/**
 * Overlay that renders the active toasts below the top safe area.
 *
 * Mount once in the root layout, inside the `ThemeProvider` and above the
 * navigator, so toasts float over every screen and follow the `.dark` class.
 *
 * @returns The toast overlay, or nothing when no toast is active.
 */
export function ToastHost(): ReactElement | null {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 items-center gap-sm px-md"
      style={{ top: insets.top + Spacing.sm }}
    >
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </View>
  );
}
