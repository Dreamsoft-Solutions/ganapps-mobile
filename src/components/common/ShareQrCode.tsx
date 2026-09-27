import * as MediaLibrary from 'expo-media-library';
import { Download } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { saveQrImage } from '@/utils/qr-image';

/** Props for a scannable QR card that can be saved to the device photo library. */
export interface ShareQrCodeProps {
  /** Canonical URL or other payload encoded in the QR code. */
  value: string;
  /** Heading rendered in the card and saved image. */
  title: string;
  /** Human-readable identifiers and links rendered below the QR code. */
  details: readonly string[];
}

/**
 * Renders a QR image with human-readable details and a permission-aware save action.
 *
 * @param props - QR payload, title, and share details
 * @returns A QR card and its Save QR image action
 */
export function ShareQrCode({ value, title, details }: ShareQrCodeProps): ReactElement {
  const viewShotRef = useRef<ViewShotRef | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleSave = async (): Promise<void> => {
    setIsSaving(true);
    try {
      const result = await saveQrImage({
        requestWritePermission: async (): Promise<boolean> => {
          const permission: MediaLibrary.PermissionResponse = await MediaLibrary.requestPermissionsAsync(true);
          return permission.granted;
        },
        captureImage: (): Promise<string> => {
          const viewShot = viewShotRef.current;
          if (!viewShot) return Promise.reject(new Error('The QR image is not ready to save.'));
          return viewShot.capture();
        },
        saveImage: async (uri: string): Promise<void> => {
          await MediaLibrary.Asset.create(uri);
        },
      });

      if (result === 'permission-denied') {
        Alert.alert('Photo access needed', 'Allow Ganapps to add the QR image to your photo library, then try again.');
        return;
      }

      Alert.alert('QR image saved', 'The QR image is available in your photo library.');
    } catch {
      Alert.alert('Unable to save QR image', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View className="gap-md">
      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }} style={{ alignSelf: 'stretch' }}>
        <View className="items-center rounded-xl border border-border bg-card px-md py-lg">
          <Text className="mb-md text-center font-inter-semibold text-headline-sm" accessibilityRole="header">
            {title}
          </Text>
          <View
            className="rounded-lg p-sm"
            style={{ backgroundColor: Colors.light.background }}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`QR code for ${value}`}
          >
            <QRCode
              value={value}
              size={224}
              color={Colors.light.foreground}
              backgroundColor={Colors.light.background}
              ecl="M"
            />
          </View>
          <View className="mt-md w-full gap-xs">
            {details.map(
              (detail: string): ReactElement => (
                <Text key={detail} className="text-center text-body-md text-foreground" selectable>
                  {detail}
                </Text>
              ),
            )}
          </View>
        </View>
      </ViewShot>
      <Button
        variant="outline"
        loading={isSaving}
        disabled={isSaving}
        onPress={handleSave}
        leftIcon={<Download size={17} />}
      >
        Save QR image
      </Button>
    </View>
  );
}
