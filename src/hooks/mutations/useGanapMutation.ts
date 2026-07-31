import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import { enqueueOutbox } from '@/services/sync.service';
import type { JoinGanapResult } from '@/types/ganap.types';
import { ganapQueryKeys } from '../queries/useGanapsQuery';

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
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.list() });
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
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.list() });
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
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.list() });
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
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.list() });
    },
    onError: (error: Error, { ganapId, isSaved }: ToggleSaveVariables): void => {
      if (shouldQueueForReplay(error)) {
        void enqueueOutbox('ganap', isSaved ? 'unsave' : 'save', { ganapId });
      }
    },
  });
}
