import type { BarcodeScanningResult } from 'expo-camera';
import { CameraView } from 'expo-camera';
import { ArrowLeft, CircleAlert, CircleCheck, CloudUpload, Settings } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { CheckInErrorModel } from '@/utils/attendance';

/** Which stage of the scan flow the screen is presenting. */
export type AttendanceScanPhase =
  | { name: 'permission-denied' }
  | { name: 'scanning' }
  | { name: 'submitting' }
  | { name: 'recorded' }
  | { name: 'queued' }
  | { name: 'error'; model: CheckInErrorModel; canRescan: boolean };

/** Data and callbacks the scanner screen needs, with no API ownership. */
export interface AttendanceScanViewProps {
  /** Current stage of the scan flow. */
  phase: AttendanceScanPhase;
  /** Ganap title, shown once known; null while detail is still loading. */
  eventTitle: string | null;
  /** Fired with the raw QR content on each camera read. */
  onBarcodeScanned: (data: string) => void;
  /** Returns to the `scanning` phase for another attempt. */
  onScanAgain: () => void;
  /** Opens the device Settings app so the student can grant camera access. */
  onOpenSettings: () => void | Promise<void>;
  /** Leaves the scanner screen. */
  onBack: () => void;
}

/**
 * Attendance scanner presentation: camera permission fallback, live scanning,
 * submission, and the recorded/queued/error outcomes.
 *
 * Owns no API calls or navigation; the route supplies all state and callbacks.
 *
 * @param props - Current phase, event title, and the route's callbacks.
 * @returns The scanner screen body for the current phase.
 */
export function AttendanceScanView({
  phase,
  eventTitle,
  onBarcodeScanned,
  onScanAgain,
  onOpenSettings,
  onBack,
}: AttendanceScanViewProps): ReactElement {
  const insets = useSafeAreaInsets();
  const theme = useResolvedTheme();

  return (
    <View className="flex-1 bg-background">
      <View
        className="border-b border-border bg-background px-md pb-sm"
        style={{ paddingTop: insets.top + Spacing.md }}
      >
        <View className="relative flex-row items-center justify-center">
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <Text className="font-inter-bold text-headline-sm" accessibilityRole="header">
              Record Attendance
            </Text>
          </View>

          <View className="w-full flex-row items-center justify-between">
            <IconButton
              size="lg"
              variant="default"
              accessibilityLabel="Go back"
              accessibilityHint="Leaves the attendance scanner"
              onPress={onBack}
            >
              <ArrowLeft size={20} color={Colors[theme].foreground} />
            </IconButton>
            <View className="w-12" />
          </View>
        </View>
      </View>

      <View className="flex-1">
        {phase.name === 'permission-denied' && (
          <View className="flex-1 items-center justify-center p-xl">
            <View className="mb-md">
              <Settings size={64} color={Colors[theme]['muted-foreground']} />
            </View>
            <Text className="mb-sm text-center font-inter-semibold text-headline-sm">Camera access needed</Text>
            <Text className="mb-lg text-center text-body-md text-muted-foreground">
              Ganapps needs the camera to scan the organizer's attendance QR code. Allow camera access in Settings to
              record your attendance.
            </Text>
            <View className="w-full gap-sm">
              <Button variant="default" size="md" onPress={onOpenSettings}>
                Open Settings
              </Button>
              <Button variant="outline" size="md" onPress={onBack}>
                Go back
              </Button>
            </View>
          </View>
        )}

        {(phase.name === 'scanning' || phase.name === 'submitting') && (
          <View className="flex-1">
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={
                phase.name === 'submitting'
                  ? undefined
                  : (result: BarcodeScanningResult): void => onBarcodeScanned(result.data)
              }
            />
            {phase.name === 'scanning' && (
              <View className="absolute inset-x-0 bottom-0 items-center px-xl pb-xl">
                <View className="rounded-lg bg-background px-md py-sm">
                  <Text className="text-center text-body-md">
                    Point your camera at the organizer's attendance QR code.
                  </Text>
                </View>
              </View>
            )}
            {phase.name === 'submitting' && (
              <View className="absolute inset-0 items-center justify-center bg-background">
                <Loading message="Recording attendance" />
              </View>
            )}
          </View>
        )}

        {phase.name === 'recorded' && (
          <View className="flex-1 items-center justify-center p-xl">
            <View className="mb-md">
              <CircleCheck size={64} color={Colors[theme].primary} />
            </View>
            <Text className="mb-sm text-center font-inter-semibold text-headline-sm">Attendance recorded</Text>
            <Text className="mb-lg text-center text-body-md text-muted-foreground">
              {eventTitle
                ? `${eventTitle} — you're all set. Thanks for coming.`
                : "You're all set — thanks for coming."}
            </Text>
            <Button variant="default" size="md" onPress={onBack}>
              Done
            </Button>
          </View>
        )}

        {phase.name === 'queued' && (
          <View className="flex-1 items-center justify-center p-xl">
            <View className="mb-md">
              <CloudUpload size={64} color={Colors[theme].primary} />
            </View>
            <Text className="mb-sm text-center font-inter-semibold text-headline-sm">Saved on this device</Text>
            <Text className="mb-lg text-center text-body-md text-muted-foreground">
              You're offline right now. Your attendance was saved with the scan time and will be recorded automatically
              when you're back online.
            </Text>
            <Button variant="default" size="md" onPress={onBack}>
              Done
            </Button>
          </View>
        )}

        {phase.name === 'error' && (
          <View className="flex-1 items-center justify-center p-xl">
            <View className="mb-md">
              <CircleAlert size={64} color={Colors[theme].destructive} />
            </View>
            <Text className="mb-sm text-center font-inter-semibold text-headline-sm">{phase.model.title}</Text>
            <Text className="mb-lg text-center text-body-md text-muted-foreground">{phase.model.message}</Text>
            <View className="w-full gap-sm">
              {phase.canRescan && (
                <Button variant="default" size="md" onPress={onScanAgain}>
                  Scan again
                </Button>
              )}
              <Button variant="outline" size="md" onPress={onBack}>
                Go back
              </Button>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
