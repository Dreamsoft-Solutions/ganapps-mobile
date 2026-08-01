import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { useGanapDetailQuery } from '@/hooks/queries/useGanapsQuery';
import { useGanaps } from '@/hooks/useGanaps';
import type { RegistrationStatus } from '@/types/ganap.types';

/**
 * The label for the join control given the student's current registration.
 *
 * @param status - Registration status, or null when not registered
 * @returns The button label
 */
function joinLabel(status: RegistrationStatus | null): string {
  switch (status) {
    case 'REGISTERED':
      return 'Leave event';
    case 'PENDING':
      return 'Awaiting approval';
    case 'WAITLISTED':
      return 'On the waitlist';
    case 'ATTENDED':
      return 'You attended';
    default:
      return 'Join event';
  }
}

export default function GanapDetailScreen(): ReactElement {
  const { 'ganap-id': ganapId } = useLocalSearchParams<{ 'ganap-id': string }>();
  const { data: ganap, isLoading, error, refetch } = useGanapDetailQuery(ganapId);
  const { join, leave, toggleLike, toggleSave, isJoining, isLeaving } = useGanaps();

  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={(): void => void refetch()} />;
  if (!ganap) return <ErrorView error={new Error('Event not found')} />;

  const status = ganap.myRegistration?.status ?? null;
  const isRegistered = status === 'REGISTERED';

  // Only two states are actionable: not registered (can join) and registered
  // (can leave). PENDING, WAITLISTED and ATTENDED are all waiting on someone
  // else, so the control reads as a status rather than an action.
  const canAct = status === null || isRegistered;

  return (
    <ScrollView className="flex-1 bg-lynx-background p-md">
      <Text className="text-headline-lg">{ganap.title}</Text>
      <Text className="text-lynx-on-surface-variant text-label-md mt-1">{ganap.businessName}</Text>
      <Text className="text-lynx-on-surface-variant text-body-md mt-sm">
        {new Date(ganap.startDate).toLocaleString()}
      </Text>
      {ganap.address && <Text className="text-lynx-on-surface-variant text-body-md mt-1">{ganap.address}</Text>}
      <Text className="text-body-lg mt-md">{ganap.description}</Text>

      <View className="mt-lg gap-sm">
        <Button
          onPress={async (): Promise<void> => {
            // Discard join's returned registration rather than returning it —
            // Button's onPress is typed `void | Promise<void>`, and the query
            // invalidation in the mutation is what refreshes this screen.
            if (isRegistered) {
              await leave(ganapId);
            } else {
              await join(ganapId);
            }
          }}
          disabled={!canAct}
          loading={isJoining || isLeaving}
          variant={isRegistered ? 'secondary' : 'default'}
        >
          {joinLabel(status)}
        </Button>

        {/* Both toggles stay disabled until the student has joined: the server
            returns 403 "Must be registered" otherwise. Tracked as DS-22. */}
        <Button
          variant="ghost"
          disabled={!isRegistered}
          onPress={(): Promise<void> => toggleLike({ ganapId, isLiked: ganap.isLiked ?? false })}
        >
          {ganap.isLiked ? 'Liked' : 'Like'}
        </Button>

        <Button
          variant="ghost"
          disabled={!isRegistered}
          onPress={(): Promise<void> => toggleSave({ ganapId, isSaved: ganap.isSaved ?? false })}
        >
          {ganap.isSaved ? 'Saved' : 'Save'}
        </Button>
      </View>
    </ScrollView>
  );
}
