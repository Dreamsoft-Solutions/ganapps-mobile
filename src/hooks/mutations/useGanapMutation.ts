import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { enqueueOutbox } from '@/services/sync.service';
import type { CheckInResult, JoinGanapResult, SubmitFormAnswersInput } from '@/types/ganap.types';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';
import { ganapQueryKeys } from '../queries/useGanapsQuery';
import { profileQueryKeys } from '../queries/useProfileQuery';

/** Arguments for the like toggle: the Ganap and whether it is already liked. */
export interface ToggleLikeVariables {
  ganapId: string;
  isLiked: boolean;
}

/** Arguments for the save toggle: the Ganap and whether it is already saved. */
export interface ToggleSaveVariables {
  ganapId: string;
  isSaved: boolean;
}

/** Arguments for submitting a Ganap registration form. */
export interface SubmitFormAnswersVariables {
  ganapId: string;
  input: SubmitFormAnswersInput;
}

/**
 * Decides whether a failed toggle should be queued for replay.
 *
 * `parseApiError` sets `status` from the server's response, so its absence means
 * the request never arrived — no signal, DNS failure, timeout — which is exactly
 * what the outbox exists for. A rejection that carries a status is a real answer
 * from the server (403 when not registered, for one) and must surface as an
 * error rather than be queued for a replay the server will refuse again.
 *
 * @param error - The error the mutation rejected with
 * @returns True when the request never reached the server
 */
function shouldQueueForReplay(error: Error): boolean {
  return (error as { status?: number }).status === undefined;
}

/**
 * Registers the current user for a Ganap.
 *
 * Not optimistic: the server decides between REGISTERED, WAITLISTED and PENDING,
 * so the UI must wait for the real status rather than assume success.
 *
 * @returns The mutation, resolving to the created registration
 */
export function useJoinGanapMutation(): UseMutationResult<JoinGanapResult, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<JoinGanapResult, Error, string>({
    mutationFn: (ganapId: string): Promise<JoinGanapResult> => ganapsAPI.join(ganapId),
    onSuccess: (_result: JoinGanapResult, ganapId: string): void => {
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
    },
  });
}

/**
 * Cancels the current user's registration for a Ganap.
 *
 * @returns The mutation, resolving to nothing
 */
export function useLeaveGanapMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (ganapId: string): Promise<void> => ganapsAPI.leave(ganapId),
    onSuccess: (_result: unknown, ganapId: string): void => {
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
    },
  });
}

/**
 * Submits registration-form answers online and refreshes related Ganap caches.
 *
 * @returns The mutation, resolving to the server-decided registration
 */
export function useSubmitFormAnswersMutation(): UseMutationResult<JoinGanapResult, Error, SubmitFormAnswersVariables> {
  const queryClient = useQueryClient();

  return useMutation<JoinGanapResult, Error, SubmitFormAnswersVariables>({
    mutationFn: ({ ganapId, input }: SubmitFormAnswersVariables): Promise<JoinGanapResult> =>
      ganapsAPI.submitFormAnswers(ganapId, input),
    onSuccess: (_result: JoinGanapResult, { ganapId }: SubmitFormAnswersVariables): void => {
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
    },
  });
}

/**
 * Toggles the current user's like on a Ganap.
 *
 * @returns The mutation, taking the Ganap id and its current liked state
 */
export function useLikeGanapMutation(): UseMutationResult<void, Error, ToggleLikeVariables> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ToggleLikeVariables>({
    mutationFn: ({ ganapId, isLiked }: ToggleLikeVariables): Promise<void> =>
      isLiked ? ganapsAPI.unlike(ganapId) : ganapsAPI.like(ganapId),
    onSuccess: (_result: unknown, { ganapId }: ToggleLikeVariables): void => {
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
    },
    onError: (error: Error, { ganapId, isLiked }: ToggleLikeVariables): void => {
      if (shouldQueueForReplay(error)) {
        void enqueueOutbox('ganap', isLiked ? 'unlike' : 'like', { ganapId });
      }
    },
  });
}

/**
 * Toggles the current user's save on a Ganap.
 *
 * @returns The mutation, taking the Ganap id and its current saved state
 */
export function useSaveGanapMutation(): UseMutationResult<void, Error, ToggleSaveVariables> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ToggleSaveVariables>({
    mutationFn: ({ ganapId, isSaved }: ToggleSaveVariables): Promise<void> =>
      isSaved ? ganapsAPI.unsave(ganapId) : ganapsAPI.save(ganapId),
    onSuccess: (_result: unknown, { ganapId }: ToggleSaveVariables): void => {
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
    },
    onError: (error: Error, { ganapId, isSaved }: ToggleSaveVariables): void => {
      if (shouldQueueForReplay(error)) {
        void enqueueOutbox('ganap', isSaved ? 'unsave' : 'save', { ganapId });
      }
    },
  });
}

/** Arguments for recording attendance from a scanned QR. */
export interface CheckInVariables {
  ganapId: string;
  qrHash: string;
  scannedAt: string;
}

/**
 * How an attendance scan settled: recorded by the server now, or queued on
 * this device for replay when connectivity returns.
 */
export type CheckInOutcome = { kind: 'recorded'; result: CheckInResult } | { kind: 'queued' };

/**
 * Records attendance from a scanned organizer QR, queueing offline scans.
 *
 * A rejection without a `status` never reached the server, so the scan is
 * queued through the outbox with its original `scannedAt` and the mutation
 * resolves as `queued` — the caller renders honest pending copy, not success.
 * A rejection carrying a `status` is a real server answer: it rejects and is
 * never queued. The global error toast is suppressed; the scanner screen owns
 * its own error rendering.
 *
 * @returns The mutation, resolving to the scan outcome
 */
export function useCheckInMutation(): UseMutationResult<CheckInOutcome, Error, CheckInVariables> {
  const queryClient = useQueryClient();

  return useMutation<CheckInOutcome, Error, CheckInVariables>({
    mutationFn: async ({ ganapId, qrHash, scannedAt }: CheckInVariables): Promise<CheckInOutcome> => {
      try {
        const result = await ganapsAPI.checkIn(ganapId, { qrHash, scannedAt });
        return { kind: 'recorded', result };
      } catch (error) {
        if (error instanceof Error && shouldQueueForReplay(error)) {
          await enqueueOutbox('ganap', 'check-in', { ganapId, qrHash, scannedAt });
          return { kind: 'queued' };
        }
        throw error;
      }
    },
    onSuccess: (outcome: CheckInOutcome, { ganapId }: CheckInVariables): void => {
      if (outcome.kind !== 'recorded') return;
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}
