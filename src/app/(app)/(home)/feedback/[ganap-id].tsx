import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, View } from 'react-native';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { RatingStep } from '@/components/ganaps/RatingStep';
import { Routes } from '@/constants/routes';
import { useGanapFeedback } from '@/hooks/useGanapFeedback';
import type { SubmitFormAnswersInput } from '@/types/ganap.types';
import type { FeedbackErrorModel, FeedbackStep } from '@/utils/feedback';
import { mapFeedbackError } from '@/utils/feedback';
import { ratingSchema } from '@/utils/validation';

/**
 * Narrows a caught value to an `Error`.
 *
 * The error interceptor rejects with real `Error` instances carrying the
 * server's message, but `catch` still types its binding as `unknown`.
 *
 * @param value - The caught value
 * @returns The value when it is already an Error, otherwise a generic one
 */
function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Unknown error');
}

/** Props for the terminal state shown when feedback cannot be collected. */
interface FeedbackUnavailableProps {
  message: string;
  onLeave: () => void;
}

/**
 * Terminal state for a Ganap whose feedback can never be submitted.
 *
 * `ErrorView` renders no action without a retry callback, and retrying a
 * `not-found` is meaningless — but the flow still must not strand the student,
 * which matters more here than elsewhere because the route disables the iOS
 * back gesture. Mirrors the registration route's unavailable state.
 *
 * @param props - The mapped explanation and the leave callback
 * @returns A centered explanation with a way back to the event
 */
function FeedbackUnavailable({ message, onLeave }: FeedbackUnavailableProps): ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-background p-xl">
      <Text className="mb-sm text-center text-headline-sm">Feedback unavailable</Text>
      <Text className="mb-lg text-center text-body-md text-muted-foreground">{message}</Text>
      <Button variant="outline" onPress={onLeave}>
        Back to event
      </Button>
    </View>
  );
}

/**
 * Post-event feedback route: the star rating, then the organizer's optional
 * feedback form, for a Ganap the student attended.
 *
 * Which steps appear is derived by `getPendingFeedbackSteps` from server state;
 * the local `ratingDone` / `formDone` flags advance the flow within a session,
 * because the server fields backing that derivation may be absent and the
 * pending list will therefore not shrink on its own.
 *
 * @returns The current step, or a loading/error state.
 */
export default function FeedbackRoute(): ReactElement {
  const { 'ganap-id': ganapId } = useLocalSearchParams<{ 'ganap-id': string }>();
  const router = useRouter();
  const feedback = useGanapFeedback(ganapId);

  const [ratingDone, setRatingDone] = useState<boolean>(false);
  const [formDone, setFormDone] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [stepError, setStepError] = useState<FeedbackErrorModel | null>(null);

  const isSubmitting: boolean = feedback.isRating || feedback.isSubmittingForm;

  const currentStep: FeedbackStep | undefined = feedback.pendingSteps.find((step: FeedbackStep): boolean =>
    step === 'rating' ? !ratingDone : !formDone,
  );

  const isFatal: boolean = stepError?.kind === 'not-found';

  /**
   * Leaves the feedback flow.
   *
   * Mirrors the scanner route's dismiss-then-back guard, with one addition: an
   * unguarded `back()` is a no-op when nothing precedes this screen in the
   * stack, which would leave the student watching a spinner forever. The Event
   * Hub is where feedback belongs, so it is the fallback.
   */
  const leave = useCallback((): void => {
    if (router.canDismiss()) {
      router.dismiss();
      return;
    }

    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(Routes.eventHub(ganapId));
  }, [ganapId, router]);

  // Leaving is an effect, not a render-time call: navigating during render is
  // unsafe, and this fires both when the student finishes and when there was
  // never anything pending — so neither path can dead-end on a blank screen.
  useEffect((): void => {
    if (feedback.isLoading || feedback.error || !feedback.ganap) return;
    if (currentStep === undefined && !isFatal) leave();
  }, [currentStep, feedback.error, feedback.ganap, feedback.isLoading, isFatal, leave]);

  const recoverFromError = useCallback(
    async (caught: unknown): Promise<void> => {
      const model: FeedbackErrorModel = mapFeedbackError(toError(caught));

      switch (model.kind) {
        // The student already rated. Not a failure — complete the step silently
        // and let the flow continue to the form.
        case 'already-rated':
          setStepError(null);
          setRatingDone(true);
          return;

        // The organizer removed the blocks after we read them. Nothing left to
        // answer, so the step is complete.
        case 'no-form':
          setStepError(null);
          setFormDone(true);
          return;

        // Our view of the registration is stale. Refresh and let the student out.
        case 'not-attended':
          setStepError(null);
          await feedback.refetch();
          leave();
          return;

        // The form changed under us. Refresh the blocks and keep the student here
        // so they can answer the current questions.
        case 'stale-blocks':
          await feedback.refetch();
          setStepError(model);
          return;

        // Fatal: rendered as the terminal FeedbackUnavailable state, not inline.
        case 'not-found':
          setStepError(model);
          return;

        default:
          setStepError(model);
      }
    },
    [feedback, leave],
  );

  const handleSubmitRating = useCallback(
    async (score: number): Promise<void> => {
      setStepError(null);

      // The five buttons cannot produce an out-of-range score today, but the
      // value crosses from component state into an API payload here, so it is
      // validated at the boundary rather than trusted.
      const parsed = ratingSchema.safeParse({ score });
      if (!parsed.success) {
        setStepError({
          kind: 'unknown',
          title: 'Rating not sent',
          message: 'Choose a rating between 1 and 5 stars.',
        });
        return;
      }

      try {
        await feedback.submitRating({ ganapId, input: parsed.data });
        setRatingDone(true);
      } catch (caught: unknown) {
        await recoverFromError(caught);
      }
    },
    [feedback.submitRating, ganapId, recoverFromError],
  );

  const handleSkipRating = useCallback((): void => {
    setStepError(null);
    setRatingDone(true);
  }, []);

  const handleSubmitForm = useCallback(
    async (input: SubmitFormAnswersInput): Promise<void> => {
      setStepError(null);
      try {
        // The scope must be added here — `buildSubmitFormAnswersInput` does not
        // set it, and without it the server validates against the REGISTRATION
        // blocks and rejects the submission.
        await feedback.submitForm({ ganapId, input: { ...input, scope: 'POST_ATTENDANCE' } });
        setFormDone(true);
      } catch (caught: unknown) {
        await recoverFromError(caught);
      }
    },
    [feedback.submitForm, ganapId, recoverFromError],
  );

  const requestBack = useCallback((): void => {
    if (isSubmitting) return;

    if (currentStep !== 'form' || !isDirty) {
      leave();
      return;
    }

    Alert.alert('Discard your answers?', 'Your answers will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: (): void => leave() },
    ]);
  }, [currentStep, isDirty, isSubmitting, leave]);

  useFocusEffect(
    useCallback((): (() => void) => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', (): boolean => {
        requestBack();
        return true;
      });

      return (): void => subscription.remove();
    }, [requestBack]),
  );

  // Both step components take an `Error`; the mapped copy is what the student
  // reads, so the model's message becomes the error's message.
  const inlineError: Error | null = useMemo(
    (): Error | null => (stepError && !isFatal ? new Error(stepError.message) : null),
    [isFatal, stepError],
  );

  if (feedback.isLoading) return <Loading />;
  if (feedback.error) return <ErrorView error={feedback.error} onRetry={(): void => void feedback.refetch()} />;
  if (!feedback.ganap) return <FeedbackUnavailable message="This event is no longer available." onLeave={leave} />;
  if (isFatal && stepError) return <FeedbackUnavailable message={stepError.message} onLeave={leave} />;

  if (currentStep === 'rating') {
    return (
      <RatingStep
        ganapTitle={feedback.ganap.title}
        isSubmitting={feedback.isRating}
        submissionError={inlineError}
        onSubmit={handleSubmitRating}
        onSkip={handleSkipRating}
        onBack={requestBack}
      />
    );
  }

  if (currentStep === 'form') {
    return (
      <DynamicForm
        title="Share your feedback"
        description="The organization would like to hear how the event went."
        submitLabel="Submit feedback"
        ganapTitle={feedback.ganap.title}
        blocks={feedback.blocks ?? []}
        isSubmitting={feedback.isSubmittingForm}
        submissionError={inlineError}
        onBack={requestBack}
        onDirtyChange={setIsDirty}
        onSubmit={handleSubmitForm}
      />
    );
  }

  // Nothing pending: the effect above is navigating away this tick.
  return <Loading />;
}
