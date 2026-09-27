import * as Sharing from 'expo-sharing';
import { QrCode, Share2, X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useRef, useState } from 'react';
import { Alert, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { ShareQrCode, type ShareQrCodeHandle } from '@/components/common/ShareQrCode';
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
  const shareQrCodeRef = useRef<ShareQrCodeHandle | null>(null);
  const [isSharingImage, setIsSharingImage] = useState<boolean>(false);
  const details: string[] = [`${schedule.dateLabel} · ${schedule.timeLabel}`, ganap.address?.trim() ?? ''].filter(
    (detail: string): boolean => detail.length > 0,
  );

  const handleShareImage = async (): Promise<void> => {
    setIsSharingImage(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'QR image sharing is not available on this device.');
        return;
      }

      const shareQrCode = shareQrCodeRef.current;
      if (!shareQrCode) throw new Error('The QR image is not ready to share.');

      const uri: string = await shareQrCode.captureImage();
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: 'Share QR image',
      });
    } catch {
      Alert.alert('Unable to share QR image', 'Please try again.');
    } finally {
      setIsSharingImage(false);
    }
  };

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
          <ShareQrCode ref={shareQrCodeRef} value={url} title={ganap.title} details={details} />
          <Button
            leftIcon={<QrCode size={18} />}
            loading={isSharingImage}
            disabled={isSharingImage}
            onPress={handleShareImage}
            accessibilityHint="Shares the QR code image using another app"
          >
            Share QR image
          </Button>
          <Button
            leftIcon={<Share2 size={18} />}
            onPress={onNativeShare}
            accessibilityHint="Shares event details and its public link using another app"
          >
            Share event link
          </Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
