import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback } from 'react';
import { Alert, BackHandler, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { EventDetailView } from '@/components/ganaps/EventDetailView';
import { Routes } from '@/constants/routes';
import { Spacing } from '@/constants/theme';
import { useBusinessDetailQuery } from '@/hooks/queries/useBusinessesQuery';
import { useFriendGoingQuery } from '@/hooks/queries/useFriendsQuery';
import { useGanapDetailQuery } from '@/hooks/queries/useGanapsQuery';
import { useGanaps } from '@/hooks/useGanaps';
import type { FriendGoingRecord, FriendUserSummary } from '@/types/friends.types';
import type { GanapAction, GanapActionConfirmation } from '@/utils/ganap-detail';
import {
  buildGanapShareMessage,
  getGanapActionModel,
  getGanapCapacityModel,
  getGanapScheduleModel,
} from '@/utils/ganap-detail';

/**
 * Loaded Ganap Details route that owns data fetching, navigation, and mutations.
 *
 * @returns The loading, error, not-found, or loaded Ganap Details state.
 */
export default function GanapDetailScreen(): ReactElement {
  const { 'ganap-id': ganapId, returnTo } = useLocalSearchParams<{ 'ganap-id': string; returnTo?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isMyEventsOrigin: boolean = returnTo === 'my-events';
  const { data: ganap, isLoading, isRefetching, error, refetch } = useGanapDetailQuery(ganapId);
  const businessQuery = useBusinessDetailQuery(ganap?.businessId);
  const friendsGoingQuery = useFriendGoingQuery(true, ganapId);
  const { join, leave, toggleLike, toggleSave, isJoining, isLeaving, isTogglingLike, isTogglingSave } = useGanaps();
  const screenOptions: ReactElement = <Stack.Screen options={{ gestureEnabled: !isMyEventsOrigin }} />;

  const handleBack = useCallback((): void => {
    if (isMyEventsOrigin) {
      if (router.canDismiss()) router.dismiss();
      router.replace(Routes.app.ganaps);
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(Routes.app.home);
  }, [isMyEventsOrigin, router]);

  const myEventsBackControl: ReactElement | null = isMyEventsOrigin ? (
    <View className="px-md" style={{ paddingTop: insets.top + Spacing.sm }}>
      <Button variant="outline" onPress={handleBack} accessibilityHint="Returns to My Events">
        Back to My Events
      </Button>
    </View>
  ) : null;

  const renderFallbackState = (content: ReactElement): ReactElement => (
    <>
      {screenOptions}
      {isMyEventsOrigin ? (
        <View className="flex-1 bg-background">
          {myEventsBackControl}
          {content}
        </View>
      ) : (
        content
      )}
    </>
  );

  useFocusEffect(
    useCallback((): (() => void) => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', (): boolean => {
        if (!isMyEventsOrigin && router.canGoBack()) return false;
        handleBack();
        return true;
      });

      return (): void => subscription.remove();
    }, [handleBack, isMyEventsOrigin, router]),
  );

  if (isLoading) {
    return renderFallbackState(<Loading />);
  }

  if (error) {
    return renderFallbackState(<ErrorView error={error} onRetry={(): void => void refetch()} />);
  }

  if (!ganap) {
    return renderFallbackState(<ErrorView error={new Error('Event not found')} />);
  }

  const schedule = getGanapScheduleModel(ganap.startDate, ganap.endDate);
  const capacity = getGanapCapacityModel(ganap);
  const actionModel = getGanapActionModel(ganap, new Date());
  const friendsGoing: FriendUserSummary[] = friendsGoingQuery.going
    .filter((record: FriendGoingRecord): boolean => record.ganap.ganapId === ganap.id)
    .map((record: FriendGoingRecord): FriendUserSummary => record.user);

  const handleShare = async (): Promise<void> => {
    const message = buildGanapShareMessage(ganap, schedule);
    await Share.share({ message, title: ganap.title });
  };

  const dispatchAction = async (action: GanapAction, confirmation: GanapActionConfirmation | null): Promise<void> => {
    if (action === 'enter-hub') {
      router.push(Routes.eventHub(ganap.id));
      return;
    }

    if (action === 'complete-registration') {
      router.push(Routes.ganapRegistration(ganap.id));
      return;
    }

    if (action === 'join') {
      const result = await join(ganap.id);
      if (result.requiresForm === true) {
        router.push(Routes.ganapRegistration(ganap.id));
      }
      return;
    }

    if (action !== 'leave' || !confirmation) return;

    Alert.alert(confirmation.title, confirmation.message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: confirmation.confirmLabel,
        style: 'destructive',
        onPress: (): void => {
          void leave(ganap.id);
        },
      },
    ]);
  };

  const handlePrimaryAction = (): Promise<void> =>
    dispatchAction(actionModel.primary?.action ?? null, actionModel.primary?.confirmation ?? null);

  const handleSecondaryAction = (): Promise<void> =>
    dispatchAction(actionModel.secondary?.action ?? null, actionModel.secondary?.confirmation ?? null);

  return (
    <>
      {screenOptions}
      <EventDetailView
        ganap={ganap}
        business={businessQuery.data}
        capacity={capacity}
        schedule={schedule}
        actionModel={actionModel}
        isPrimaryPending={isJoining || isLeaving}
        isLikePending={isTogglingLike}
        isSavePending={isTogglingSave}
        friendsGoing={friendsGoing}
        isFriendsGoingLoading={friendsGoingQuery.isLoading}
        friendsGoingError={friendsGoingQuery.error}
        hasMoreFriendsGoing={Boolean(friendsGoingQuery.hasNextPage)}
        isRefreshing={isRefetching || friendsGoingQuery.isRefetching}
        onBack={handleBack}
        onRefresh={async (): Promise<void> => {
          await Promise.all([refetch(), friendsGoingQuery.refetch()]);
        }}
        onShare={handleShare}
        onToggleLike={(): Promise<void> => toggleLike({ ganapId: ganap.id, isLiked: ganap.isLiked ?? false })}
        onToggleSave={(): Promise<void> => toggleSave({ ganapId: ganap.id, isSaved: ganap.isSaved ?? false })}
        onPrimaryAction={handlePrimaryAction}
        onSecondaryAction={handleSecondaryAction}
      />
    </>
  );
}
