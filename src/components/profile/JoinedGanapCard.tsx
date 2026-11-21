import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Calendar, CheckCircle2, ChevronRight, CircleCheck, Clock } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { chipTextVariants } from '@/components/common/Chip';
import { Text } from '@/components/common/Text';
import { Routes } from '@/constants/routes';
import { formatInterestLabel } from '@/constants/interests';
import { useEventTime } from '@/hooks/useEventTime';
import type { RegistrationStatus } from '@/types/ganap.types';
import type { JoinedGanap } from '@/types/profile.types';
import { getGanapLifecycleLabel } from '@/utils/ganap-detail';

/**
 * Fill the thumbnail as a real style object, not a class.
 *
 * `expo-image` registers no `cssInterop`, so it drops a `className` silently
 * and the image collapses to nothing. Same fix DS-44 applied to the feed
 * poster; see `GanapFeedCard.POSTER_FILL`.
 */
const THUMBNAIL_FILL = { width: '100%', height: '100%' } as const;

const REGISTRATION_LABELS: Record<RegistrationStatus, string> = {
  PENDING: 'Pending',
  REGISTERED: 'Joined',
  WAITLISTED: 'Waitlisted',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  ATTENDED: 'Attended',
  EVICTED: 'Removed',
};

const FORM_REQUIRED_HELPER = 'Required before you rate';
const FORM_LOCKED_HELPER = 'Opens after your attendance is recorded';

interface JoinedGanapCardProps {
  ganap: JoinedGanap;
  onPress?: () => void;
}

/**
 * Compact joined Ganap row used in profile previews and lists.
 *
 * @param props - Ganap data and an optional detail navigation handler.
 * @returns A joined Ganap card: a pressable detail row, then the feedback form action when the Ganap has a form.
 */
export function JoinedGanapCard({ ganap, onPress }: JoinedGanapCardProps): ReactElement {
  const registrationLabel: string = REGISTRATION_LABELS[ganap.registrationStatus];
  const now = useEventTime(ganap.endDate);
  const lifecycleLabel = getGanapLifecycleLabel(ganap, now);
  const firstTag: string | undefined = ganap.tags[0];
  const coverImage: string | null = ganap.coverImage || null;

  return (
    <Card className="mb-sm">
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        className="flex-row items-start active:opacity-80"
      >
        <View className="mr-sm h-10 w-10 overflow-hidden rounded-md bg-muted">
          {coverImage ? (
            <Image
              source={{ uri: coverImage }}
              style={THUMBNAIL_FILL}
              contentFit="cover"
              accessibilityLabel={`${ganap.title} event image`}
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Calendar size={18} className="text-primary" />
            </View>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-headline-sm" numberOfLines={2}>
            {ganap.title}
          </Text>
          <Text className="mt-1 text-label-sm text-muted-foreground" numberOfLines={1}>
            {ganap.businessName}
          </Text>
          <View className="mt-2 flex-row items-center">
            <View className="mr-xs">
              <Clock size={12} className="text-muted-foreground" />
            </View>
            <Text className="text-label-sm text-muted-foreground">{formatGanapDate(ganap.startDate)}</Text>
          </View>
        </View>
        <View className="ml-sm items-end">
          <View className="flex-row items-center rounded-full bg-muted px-2 py-1">
            <View className="mr-xs">
              <CheckCircle2 size={12} className="text-primary" />
            </View>
            <Text className="text-label-sm text-muted-foreground">{registrationLabel}</Text>
          </View>
          {lifecycleLabel && <Text className="mt-1 text-label-sm text-muted-foreground">{lifecycleLabel}</Text>}
          {firstTag && (
            <Text className="mt-2 max-w-24 text-right text-label-sm text-muted-foreground" numberOfLines={1}>
              {formatInterestLabel(firstTag)}
            </Text>
          )}
        </View>
        {onPress && (
          <View className="ml-xs mt-1">
            <ChevronRight size={18} className="text-muted-foreground" />
          </View>
        )}
      </Pressable>
      {ganap.hasPostAttendanceForm === true && <FeedbackFormAction ganap={ganap} />}
    </Card>
  );
}

/**
 * Feedback form slot under a joined Ganap row: a submitted chip, an answer button, or a locked button.
 *
 * Lives beside the detail `Pressable`, not inside it, so screen readers can reach the button.
 *
 * @param props - The joined Ganap whose post-attendance form this slot reflects.
 * @returns The chip, or the button with its helper line.
 */
function FeedbackFormAction({ ganap }: { ganap: JoinedGanap }): ReactElement {
  const router = useRouter();

  if (ganap.postAttendanceFormSubmittedAt) {
    return (
      <View
        accessibilityRole="text"
        className="mt-sm flex-row items-center self-start rounded-full border border-input bg-background px-4 py-2"
      >
        <View className="mr-xs">
          <CircleCheck size={14} className="text-primary" />
        </View>
        <Text className={chipTextVariants({ selected: false })}>Feedback form submitted</Text>
      </View>
    );
  }

  const attended: boolean = ganap.registrationStatus === 'ATTENDED';
  const helper: string | null = attended
    ? ganap.postAttendanceFormPolicy === 'REQUIRED'
      ? FORM_REQUIRED_HELPER
      : null
    : FORM_LOCKED_HELPER;

  return (
    <View className="mt-sm items-start">
      <Button
        variant="secondary"
        size="sm"
        disabled={!attended}
        accessibilityLabel={`Answer the feedback form for ${ganap.title}`}
        accessibilityHint={attended ? undefined : FORM_LOCKED_HELPER}
        onPress={(): void => {
          router.push(Routes.ganapFeedback(ganap.id, 'form'));
        }}
      >
        Answer feedback form
      </Button>
      {helper && <Text className="mt-xs text-label-sm text-muted-foreground">{helper}</Text>}
    </View>
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
