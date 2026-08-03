import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast } from '@/components/common/Toast';
import { Spacing } from '@/constants/theme';
import type { ToastItem } from '@/store/toast.store';
import { useToastStore } from '@/store/toast.store';

// Toast ids already announced to the screen reader. Module-level so toasts
// that outlive a re-render are never announced twice.
const announcedToastIds = new Set<string>();

function announceToast(item: ToastItem): void {
  if (Platform.OS === 'web') return; // AccessibilityInfo.announce is native-only.
  const text: string = item.message === undefined ? item.title : `${item.title}, ${item.message}`;
  AccessibilityInfo.announceForAccessibility(text);
}

/**
 * Overlay that renders the active toasts below the top safe area.
 *
 * Mount once in the root layout, inside the `ThemeProvider` and above the
 * navigator, so toasts float over every screen and follow the `.dark` class.
 * Newly added toasts are announced to the screen reader, since a dynamically
 * mounted element that disappears after a few seconds would otherwise be
 * missed entirely.
 *
 * @returns The toast overlay, or nothing when no toast is active.
 */
export function ToastHost(): ReactElement | null {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Toasts are appended newest-last, so walk backwards to announce the most
    // recent toast that has not been announced yet.
    for (let i = toasts.length - 1; i >= 0; i -= 1) {
      const toast = toasts[i];
      if (announcedToastIds.has(toast.id)) continue;
      announcedToastIds.add(toast.id);
      announceToast(toast);
      break;
    }
  }, [toasts]);

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
