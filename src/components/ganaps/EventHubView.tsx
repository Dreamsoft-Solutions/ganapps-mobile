import {
  ArrowLeft,
  BellRing,
  Calendar,
  Clock,
  Globe,
  MapPin,
  Megaphone,
  MessageCircle,
  Share2,
  Users,
} from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { FlatList, type ListRenderItemInfo, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { IconButton } from '@/components/common/IconButton';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { formatInterestLabel } from '@/constants/interests';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { GanapAnnouncement, GanapDetail } from '@/types/ganap.types';
import type { AttendanceScanState } from '@/utils/attendance';
import type { GanapScheduleModel } from '@/utils/ganap-detail';
import { AnnouncementCard } from './AnnouncementCard';
import { AttendanceScanRow } from './AttendanceScanRow';
import { FeedbackRow } from './FeedbackRow';

/** Stable no-op passed to {@link AttendanceScanRow} outside the `available` state. */
function noop(): void {}

/** Data and callbacks the Event Hub screen needs to render, with no API ownership. */
export interface EventHubViewProps {
  ganap: GanapDetail;
  schedule: GanapScheduleModel;
  announcements: GanapAnnouncement[];
  total: number;
  isAnnouncementsLoading: boolean;
  announcementError: Error | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  accessLost: boolean;
  /** Attendance scan surface state, driving the row's presentation. */
  scanState: AttendanceScanState;
  onBack: () => void;
  onShare: () => void | Promise<void>;
  onRetryAnnouncements: () => void | Promise<void>;
  onRetryNextPage: () => void | Promise<void>;
  onLoadMore: () => void | Promise<void>;
  /** Navigates to the attendance scanner; fired only when `scanState` is `available`. */
  onScanAttendance: () => void;
  /** Whether any post-event feedback step is still outstanding. */
  hasPendingFeedback: boolean;
  /** Navigates to the post-event feedback flow; fired only when `hasPendingFeedback` is true. */
  onGiveFeedback: () => void;
}

interface ScheduleItemProps {
  icon: ReactElement;
  label: string;
  value: string;
}

/**
 * Shared icon tile for every row of the compact Ganap summary.
 *
 * Each summary row wears the same tile so the rows share one left edge and
 * their text starts at the same offset.
 *
 * @param props - The icon to frame.
 * @returns A fixed-size tinted tile containing the icon.
 */
function SummaryIconTile({ children }: { children: ReactNode }): ReactElement {
  return <View className="mr-sm h-9 w-9 items-center justify-center rounded-md bg-muted">{children}</View>;
}

/**
 * Presents one date or time value in the compact Event Hub summary.
 *
 * @param props - Icon, label, and formatted value.
 * @returns A schedule item that wraps rather than truncates.
 */
function ScheduleItem({ icon, label, value }: ScheduleItemProps): ReactElement {
  return (
    <View className="min-w-0 flex-1 flex-row items-start">
      <SummaryIconTile>{icon}</SummaryIconTile>
      <View className="min-w-0 flex-1">
        <Text className="font-inter-semibold text-label-md text-muted-foreground">{label}</Text>
        <Text className="mt-1 font-inter-semibold text-body-md">{value}</Text>
      </View>
    </View>
  );
}

/**
 * Compact disabled row standing in for event reminders until DS-39 lands.
 *
 * @returns A visibly unavailable reminders row with disabled accessibility state.
 */
function EventRemindersRow(): ReactElement {
  const theme = useResolvedTheme();

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel="Event reminders, coming soon"
      accessibilityHint="Event reminders will be available in a later release"
      accessibilityState={{ disabled: true }}
      className="flex-row items-center justify-between rounded-lg border border-border bg-muted px-md py-sm opacity-50"
    >
      <View className="min-w-0 flex-1 flex-row items-center">
        <View className="mr-sm">
          <BellRing size={16} color={Colors[theme]['muted-foreground']} />
        </View>
        <Text className="min-w-0 flex-1 text-body-md text-muted-foreground">Event Reminders</Text>
      </View>
      <Text className="ml-sm text-label-sm text-muted-foreground">Coming soon</Text>
    </View>
  );
}

/**
 * Renders the MagicPath-derived Event Hub screen for an eligible attendee.
 *
 * The custom header stays fixed while the event summary and announcement content
 * share one scroll surface, so large text sizes cannot consume the list's height.
 * All data and callbacks arrive as props; the view performs no fetching,
 * navigation, or sharing itself.
 *
 * @param props - Ganap detail, derived schedule, announcement state, and route-owned callbacks.
 * @returns The Event Hub screen.
 */
export function EventHubView({
  ganap,
  schedule,
  announcements,
  total,
  isAnnouncementsLoading,
  announcementError,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  accessLost,
  scanState,
  onBack,
  onShare,
  onRetryAnnouncements,
  onRetryNextPage,
  onLoadMore,
  onScanAttendance,
  hasPendingFeedback,
  onGiveFeedback,
}: EventHubViewProps): ReactElement {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const theme = useResolvedTheme();
  const stackSchedule: boolean = width < 375 || fontScale >= 1.3;
  const address: string | null = ganap.address?.trim() || null;
  const hasInitialError: boolean = Boolean(announcementError) && announcements.length === 0;
  const announcementEmptyState: ReactElement = accessLost ? (
    <View className="flex-1 items-center justify-center p-xl">
      <Text className="mb-sm text-center font-inter-semibold text-headline-sm">
        Event Hub access is no longer available
      </Text>
      <Text className="mb-lg text-center text-body-md text-muted-foreground">
        Your registration for this event has changed. Event Details shows its current status.
      </Text>
      <Button variant="outline" size="md" onPress={onBack}>
        Back to Event Details
      </Button>
    </View>
  ) : isAnnouncementsLoading ? (
    <Loading message="Loading announcements" />
  ) : hasInitialError ? (
    <ErrorView
      error={announcementError}
      onRetry={(): void => {
        void onRetryAnnouncements();
      }}
    />
  ) : (
    <Empty message="No announcements yet. The organizer will post updates here." />
  );
  const announcementHeader: ReactElement = (
    <>
      <View className="px-md pt-md">
        <Text className="font-inter-bold text-headline-md">{ganap.title}</Text>

        <View className="mt-sm flex-row flex-wrap items-center gap-sm">
          {ganap.tags.map(
            (tag: string): ReactElement => (
              <View key={tag} className="rounded-full border border-border bg-background px-sm py-xs">
                <Text className="text-label-sm">{formatInterestLabel(tag)}</Text>
              </View>
            ),
          )}
          <View testID="public-badge" className="flex-row items-center rounded-full bg-info px-sm py-xs">
            <View className="mr-xs">
              <Globe size={12} color={Colors[theme]['info-foreground']} />
            </View>
            <Text className="font-inter-semibold text-label-sm text-info-foreground">Public</Text>
          </View>
        </View>

        <View className="mt-md h-px bg-border" />

        <View testID="event-hub-schedule" className={`mt-md gap-md ${stackSchedule ? '' : 'flex-row'}`}>
          <ScheduleItem
            icon={<Calendar size={16} color={Colors[theme].primary} />}
            label="Date"
            value={schedule.dateLabel}
          />
          <ScheduleItem
            icon={<Clock size={16} color={Colors[theme].primary} />}
            label="Time"
            value={schedule.timeLabel}
          />
        </View>

        <View className="mt-md flex-row items-start">
          <SummaryIconTile>
            <MapPin size={16} color={Colors[theme].primary} />
          </SummaryIconTile>
          <Text className="min-w-0 flex-1 font-inter-semibold text-body-md">
            {address ?? 'Location to be announced'}
          </Text>
        </View>

        <View className="mt-md flex-row items-start">
          <SummaryIconTile>
            <Users size={16} color={Colors[theme].primary} />
          </SummaryIconTile>
          <Text className="min-w-0 flex-1 font-inter-semibold text-body-md">
            {`${String(Math.max(0, ganap.registrationCount))} joined`}
          </Text>
        </View>
      </View>

      <View className="mt-md flex-row items-center justify-between border-t border-border px-md py-sm">
        <View className="min-w-0 flex-1 flex-row items-center">
          <View className="mr-xs">
            <Megaphone size={16} color={Colors[theme].primary} />
          </View>
          <Text className="min-w-0 flex-1 font-inter-bold text-headline-sm">Announcements</Text>
        </View>
        <View className="ml-sm rounded-full bg-primary px-sm py-xs">
          <Text testID="announcement-total" className="font-inter-semibold text-label-sm text-primary-foreground">
            {String(accessLost ? 0 : total)}
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <View className="flex-1 bg-background">
      <View
        className="border-b border-border bg-background px-md pb-sm"
        style={{ paddingTop: insets.top + Spacing.md }}
      >
        <View className="relative flex-row items-center justify-between">
          {/*
           * The title is overlaid rather than laid out between the controls: one
           * button on the left and two on the right would otherwise push it
           * off-centre by half their width difference.
           */}
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <Text className="font-inter-bold text-headline-sm" accessibilityRole="header">
              Event Hub
            </Text>
          </View>

          <IconButton
            size="lg"
            variant="default"
            accessibilityLabel="Go back"
            accessibilityHint="Returns to Event Details"
            onPress={onBack}
          >
            <ArrowLeft size={20} color={Colors[theme].foreground} />
          </IconButton>

          <View className="flex-row gap-sm">
            <IconButton
              size="lg"
              variant="default"
              accessibilityLabel="Share event"
              accessibilityHint="Opens the device share sheet"
              onPress={(): void => {
                void onShare();
              }}
            >
              <Share2 size={18} color={Colors[theme].foreground} />
            </IconButton>
            {/* TODO(DS-48): Navigate to the event group chat when the mobile chat screen is implemented. */}
            <IconButton
              size="lg"
              variant="default"
              disabled
              accessibilityLabel="Event chat coming soon"
              accessibilityHint="Event chat will be available in a later release"
              onPress={(): void => {}}
            >
              <MessageCircle size={18} color={Colors[theme]['muted-foreground']} />
            </IconButton>
          </View>
        </View>
      </View>

      <View className="flex-1">
        <FlatList
          testID="announcement-list"
          data={announcements}
          keyExtractor={(announcement: GanapAnnouncement): string => announcement.id}
          renderItem={({ item }: ListRenderItemInfo<GanapAnnouncement>): ReactElement => (
            <AnnouncementCard announcement={item} />
          )}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, flexGrow: 1 }}
          ListHeaderComponent={announcementHeader}
          ListEmptyComponent={announcementEmptyState}
          onEndReached={(): void => {
            // A failed page waits for the explicit retry rather than looping on every scroll.
            if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void onLoadMore();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            <>
              {isFetchNextPageError ? (
                <View className="items-center py-sm">
                  <Text className="mb-sm text-center text-body-md text-muted-foreground">
                    More announcements could not be loaded.
                  </Text>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={(): void => {
                      void onRetryNextPage();
                    }}
                  >
                    Retry loading more
                  </Button>
                </View>
              ) : isFetchingNextPage ? (
                <View className="py-sm">
                  <Loading message="Loading more announcements" />
                </View>
              ) : null}
              <View className="px-md pt-sm" style={{ paddingBottom: insets.bottom + Spacing.sm }}>
                <View className="mb-sm">
                  {/*
                   * Only the `available` state gets the live callback: RNTL's `fireEvent.press`
                   * walks the fiber tree for any ancestor prop literally named `onPress`, so a
                   * non-interactive branch would otherwise still "fire" a press that no real
                   * touch on a plain View could ever produce.
                   */}
                  <AttendanceScanRow state={scanState} onPress={scanState === 'available' ? onScanAttendance : noop} />
                </View>
                <View className="mb-sm">
                  <FeedbackRow isPending={hasPendingFeedback} onPress={hasPendingFeedback ? onGiveFeedback : noop} />
                </View>
                <EventRemindersRow />
              </View>
            </>
          }
        />
      </View>
    </View>
  );
}
