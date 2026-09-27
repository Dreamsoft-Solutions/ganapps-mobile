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
import { FlatList, type ListRenderItemInfo, RefreshControl, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Empty } from '@/components/common/Empty';
import { ErrorView } from '@/components/common/Error';
import { IconButton } from '@/components/common/IconButton';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { formatInterestLabel } from '@/constants/interests';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { ReactionType } from '@/types/chat.types';
import type { FriendUserSummary } from '@/types/friends.types';
import type { GanapAnnouncement, GanapDetail } from '@/types/ganap.types';
import type { AttendanceScanState } from '@/utils/attendance';
import type { FeedbackRowState } from '@/utils/feedback';
import type { GanapScheduleModel } from '@/utils/ganap-detail';
import { AnnouncementCard } from './AnnouncementCard';
import { AttendanceScanRow } from './AttendanceScanRow';
import { FeedbackRow } from './FeedbackRow';
import { GanapLocationLink } from './GanapLocationLink';

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
  /** Whether the route-owned detail and announcements refresh is active. */
  isRefreshing: boolean;
  /** Accepted friends whose server-enforced privacy settings expose this Ganap. */
  friendsGoing: FriendUserSummary[];
  isFriendsGoingLoading: boolean;
  friendsGoingError: Error | null;
  hasMoreFriendsGoing: boolean;
  /** Attendance scan surface state, driving the row's presentation. */
  scanState: AttendanceScanState;
  onBack: () => void;
  onShare: () => void | Promise<void>;
  /** Navigates to the focused Event Chat thread when Event Hub is eligible. */
  onOpenChat?: () => void;
  /** Refetches the Event Hub's detail and announcement data together. */
  onRefresh: () => Promise<void>;
  onRetryAnnouncements: () => void | Promise<void>;
  onRetryFriendsGoing: () => void | Promise<void>;
  onRetryNextPage: () => void | Promise<void>;
  onLoadMore: () => void | Promise<void>;
  /** Navigates to the attendance scanner; fired only when `scanState` is `available`. */
  onScanAttendance: () => void;
  /** Authoritative post-event feedback row state. */
  feedbackState: FeedbackRowState;
  /** Navigates to the post-event feedback flow; fired only when feedback is actionable. */
  onGiveFeedback: () => void;
  /** Sets or removes an eligible attendee's announcement acknowledgement. */
  onAnnouncementReaction?: (announcement: GanapAnnouncement, reaction: ReactionType | null) => void;
  /** Announcement currently being reconciled by the reaction mutation. */
  announcementReactionPendingId?: string | null;
}

interface FriendsGoingRowProps {
  friends: FriendUserSummary[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  onRetry: () => void | Promise<void>;
}

/** Formats the concise social proof shown beside the avatar stack. */
function getFriendsGoingLabel(friends: FriendUserSummary[], hasMore: boolean): string {
  const firstName: string | undefined = friends[0]?.displayName;
  if (!firstName) return 'No friends have shared that they are going.';
  if (hasMore) return `${firstName} and more friends are going`;
  if (friends.length === 1) return `${firstName} is going`;
  return `${firstName} and ${String(friends.length - 1)} ${friends.length === 2 ? 'friend' : 'friends'} are going`;
}

/** Privacy-filtered friend activity for this specific Ganap. */
function FriendsGoingRow({ friends, isLoading, error, hasMore, onRetry }: FriendsGoingRowProps): ReactElement {
  const visibleFriends: FriendUserSummary[] = friends.slice(0, 3);

  return (
    <View testID="friends-going" className="mt-sm rounded-xl border border-border bg-muted px-sm py-sm">
      <Text className="font-inter-semibold text-label-md">Friends going</Text>
      {isLoading ? (
        <Text className="mt-xs text-body-md text-muted-foreground">Checking your friends…</Text>
      ) : error ? (
        <View className="mt-xs flex-row items-center justify-between gap-sm">
          <Text className="min-w-0 flex-1 text-body-md text-muted-foreground">Friends activity is unavailable.</Text>
          <Button
            variant="outline"
            size="sm"
            onPress={(): void => {
              void onRetry();
            }}
          >
            Retry
          </Button>
        </View>
      ) : friends.length === 0 ? (
        <Text className="mt-xs text-body-md text-muted-foreground">No friends have shared that they are going.</Text>
      ) : (
        <View
          accessible
          accessibilityLabel={getFriendsGoingLabel(friends, hasMore)}
          className="mt-sm flex-row items-center"
        >
          <View testID="participant-avatar-stack" className="mr-sm flex-row">
            {visibleFriends.map(
              (friend: FriendUserSummary, index: number): ReactElement => (
                <View key={friend.userId} style={{ marginLeft: index === 0 ? 0 : -Spacing.xs }}>
                  <Avatar src={friend.displayPicture} name={friend.displayName} size="xs" />
                </View>
              ),
            )}
          </View>
          <Text className="min-w-0 flex-1 font-inter-semibold text-body-md">
            {getFriendsGoingLabel(friends, hasMore)}
          </Text>
        </View>
      )}
    </View>
  );
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

type EventHubTheme = 'light' | 'dark';

interface EventHubEmptyStateProps {
  accessLost: boolean;
  isAnnouncementsLoading: boolean;
  hasInitialError: boolean;
  announcementError: Error | null;
  onBack: () => void;
  onRetryAnnouncements: () => void | Promise<void>;
}

function EventHubEmptyState({
  accessLost,
  isAnnouncementsLoading,
  hasInitialError,
  announcementError,
  onBack,
  onRetryAnnouncements,
}: EventHubEmptyStateProps): ReactElement {
  if (accessLost) {
    return (
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
    );
  }

  if (isAnnouncementsLoading) return <Loading message="Loading announcements" />;

  if (hasInitialError) {
    return (
      <ErrorView
        error={announcementError}
        onRetry={(): void => {
          void onRetryAnnouncements();
        }}
      />
    );
  }

  return <Empty message="No announcements yet. The organizer will post updates here." />;
}

interface EventHubAnnouncementHeaderProps {
  ganap: GanapDetail;
  schedule: GanapScheduleModel;
  address: string | null;
  stackSchedule: boolean;
  theme: EventHubTheme;
  total: number;
  accessLost: boolean;
  friendsGoing: FriendUserSummary[];
  isFriendsGoingLoading: boolean;
  friendsGoingError: Error | null;
  hasMoreFriendsGoing: boolean;
  onRetryFriendsGoing: () => void | Promise<void>;
}

function EventHubAnnouncementHeader({
  ganap,
  schedule,
  address,
  stackSchedule,
  theme,
  total,
  accessLost,
  friendsGoing,
  isFriendsGoingLoading,
  friendsGoingError,
  hasMoreFriendsGoing,
  onRetryFriendsGoing,
}: EventHubAnnouncementHeaderProps): ReactElement {
  return (
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

        <GanapLocationLink
          className="mt-md min-h-touch"
          latitude={ganap.locationLat}
          longitude={ganap.locationLong}
          locationName={address}
        >
          <View className="min-h-touch flex-row items-center">
            <SummaryIconTile>
              <MapPin size={16} color={Colors[theme].primary} />
            </SummaryIconTile>
            <Text className="min-w-0 flex-1 font-inter-semibold text-body-md">
              {address ?? 'Location to be announced'}
            </Text>
          </View>
        </GanapLocationLink>

        <View className="mt-md flex-row items-start">
          <SummaryIconTile>
            <Users size={16} color={Colors[theme].primary} />
          </SummaryIconTile>
          <Text className="min-w-0 flex-1 font-inter-semibold text-body-md">
            {`${String(Math.max(0, ganap.registrationCount))} joined`}
          </Text>
        </View>

        <FriendsGoingRow
          friends={friendsGoing}
          isLoading={isFriendsGoingLoading}
          error={friendsGoingError}
          hasMore={hasMoreFriendsGoing}
          onRetry={onRetryFriendsGoing}
        />
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
}

interface EventHubTopBarProps {
  insetsTop: number;
  theme: EventHubTheme;
  onBack: () => void;
  onShare: () => void | Promise<void>;
  onOpenChat?: () => void;
}

function EventHubTopBar({ insetsTop, theme, onBack, onShare, onOpenChat }: EventHubTopBarProps): ReactElement {
  return (
    <View className="border-b border-border bg-background px-md pb-sm" style={{ paddingTop: insetsTop + Spacing.md }}>
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
          variant="default"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to Event Details"
          onPress={onBack}
        >
          <ArrowLeft size={20} color={Colors[theme].foreground} />
        </IconButton>

        <View className="flex-row gap-sm">
          <IconButton
            variant="default"
            accessibilityLabel="Share event"
            accessibilityHint="Opens the device share sheet"
            onPress={(): void => {
              void onShare();
            }}
          >
            <Share2 size={18} color={Colors[theme].foreground} />
          </IconButton>
          <IconButton
            variant="default"
            disabled={!onOpenChat}
            accessibilityLabel={onOpenChat ? 'Event chat' : 'Event chat coming soon'}
            accessibilityHint={
              onOpenChat ? 'Opens the Event Chat thread' : 'Event chat will be available in a later release'
            }
            onPress={onOpenChat ?? noop}
          >
            <MessageCircle
              size={18}
              color={onOpenChat ? Colors[theme].foreground : Colors[theme]['muted-foreground']}
            />
          </IconButton>
        </View>
      </View>
    </View>
  );
}

interface EventHubFooterProps {
  insetsBottom: number;
  attendanceOpenMinutesBefore: number;
  scanState: AttendanceScanState;
  feedbackState: FeedbackRowState;
  isFetchNextPageError: boolean;
  isFetchingNextPage: boolean;
  onRetryNextPage: () => void | Promise<void>;
  onScanAttendance: () => void;
  onGiveFeedback: () => void;
}

function EventHubFooter({
  insetsBottom,
  attendanceOpenMinutesBefore,
  scanState,
  feedbackState,
  isFetchNextPageError,
  isFetchingNextPage,
  onRetryNextPage,
  onScanAttendance,
  onGiveFeedback,
}: EventHubFooterProps): ReactElement {
  return (
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
      <View className="px-md pt-sm" style={{ paddingBottom: insetsBottom + Spacing.sm }}>
        <View className="mb-sm">
          <AttendanceScanRow
            state={scanState}
            attendanceOpenMinutesBefore={attendanceOpenMinutesBefore}
            onPress={scanState === 'available' ? onScanAttendance : noop}
          />
        </View>
        <View className="mb-sm">
          <FeedbackRow state={feedbackState} onPress={feedbackState.kind === 'actionable' ? onGiveFeedback : noop} />
        </View>
        <EventRemindersRow />
      </View>
    </>
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
  isRefreshing,
  friendsGoing,
  isFriendsGoingLoading,
  friendsGoingError,
  hasMoreFriendsGoing,
  scanState,
  onBack,
  onShare,
  onOpenChat,
  onRefresh,
  onRetryAnnouncements,
  onRetryFriendsGoing,
  onRetryNextPage,
  onLoadMore,
  onScanAttendance,
  feedbackState,
  onGiveFeedback,
  onAnnouncementReaction = (): void => {},
  announcementReactionPendingId = null,
}: EventHubViewProps): ReactElement {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const theme = useResolvedTheme();
  const stackSchedule: boolean = width < 375 || fontScale >= 1.3;
  const address: string | null = ganap.address?.trim() || null;
  const hasInitialError: boolean = Boolean(announcementError) && announcements.length === 0;
  const announcementEmptyState: ReactElement = (
    <EventHubEmptyState
      accessLost={accessLost}
      isAnnouncementsLoading={isAnnouncementsLoading}
      hasInitialError={hasInitialError}
      announcementError={announcementError}
      onBack={onBack}
      onRetryAnnouncements={onRetryAnnouncements}
    />
  );
  const announcementHeader: ReactElement = (
    <EventHubAnnouncementHeader
      ganap={ganap}
      schedule={schedule}
      address={address}
      stackSchedule={stackSchedule}
      theme={theme}
      total={total}
      accessLost={accessLost}
      friendsGoing={friendsGoing}
      isFriendsGoingLoading={isFriendsGoingLoading}
      friendsGoingError={friendsGoingError}
      hasMoreFriendsGoing={hasMoreFriendsGoing}
      onRetryFriendsGoing={onRetryFriendsGoing}
    />
  );

  return (
    <View className="flex-1 bg-background">
      <EventHubTopBar insetsTop={insets.top} theme={theme} onBack={onBack} onShare={onShare} onOpenChat={onOpenChat} />

      <View className="flex-1">
        <FlatList
          testID="announcement-list"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={(): void => {
                void onRefresh();
              }}
            />
          }
          data={announcements}
          keyExtractor={(announcement: GanapAnnouncement): string => announcement.id}
          renderItem={({ item }: ListRenderItemInfo<GanapAnnouncement>): ReactElement => (
            <AnnouncementCard
              announcement={item}
              onReaction={(reaction: ReactionType | null): void => onAnnouncementReaction(item, reaction)}
              reactionPending={announcementReactionPendingId === item.id}
            />
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
            <EventHubFooter
              insetsBottom={insets.bottom}
              attendanceOpenMinutesBefore={ganap.attendanceOpenMinutesBefore}
              scanState={scanState}
              feedbackState={feedbackState}
              isFetchNextPageError={isFetchNextPageError}
              isFetchingNextPage={isFetchingNextPage}
              onRetryNextPage={onRetryNextPage}
              onScanAttendance={onScanAttendance}
              onGiveFeedback={onGiveFeedback}
            />
          }
        />
      </View>
    </View>
  );
}
