import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { walkAPI } from '@/api/endpoints/walk';
import type { WalkInteractionInput } from '@/types/walk.types';
import { isClientError } from '@/utils/query-failure';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';

/**
 * Records that the User opened or skipped a walk card.
 *
 * Fire and forget: a signal about taste is not worth a toast, so the global error toast
 * stays out, and it is not queued for replay while offline, unlike a like or save. It
 * retries once, and only when the failure was not the server's answer: a 4xx would fail again.
 *
 * @param onRejected - Called with the error when the request fails for good, so the walk can close on a 403
 * @returns The mutation, taking the Ganap, the interaction and the walk's token
 */
export function useWalkInteractionMutation(
  onRejected?: (error: Error) => void,
): UseMutationResult<void, Error, WalkInteractionInput> {
  return useMutation<void, Error, WalkInteractionInput>({
    mutationFn: (input: WalkInteractionInput): Promise<void> => walkAPI.interact(input),
    retry: (failureCount: number, error: Error): boolean => failureCount < 1 && !isClientError(error),
    onError: (error: Error): void => onRejected?.(error),
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}
