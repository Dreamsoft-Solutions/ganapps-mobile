import type { UseQueryResult } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ReactElement, useCallback, useState } from 'react';
import { Share, View } from 'react-native';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { EventHubView } from '@/components/ganaps/EventHubView';
import { Routes } from '@/constants/routes';
import { useAnnouncementReactionMutation } from '@/hooks/mutations/useChatEngagementMutation';
import { useFriendGoingQuery } from '@/hooks/queries/useFriendsQuery';
import { useFormBlocksQuery, useGanapDetailQuery } from '@/hooks/queries/useGanapsQuery';
import { type UseGanapAnnouncementsResult, useGanapAnnouncements } from '@/hooks/useGanapAnnouncements';
import { showToast } from '@/store/toast.store';
import type { ReactionType } from '@/types/chat.types';
import type { FriendGoingRecord, FriendUserSummary } from '@/types/friends.types';
import type { FormBlock, GanapAnnouncement, GanapDetail, RegistrationStatus } from '@/types/ganap.types';
import { type AttendanceScanState, getAttendanceScanState } from '@/utils/attendance';
import { canAccessEventHub } from '@/utils/event-hub';
import { type FeedbackRowState, getFeedbackRowState } from '@/utils/feedback';
import { buildGanapShareMessage, type GanapScheduleModel, getGanapScheduleModel } from '@/utils/ganap-detail';

interface EventHubUnavailableProps {
  onBack: () => void;
}

interface EligibleEventHubProps {
  ganap: GanapDetail;
  onBack: () => void;
  /** Navigates to the Event Chat thread for this Ganap. */
  onOpenChat: () => void;
  /** Refetches the Event Details query shared with the Hub refresh gesture. */
  onRefreshDetail: () => Promise<void>;
  /** Navigates to the attendance scanner; forwarded from the outer screen. */
  onScanAttendance: () => void;
  /** Navigates to the post-event feedback flow; forwarded from the outer screen. */
  onGiveFeedback: () => void;
}

/**
 * Explains that Event Hub is limited to joined or attended students.
 *
 * @param props - Handler returning to the Ganap's Event Details screen.
 * @returns The full-screen ineligible state.
 */
function EventHubUnavailable({ onBack }: EventHubUnavailableProps): ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-background p-xl">
      <Text className="mb-sm text-center font-inter-semibold text-headline-sm" accessibilityRole="header">
        Event Hub is for joined students
      </Text>
      <Text className="mb-lg text-center text-body-md text-muted-foreground">
        Join this event and have your registration confirmed to see announcements here.
      </Text>
      <Button variant="outline" size="lg" onPress={onBack}>
        Back to Event Details
      </Button>
    </View>
  );
}

/**
 * Owns announcement state for an attendee who already passed the access guard.
 *
 * Mounted only after eligibility is known, so the announcement query never runs
 * for an ineligible caller. When the server later revokes access, the cached
 * announcements are withheld rather than presented as current.
 *
 * @param props - The loaded Ganap, the shared back handler, and the scan navigation callback.
 * @returns The loaded Event Hub screen.
 */
function EligibleEventHub({
  ganap,
  onBack,
  onOpenChat,
  onRefreshDetail,
  onScanAttendance,
  onGiveFeedback,
}: EligibleEventHubProps): ReactElement {
  const announcements: UseGanapAnnouncementsResult = useGanapAnnouncements(ganap.id, true);
  const friendsGoingQuery = useFriendGoingQuery(true, ganap.id);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const schedule: GanapScheduleModel = getGanapScheduleModel(ganap.startDate, ganap.endDate);
  const accessLost: boolean = announcements.hasLostAccess;
  const scanState: AttendanceScanState = getAttendanceScanState(ganap, new Date());
  const formBlocksQuery: UseQueryResult<FormBlock[], Error> = useFormBlocksQuery(ganap.id, 'POST_ATTENDANCE');
  const announcementReactionMutation = useAnnouncementReactionMutation();
  const [announcementReactionPendingId, setAnnouncementReactionPendingId] = useState<string | null>(null);
  const feedbackState: FeedbackRowState = getFeedbackRowState(
    ganap,
    formBlocksQuery.data,
    announcements.hasLostAccess || formBlocksQuery.isLoading || formBlocksQuery.error !== null,
  );
  const friendsGoing: FriendUserSummary[] = friendsGoingQuery.going
    .filter((record: FriendGoingRecord): boolean => record.ganap.ganapId === ganap.id)
    .map((record: FriendGoingRecord): FriendUserSummary => record.user);

  async function handleShare(): Promise<void> {
    await Share.share({ message: buildGanapShareMessage(ganap, schedule), title: ganap.title });
  }

  const handleAnnouncementReaction = useCallback(
    async (announcement: GanapAnnouncement, reaction: ReactionType | null): Promise<void> => {
      if (!announcement.reactionSummary || announcementReactionMutation.isPending) return;
      setAnnouncementReactionPendingId(announcement.id);
      try {
        await announcementReactionMutation.mutateAsync({
          ganapId: ganap.id,
          announcementId: announcement.id,
          reaction,
        });
      } catch {
        showToast('error', 'Acknowledgement could not be saved.');
      } finally {
        setAnnouncementReactionPendingId(null);
      }
    },
    [announcementReactionMutation, ganap.id],
  );

  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      await Promise.all([onRefreshDetail(), announcements.refetch(), friendsGoingQuery.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [announcements.refetch, friendsGoingQuery.refetch, onRefreshDetail]);

  return (
    <EventHubView
      ganap={ganap}
      schedule={schedule}
      announcements={accessLost ? [] : announcements.announcements}
      total={accessLost ? 0 : announcements.total}
      isAnnouncementsLoading={announcements.isLoading}
      announcementError={accessLost ? null : announcements.error}
      hasNextPage={!accessLost && announcements.hasNextPage}
      isFetchingNextPage={!accessLost && announcements.isFetchingNextPage}
      isFetchNextPageError={!accessLost && announcements.isFetchNextPageError}
      accessLost={accessLost}
      isRefreshing={isRefreshing}
      friendsGoing={accessLost ? [] : friendsGoing}
      isFriendsGoingLoading={!accessLost && friendsGoingQuery.isLoading}
      friendsGoingError={accessLost ? null : friendsGoingQuery.error}
      hasMoreFriendsGoing={!accessLost && Boolean(friendsGoingQuery.hasNextPage)}
      scanState={scanState}
      onBack={onBack}
      onShare={handleShare}
      onOpenChat={onOpenChat}
      onRefresh={handleRefresh}
      onRetryAnnouncements={(): void => {
        void announcements.refetch();
      }}
      onRetryFriendsGoing={(): void => {
        void friendsGoingQuery.refetch();
      }}
      onRetryNextPage={(): void => {
        void announcements.fetchNextPage();
      }}
      onLoadMore={(): void => {
        void announcements.fetchNextPage();
      }}
      onScanAttendance={onScanAttendance}
      feedbackState={feedbackState}
      onGiveFeedback={onGiveFeedback}
      onAnnouncementReaction={handleAnnouncementReaction}
      announcementReactionPendingId={announcementReactionPendingId}
    />
  );
}

/**
 * Guarded Event Hub route for a single Ganap.
 *
 * Loads Ganap detail first and enforces the local `REGISTERED`/`ATTENDED` rule
 * before any announcement data is requested, so a direct route entry fails
 * closed exactly like the hidden Event Details action does.
 *
 * @returns The loading, error, not-found, ineligible, or loaded Event Hub state.
 */
export default function EventHubScreen(): ReactElement {
  const { 'ganap-id': ganapId } = useLocalSearchParams<{ 'ganap-id': string }>();
  const router = useRouter();
  const detail = useGanapDetailQuery(ganapId);

  function handleBack(): void {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }

    router.replace(Routes.ganapDetail(ganapId));
  }

  function handleScanAttendance(): void {
    router.push(Routes.attendanceScan(ganapId));
  }

  function handleGiveFeedback(): void {
    router.push(Routes.ganapFeedback(ganapId));
  }

  function handleOpenChat(): void {
    router.push(Routes.eventChat(ganapId));
  }

  if (detail.isLoading) return <Loading />;
  if (detail.error) return <ErrorView error={detail.error} onRetry={(): void => void detail.refetch()} />;
  if (!detail.data) return <ErrorView error={new Error('Event not found')} />;

  const registrationStatus: RegistrationStatus | null = detail.data.myRegistration?.status ?? null;
  if (!canAccessEventHub(registrationStatus)) return <EventHubUnavailable onBack={handleBack} />;

  return (
    <EligibleEventHub
      ganap={detail.data}
      onBack={handleBack}
      onOpenChat={handleOpenChat}
      onRefreshDetail={async (): Promise<void> => {
        await detail.refetch();
      }}
      onScanAttendance={handleScanAttendance}
      onGiveFeedback={handleGiveFeedback}
    />
  );
}
