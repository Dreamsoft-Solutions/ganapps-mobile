import type { ReactElement } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageReactionBar } from '@/components/chat/MessageReactionBar';
import { Spacing } from '@/constants/theme';
import { MIN_TOUCH_TARGET } from '@/constants/touch-target';
import type { ReactionSummary, ReactionType } from '@/types/chat.types';
import { CHAT_REACTION_OPTIONS } from '@/utils/chat-engagement';

/** Screen position and size of a long-pressed message. */
export interface MessageReactionAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Props for the floating message reaction picker. */
export interface MessageReactionOverlayProps {
  visible: boolean;
  anchor: MessageReactionAnchor;
  summary: ReactionSummary;
  isPending?: boolean;
  isDisabled?: boolean;
  onSelect: (reaction: ReactionType | null) => void;
  onClose: () => void;
}

/**
 * Renders the reaction choices above the selected message with an accessible dismissal surface.
 *
 * @param props - Visibility, measured message position, server aggregate, and callbacks
 * @returns A transparent modal containing the floating picker, or null when closed
 */
export function MessageReactionOverlay({
  visible,
  anchor,
  summary,
  isPending = false,
  isDisabled = false,
  onSelect,
  onClose,
}: MessageReactionOverlayProps): ReactElement | null {
  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();
  const trayHeight: number = MIN_TOUCH_TARGET + Spacing.xs * 2;
  const trayWidth: number = Math.min(
    MIN_TOUCH_TARGET * CHAT_REACTION_OPTIONS.length + Spacing.xs * (CHAT_REACTION_OPTIONS.length + 1),
    windowDimensions.width - Spacing.md,
  );
  const maxLeft: number = Math.max(Spacing.xs, windowDimensions.width - trayWidth - Spacing.xs);
  const left: number = Math.min(Math.max(anchor.x + anchor.width / 2 - trayWidth / 2, Spacing.xs), maxLeft);
  const minTop: number = insets.top + Spacing.xs;
  const maxTop: number = Math.max(minTop, windowDimensions.height - insets.bottom - trayHeight - Spacing.xs);
  const aboveMessage: number = anchor.y - trayHeight - Spacing.xs;
  const belowMessage: number = anchor.y + anchor.height + Spacing.xs;
  const top: number = Math.min(Math.max(aboveMessage >= minTop ? aboveMessage : belowMessage, minTop), maxTop);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1" accessibilityViewIsModal>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss reactions"
          onPress={onClose}
          className="absolute inset-0"
        />
        <View
          className="absolute z-50 rounded-full border border-border bg-popover shadow-lg"
          style={{ top, left, width: trayWidth }}
        >
          <MessageReactionBar
            summary={summary}
            presentation="tray"
            containerLabel="Choose a message reaction"
            isPending={isPending}
            isDisabled={isDisabled}
            onSelect={onSelect}
          />
        </View>
      </View>
    </Modal>
  );
}
