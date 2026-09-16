import { CircleCheck, QrCode } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { AttendanceScanState } from '@/utils/attendance';

/** Props for the Event Hub attendance row. */
export interface AttendanceScanRowProps {
  /** Scan surface state; `hidden` renders nothing. */
  state: AttendanceScanState;
  /** Configured number of minutes before the Ganap starts when scanning opens. */
  attendanceOpenMinutesBefore?: number;
  /** Fired only in the `available` state. */
  onPress: () => void;
}

/** Builds the locked-row copy from the organizer's configured opening lead time. */
function getOpeningCopy(attendanceOpenMinutesBefore: number | undefined): string {
  if (!Number.isFinite(attendanceOpenMinutesBefore)) return 'Attendance scan opens before the event starts';

  const minutes: number = Math.max(0, attendanceOpenMinutesBefore ?? 0);
  if (minutes === 0) return 'Attendance scan opens when the event starts';

  const unit: string = minutes === 1 ? 'minute' : 'minutes';
  return `Attendance scan opens ${minutes} ${unit} before the event starts`;
}

/**
 * Event Hub row surfacing the post-event attendance scan.
 *
 * Deliberately visible while locked so students learn during the event that a
 * scan is coming and secure the organizer's QR before leaving.
 *
 * @param props - Scan state and the navigate-to-scanner callback.
 * @returns The row for the current state, or null when hidden.
 */
export function AttendanceScanRow({
  state,
  attendanceOpenMinutesBefore,
  onPress,
}: AttendanceScanRowProps): ReactElement | null {
  const theme = useResolvedTheme();

  if (state === 'hidden') return null;

  if (state === 'recorded') {
    return (
      <View
        testID="attendance-scan-row"
        accessible
        accessibilityLabel="Attendance recorded"
        className="flex-row items-center rounded-lg border border-border bg-muted px-md py-sm"
      >
        <View className="mr-sm">
          <CircleCheck size={16} color={Colors[theme].primary} />
        </View>
        <Text className="min-w-0 flex-1 text-body-md">Attendance recorded</Text>
      </View>
    );
  }

  if (state === 'closed') {
    return (
      <View
        testID="attendance-scan-row"
        accessible
        accessibilityLabel="Attendance scan is closed"
        accessibilityState={{ disabled: true }}
        className="rounded-lg border border-border bg-muted px-md py-sm opacity-50"
      >
        <View className="flex-row items-center">
          <View className="mr-sm">
            <QrCode size={16} color={Colors[theme]['muted-foreground']} />
          </View>
          <Text className="min-w-0 flex-1 text-body-md text-muted-foreground">Attendance scan is closed</Text>
        </View>
        <Text className="mt-1 text-label-sm text-muted-foreground">The attendance window has ended.</Text>
      </View>
    );
  }

  if (state === 'locked') {
    return (
      <View
        testID="attendance-scan-row"
        accessible
        accessibilityRole="button"
        accessibilityLabel={getOpeningCopy(attendanceOpenMinutesBefore)}
        accessibilityHint="Get the QR code from the organizer before you leave"
        accessibilityState={{ disabled: true }}
        className="rounded-lg border border-border bg-muted px-md py-sm opacity-50"
      >
        <View className="flex-row items-center">
          <View className="mr-sm">
            <QrCode size={16} color={Colors[theme]['muted-foreground']} />
          </View>
          <Text className="min-w-0 flex-1 text-body-md text-muted-foreground">
            {getOpeningCopy(attendanceOpenMinutesBefore)}
          </Text>
        </View>
        <Text className="mt-1 text-label-sm text-muted-foreground">
          Get the QR from the organizer before you leave.
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      testID="attendance-scan-row"
      accessibilityRole="button"
      accessibilityLabel="Scan attendance QR"
      accessibilityHint="Opens the camera to scan the organizer's code"
      onPress={(): void => onPress()}
      className="flex-row items-center rounded-lg border border-primary bg-background px-md py-sm"
    >
      <View className="mr-sm">
        <QrCode size={16} color={Colors[theme].primary} />
      </View>
      <Text className="min-w-0 flex-1 font-inter-semibold text-body-md text-primary">Scan attendance QR</Text>
    </Pressable>
  );
}
