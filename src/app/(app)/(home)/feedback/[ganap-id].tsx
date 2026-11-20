import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, View } from 'react-native';
import Animated, { FadeInRight, FadeOut, LayoutAnimationConfig } from 'react-native-reanimated';
import { Button } from '@/components/common/Button';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { DynamicForm } from '@/components/forms/DynamicForm';
import { RatingStep } from '@/components/ganaps/RatingStep';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Routes } from '@/constants/routes';
import { useGanapFeedback } from '@/hooks/useGanapFeedback';
import { showToast } from '@/store/toast.store';
import type { FeedbackIntent, SubmitFeedbackInput, SubmitFormAnswersInput } from '@/types/ganap.types';
import type { FeedbackErrorModel, FeedbackStep } from '@/utils/feedback';
import { isFormRequiredForRating, mapFeedbackError, toSubmitFeedbackInput } from '@/utils/feedback';
import { ratingSchema } from '@/utils/validation';

const STEP_SUCCESS_COPY = {
  form: 'Feedback form submitted',
  rating: 'Thanks for rating this event',
} as const satisfies Record<FeedbackStep, string>;

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
 * `ErrorView` renders no action without a retry callback, but the flow still
 * must not strand the student, which matters more here than elsewhere because
 * the route disables the iOS back gesture. Mirrors the registration route's
 * unavailable state.
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
 * Post-event feedback route: the organizer's feedback form and the star rating
 * for a Ganap the student attended, each saved as soon as it is submitted.
 *
 * Which steps appear is derived from server state by `getPendingFeedbackSteps`
 * and the `intent` search param, so reopening the route resumes where the
 * student left off. A submission writes its response into the cached detail, so
 * the next step shows without waiting for a refetch. Every exit goes through
 * `leave`, which runs once per visit, and a refetch never unmounts a form that
 * is already on screen, so entered answers survive a recoverable error.
 *
 * @returns The current step, or a loading/error state.
 */
export default function FeedbackRoute(): ReactElement {
  const { 'ganap-id': ganapId, intent: intentParam } = useLocalSearchParams<{ 'ganap-id': string; intent?: string }>();
  const intent: FeedbackIntent = intentParam === 'form' ? 'form' : 'rate';
  const router = useRouter();
  const feedback = useGanapFeedback(ganapId, intent);

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [stepError, setStepError] = useState<FeedbackErrorModel | null>(null);
  const hasLeft = useRef<boolean>(false);
  const exitToast = useRef<string | null>(null);
  const [initialStepCount, setInitialStepCount] = useState<number | null>(null);
  const { pendingSteps, refetch, submitFeedback } = feedback;
  const isSubmitting: boolean = feedback.isSubmitting;
  const hasData: boolean = feedback.ganap !== undefined && feedback.blocks !== undefined;

  if (initialStepCount === null && hasData) setInitialStepCount(pendingSteps.length);

  const currentStep: FeedbackStep | undefined = pendingSteps[0];

  /**
   * Leaves the feedback flow, once.
   *
   * Dismisses, then goes back, and falls back to the Event Hub when nothing
   * precedes this screen: an unguarded `back()` would then be a no-op and
   * strand the student on a spinner. A pending success toast is shown here so
   * the explicit exit after a submission and the auto-leave effect, which can
   * fire first once the cache write empties the plan, behave the same.
   */
  const leave = useCallback((): void => {
    if (hasLeft.current) return;
    hasLeft.current = true;

    if (exitToast.current !== null) showToast('success', exitToast.current);

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

  useEffect((): void => {
    if (feedback.isLoading || !hasData) return;
    if (currentStep === undefined) leave();
  }, [currentStep, feedback.isLoading, hasData, leave]);

  /**
   * Reacts to a rejected submission.
   *
   * Eligibility, an already-saved rating and a form the organizer now requires
   * all change server state, so those refetch it first. The rest stay inline on
   * the current step so the student can retry with their input intact.
   *
   * @param caught - The rejection from the feedback mutation
   */
  const recoverFromError = useCallback(
    async (caught: unknown): Promise<void> => {
      const model: FeedbackErrorModel = mapFeedbackError(toError(caught));

      switch (model.kind) {
        case 'not-eligible':
          setStepError(null);
          await refetch();
          leave();
          return;

        case 'rating-conflict':
        case 'answers-required':
          await refetch();
          setStepError(model);
          return;

        default:
          setStepError(model);
      }
    },
    [refetch, leave],
  );

  /**
   * Saves one step on its own.
   *
   * When the step is the last one in the plan, the success toast is queued
   * before the request so the exit that follows it carries the toast.
   *
   * @param step - The step being submitted
   * @param input - The request payload for that step
   */
  const submitStep = useCallback(
    async (step: FeedbackStep, input: SubmitFeedbackInput): Promise<void> => {
      setStepError(null);
      const isLastStep: boolean = pendingSteps[pendingSteps.length - 1] === step;
      exitToast.current = isLastStep ? STEP_SUCCESS_COPY[step] : null;

      try {
        await submitFeedback(input);
        if (isLastStep) leave();
      } catch (caught: unknown) {
        exitToast.current = null;
        await recoverFromError(caught);
      }
    },
    [pendingSteps, submitFeedback, leave, recoverFromError],
  );

  const handleSubmitRating = useCallback(
    async (score: number): Promise<void> => {
      const parsed = ratingSchema.safeParse({ score });
      if (!parsed.success) {
        setStepError({
          kind: 'unknown',
          title: 'Rating not sent',
          message: 'Choose a rating between 1 and 5 stars.',
        });
        return;
      }

      await submitStep('rating', toSubmitFeedbackInput({ rating: parsed.data.score }));
    },
    [submitStep],
  );

  const handleSubmitForm = useCallback(
    async (input: SubmitFormAnswersInput): Promise<void> => {
      await submitStep('form', toSubmitFeedbackInput({ formAnswers: input }));
    },
    [submitStep],
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

  const inlineError: Error | null = useMemo(
    (): Error | null => (stepError ? new Error(stepError.message) : null),
    [stepError],
  );

  if (feedback.isLoading || (feedback.failure && !hasData)) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Feedback" onBack={leave} backHint="Returns to the event" />
        {feedback.isLoading ? (
          <Loading />
        ) : (
          <ErrorView error={feedback.failure} onRetry={(): void => void feedback.refetch()} />
        )}
      </View>
    );
  }
  if (!feedback.ganap) return <FeedbackUnavailable message="This event is no longer available." onLeave={leave} />;
  if (currentStep === undefined) return <Loading />;

  const totalSteps: number = Math.max(initialStepCount ?? 0, pendingSteps.length);
  const stepNumber: number = totalSteps - pendingSteps.length + 1;
  const stepSubtitle: string =
    totalSteps >= 2 ? `Step ${stepNumber} of ${totalSteps}\n${feedback.ganap.title}` : feedback.ganap.title;

  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View
        key={currentStep}
        className="flex-1"
        entering={FadeInRight.duration(220)}
        exiting={FadeOut.duration(150)}
      >
        {currentStep === 'rating' ? (
          <RatingStep
            ganapTitle={stepSubtitle}
            isSubmitting={isSubmitting}
            submissionError={inlineError}
            onSubmit={handleSubmitRating}
            onSkip={leave}
            onBack={requestBack}
          />
        ) : (
          <DynamicForm
            title="Share your feedback"
            description={
              intent === 'rate' && isFormRequiredForRating(feedback.ganap, feedback.blocks ?? [])
                ? 'The organizer asks for this before you rate.'
                : 'The organization would like to hear how the event went.'
            }
            submitLabel="Submit feedback"
            ganapTitle={stepSubtitle}
            blocks={feedback.blocks ?? []}
            isSubmitting={isSubmitting}
            submissionError={inlineError}
            onBack={requestBack}
            onDirtyChange={setIsDirty}
            onSubmit={handleSubmitForm}
          />
        )}
      </Animated.View>
    </LayoutAnimationConfig>
  );
}
