import type { UseMutateAsyncFunction, UseQueryResult } from '@tanstack/react-query';
import type { FormBlock, GanapDetail, GanapRating, JoinGanapResult } from '@/types/ganap.types';
import type { FeedbackStep } from '@/utils/feedback';
import { getPendingFeedbackSteps } from '@/utils/feedback';
import {
  type RateGanapVariables,
  type SubmitFormAnswersVariables,
  useRateGanapMutation,
  useSubmitFormAnswersMutation,
} from './mutations/useGanapMutation';
import { useFormBlocksQuery, useGanapDetailQuery } from './queries/useGanapsQuery';

/** State and actions needed by the post-event feedback route. */
export interface UseGanapFeedbackResult {
  ganap: GanapDetail | undefined;
  blocks: FormBlock[] | undefined;
  /** Outstanding steps in presentation order; empty once nothing is pending. */
  pendingSteps: FeedbackStep[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  submitRating: UseMutateAsyncFunction<GanapRating, Error, RateGanapVariables>;
  isRating: boolean;
  ratingError: Error | null;
  submitForm: UseMutateAsyncFunction<JoinGanapResult, Error, SubmitFormAnswersVariables>;
  isSubmittingForm: boolean;
  formError: Error | null;
}

/**
 * Composes the Ganap detail, its post-attendance blocks, and both feedback
 * submissions into the single value the feedback route needs.
 *
 * Both queries are shared by key with the rest of the app, so opening this
 * route does not refetch detail the Event Hub already loaded.
 *
 * @param ganapId - Id of the Ganap being reviewed
 * @returns Feedback data, derived pending steps, state, and actions
 */
export function useGanapFeedback(ganapId: string): UseGanapFeedbackResult {
  const detailQuery: UseQueryResult<GanapDetail, Error> = useGanapDetailQuery(ganapId);
  const blocksQuery: UseQueryResult<FormBlock[], Error> = useFormBlocksQuery(ganapId, 'POST_ATTENDANCE');
  const ratingMutation = useRateGanapMutation();
  const formMutation = useSubmitFormAnswersMutation();

  const pendingSteps: FeedbackStep[] =
    detailQuery.data && blocksQuery.data ? getPendingFeedbackSteps(detailQuery.data, blocksQuery.data) : [];

  return {
    ganap: detailQuery.data,
    blocks: blocksQuery.data,
    pendingSteps,
    isLoading: detailQuery.isLoading || blocksQuery.isLoading,
    error: detailQuery.error ?? blocksQuery.error ?? null,
    refetch: async (): Promise<unknown> => Promise.all([detailQuery.refetch(), blocksQuery.refetch()]),
    submitRating: ratingMutation.mutateAsync,
    isRating: ratingMutation.isPending,
    ratingError: ratingMutation.error ?? null,
    submitForm: formMutation.mutateAsync,
    isSubmittingForm: formMutation.isPending,
    formError: formMutation.error ?? null,
  };
}
