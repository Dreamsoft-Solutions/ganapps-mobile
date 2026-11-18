import type { UseMutateAsyncFunction, UseQueryResult } from '@tanstack/react-query';
import { requestPushPermissionInContext } from '@/services/push-notification.service';
import type { FormBlock, JoinGanapResult } from '@/types/ganap.types';
import { getQueryFailure } from '@/utils/query-failure';
import { type SubmitFormAnswersVariables, useSubmitFormAnswersMutation } from './mutations/useGanapMutation';
import { useFormBlocksQuery } from './queries/useGanapsQuery';

/** State and actions needed by the registration-form route. */
export interface UseGanapRegistrationResult {
  blocks: FormBlock[] | undefined;
  isLoading: boolean;
  error: Error | null;
  /** The error to show in place of the content, or `null`; see `getQueryFailure`. */
  failure: Error | null;
  refetch: UseQueryResult<FormBlock[], Error>['refetch'];
  submit: UseMutateAsyncFunction<JoinGanapResult, Error, SubmitFormAnswersVariables>;
  isSubmitting: boolean;
  submitError: Error | null;
}

/**
 * Composes the focused registration form query and online submission mutation.
 *
 * A successful submission completes the registration, so it is also when iOS asks for notification permission.
 *
 * @param ganapId - Id of the Ganap whose registration form is being completed
 * @returns Registration form data, state, and actions
 */
export function useGanapRegistration(ganapId: string): UseGanapRegistrationResult {
  const blocksQuery: UseQueryResult<FormBlock[], Error> = useFormBlocksQuery(ganapId, 'REGISTRATION');
  const submitMutation = useSubmitFormAnswersMutation();
  const submit = async (variables: SubmitFormAnswersVariables): Promise<JoinGanapResult> => {
    const result = await submitMutation.mutateAsync(variables);
    void requestPushPermissionInContext();
    return result;
  };

  return {
    blocks: blocksQuery.data,
    isLoading: blocksQuery.isLoading,
    error: blocksQuery.error ?? null,
    failure: getQueryFailure(blocksQuery),
    refetch: blocksQuery.refetch,
    submit,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error ?? null,
  };
}
