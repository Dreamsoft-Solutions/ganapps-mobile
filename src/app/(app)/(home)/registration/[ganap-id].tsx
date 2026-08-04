import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { Alert, BackHandler, View } from 'react-native';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { RegistrationForm } from '@/components/forms/RegistrationForm';
import { ganapQueryKeys, useGanapDetailQuery } from '@/hooks/queries/useGanapsQuery';
import { useGanapRegistration } from '@/hooks/useGanapRegistration';
import type { GanapDetail, SubmitFormAnswersInput } from '@/types/ganap.types';

/**
 * Registration form route for a single Ganap.
 *
 * @returns Loading, error, empty, or the dynamic registration form state.
 */
export default function RegistrationFormRoute(): ReactElement {
  const { 'ganap-id': ganapId } = useLocalSearchParams<{ 'ganap-id': string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const detailQuery = useGanapDetailQuery(ganapId);
  const registration = useGanapRegistration(ganapId);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isFinalizing, setIsFinalizing] = useState<boolean>(false);
  const isSubmitting: boolean = registration.isSubmitting || isFinalizing;

  const requestBack = useCallback((): void => {
    if (isSubmitting) return;

    if (!isDirty) {
      router.back();
      return;
    }

    Alert.alert('Discard your answers?', 'Your answers will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: (): void => router.back() },
    ]);
  }, [isDirty, isSubmitting, router]);

  useFocusEffect(
    useCallback((): (() => void) => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', (): boolean => {
        requestBack();
        return true;
      });

      return (): void => subscription.remove();
    }, [requestBack]),
  );

  const handleSubmit = useCallback(
    async (input: SubmitFormAnswersInput): Promise<void> => {
      try {
        await registration.submit({ ganapId, input });
      } catch (_error) {
        // The mutation exposes the normalized error and keeps the form values in place for retry.
        return;
      }

      setIsFinalizing(true);
      try {
        await queryClient.fetchQuery({
          queryKey: ganapQueryKeys.detail(ganapId),
          queryFn: (): Promise<GanapDetail> => ganapsAPI.getById(ganapId),
        });
        router.back();
      } catch (_error) {
        Alert.alert(
          'Registration submitted',
          'Your answers were submitted, but the event details could not be refreshed. Please try again.',
          [{ text: 'OK', onPress: (): void => router.back() }],
        );
      }
    },
    [ganapId, queryClient, registration.submit, router],
  );

  if (detailQuery.isLoading || registration.isLoading) return <Loading />;
  if (detailQuery.error)
    return <ErrorView error={detailQuery.error} onRetry={(): void => void detailQuery.refetch()} />;
  if (registration.error)
    return <ErrorView error={registration.error} onRetry={(): void => void registration.refetch()} />;
  if (!detailQuery.data) return <ErrorView error={new Error('Event not found')} />;

  if (!registration.blocks || registration.blocks.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-xl">
        <Text className="mb-sm text-center text-headline-sm">Registration form unavailable</Text>
        <Text className="mb-lg text-center text-body-md text-muted-foreground">
          This event is not ready to accept registration answers yet.
        </Text>
        <Button variant="outline" onPress={(): void => void registration.refetch()}>
          Try Again
        </Button>
        <Button variant="ghost" onPress={requestBack}>
          Back to event
        </Button>
      </View>
    );
  }

  return (
    <RegistrationForm
      ganapTitle={detailQuery.data.title}
      blocks={registration.blocks}
      isSubmitting={isSubmitting}
      submissionError={registration.submitError}
      onBack={requestBack}
      onDirtyChange={setIsDirty}
      onSubmit={handleSubmit}
    />
  );
}
