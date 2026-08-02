import { Calendar, CheckCircle2, ChevronRight, Clock } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Card } from '@/components/common/Card';
import { Text } from '@/components/common/Text';
import { formatInterestLabel } from '@/constants/interests';
import type { RegistrationStatus } from '@/types/ganap.types';
import type { JoinedGanap } from '@/types/profile.types';

const REGISTRATION_LABELS: Record<RegistrationStatus, string> = {
  PENDING: 'Pending',
  REGISTERED: 'Joined',
  WAITLISTED: 'Waitlisted',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  ATTENDED: 'Attended',
  EVICTED: 'Removed',
};

interface JoinedGanapCardProps {
  ganap: JoinedGanap;
  onPress?: () => void;
}

/**
 * Compact joined Ganap row used in profile previews and lists.
 *
 * @param props - Ganap data and an optional detail navigation handler.
 * @returns A pressable joined Ganap card.
 */
export function JoinedGanapCard({ ganap, onPress }: JoinedGanapCardProps): ReactElement {
  const registrationLabel: string = REGISTRATION_LABELS[ganap.registrationStatus];
  const firstTag: string | undefined = ganap.tags[0];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="active:opacity-80"
    >
      <Card className="mb-sm flex-row items-start">
        <View className="mr-sm h-10 w-10 items-center justify-center rounded-md bg-primary/10">
          <Calendar size={18} className="text-primary" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-headline-sm" numberOfLines={2}>
            {ganap.title}
          </Text>
          <Text className="mt-1 text-label-sm text-muted-foreground" numberOfLines={1}>
            {ganap.businessName}
          </Text>
          <View className="mt-2 flex-row items-center">
            <Clock size={12} className="mr-1 text-muted-foreground" />
            <Text className="text-label-sm text-muted-foreground">{formatGanapDate(ganap.startDate)}</Text>
          </View>
        </View>
        <View className="ml-sm items-end">
          <View className="flex-row items-center rounded-full bg-muted px-2 py-1">
            <CheckCircle2 size={12} className="mr-1 text-primary" />
            <Text className="text-label-sm text-muted-foreground">{registrationLabel}</Text>
          </View>
          {firstTag && (
            <Text className="mt-2 max-w-24 text-right text-label-sm text-muted-foreground" numberOfLines={1}>
              {formatInterestLabel(firstTag)}
            </Text>
          )}
        </View>
        {onPress && <ChevronRight size={18} className="ml-1 mt-1 text-muted-foreground" />}
      </Card>
    </Pressable>
  );
}

/**
 * Formats a Ganap start time for a compact mobile row.
 *
 * @param isoDate - ISO date returned by the server.
 * @returns A localized short date and time.
 */
function formatGanapDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
