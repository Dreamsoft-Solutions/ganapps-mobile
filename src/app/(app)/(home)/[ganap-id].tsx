import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { Alert, Share } from 'react-native';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { EventDetailView } from '@/components/ganaps/EventDetailView';
import { Routes } from '@/constants/routes';
import { useBusinessDetailQuery } from '@/hooks/queries/useBusinessesQuery';
import { useGanapDetailQuery } from '@/hooks/queries/useGanapsQuery';
import { useGanaps } from '@/hooks/useGanaps';
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
  const { 'ganap-id': ganapId } = useLocalSearchParams<{ 'ganap-id': string }>();
  const router = useRouter();
  const { data: ganap, isLoading, error, refetch } = useGanapDetailQuery(ganapId);
  const businessQuery = useBusinessDetailQuery(ganap?.businessId);
  const { join, leave, toggleLike, toggleSave, isJoining, isLeaving, isTogglingLike, isTogglingSave } = useGanaps();

  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={(): void => void refetch()} />;
  if (!ganap) return <ErrorView error={new Error('Event not found')} />;

  const schedule = getGanapScheduleModel(ganap.startDate, ganap.endDate);
  const capacity = getGanapCapacityModel(ganap);
  const actionModel = getGanapActionModel(ganap, new Date());

  const handleShare = async (): Promise<void> => {
    const message = buildGanapShareMessage(ganap, schedule);
    await Share.share({ message, title: ganap.title });
  };

  const handlePrimaryAction = async (): Promise<void> => {
    if (actionModel.action === 'complete-registration') {
      router.push(Routes.ganapRegistration(ganap.id));
      return;
    }

    if (actionModel.action === 'join') {
      const result = await join(ganap.id);
      if (result.requiresForm === true) {
        router.push(Routes.ganapRegistration(ganap.id));
      }
      return;
    }

    if (actionModel.action !== 'leave' || !actionModel.confirmation) return;

    const { confirmation } = actionModel;
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

  return (
    <EventDetailView
      ganap={ganap}
      business={businessQuery.data}
      capacity={capacity}
      schedule={schedule}
      actionModel={actionModel}
      isPrimaryPending={isJoining || isLeaving}
      isLikePending={isTogglingLike}
      isSavePending={isTogglingSave}
      onBack={(): void => router.back()}
      onShare={handleShare}
      onToggleLike={(): Promise<void> => toggleLike({ ganapId: ganap.id, isLiked: ganap.isLiked ?? false })}
      onToggleSave={(): Promise<void> => toggleSave({ ganapId: ganap.id, isSaved: ganap.isSaved ?? false })}
      onPrimaryAction={handlePrimaryAction}
    />
  );
}
