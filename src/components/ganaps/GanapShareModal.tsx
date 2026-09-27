import { Share2, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { ShareQrCode } from '@/components/common/ShareQrCode';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { GanapDetail } from '@/types/ganap.types';
import type { GanapScheduleModel } from '@/utils/ganap-detail';

/** Data and actions for the Ganap QR and native share surface. */
export interface GanapShareModalProps {
  /** Whether the share surface is visible. */
  visible: boolean;
  /** Canonical public HTTPS URL encoded into the Ganap QR. */
  url: string;
  /** Event information shown on the share card. */
  ganap: GanapDetail;
  /** Formatted schedule shown on the share card. */
  schedule: GanapScheduleModel;
  /** Closes the share surface. */
  onClose: () => void;
  /** Opens the platform's native share sheet. */
  onNativeShare: () => void | Promise<void>;
}

/**
 * Shows a savable QR card and the native share action for a Ganap.
 *
 * @param props - Ganap link, card details, visibility, and dismissal and share handlers.
 * @returns A full-screen share modal.
 */
export function GanapShareModal({
  visible,
  url,
  ganap,
  schedule,
  onClose,
  onNativeShare,
}: GanapShareModalProps): ReactElement {
  const theme = useResolvedTheme();
  const details: string[] = [`${schedule.dateLabel} · ${schedule.timeLabel}`, ganap.address?.trim() ?? ''].filter(
    (detail: string): boolean => detail.length > 0,
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between border-b border-border px-md py-sm">
          <Text className="font-inter-semibold text-headline-sm" accessibilityRole="header">
            Share this event
          </Text>
          <IconButton accessibilityLabel="Close sharing" accessibilityHint="Returns to event details" onPress={onClose}>
            <X size={20} color={Colors[theme].foreground} />
          </IconButton>
        </View>
        <ScrollView className="flex-1" contentContainerClassName="gap-md p-md pb-xl">
          <ShareQrCode value={url} title={ganap.title} details={details} />
          <Button
            leftIcon={<Share2 size={18} />}
            onPress={onNativeShare}
            accessibilityHint="Shares event details and its public link using another app"
          >
            Share event
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
