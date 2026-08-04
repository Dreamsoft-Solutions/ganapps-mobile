import type { UseMutateAsyncFunction, UseQueryResult } from '@tanstack/react-query';
import type { FormBlock, JoinGanapResult } from '@/types/ganap.types';
import { type SubmitFormAnswersVariables, useSubmitFormAnswersMutation } from './mutations/useGanapMutation';
import { useRegistrationFormBlocksQuery } from './queries/useGanapsQuery';

/** State and actions needed by the registration-form route. */
export interface UseGanapRegistrationResult {
  blocks: FormBlock[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: UseQueryResult<FormBlock[], Error>['refetch'];
  submit: UseMutateAsyncFunction<JoinGanapResult, Error, SubmitFormAnswersVariables>;
  isSubmitting: boolean;
  submitError: Error | null;
}

/**
 * Composes the focused registration form query and online submission mutation.
 *
 * @param ganapId - Id of the Ganap whose registration form is being completed
 * @returns Registration form data, state, and actions
 */
export function useGanapRegistration(ganapId: string): UseGanapRegistrationResult {
  const blocksQuery: UseQueryResult<FormBlock[], Error> = useRegistrationFormBlocksQuery(ganapId);
  const submitMutation = useSubmitFormAnswersMutation();

  return {
    blocks: blocksQuery.data,
    isLoading: blocksQuery.isLoading,
    error: blocksQuery.error ?? null,
    refetch: blocksQuery.refetch,
    submit: submitMutation.mutateAsync,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error ?? null,
  };
}
