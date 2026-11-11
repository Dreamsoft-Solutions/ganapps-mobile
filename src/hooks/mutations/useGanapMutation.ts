import { type InfiniteData, type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { PaginatedResponse } from '@/api/types/api-response';
import { enqueueOutbox } from '@/services/sync.service';
import type {
  CheckInResult,
  GanapRating,
  GanapReportReceipt,
  JoinGanapResult,
  RateGanapInput,
  ReportGanapInput,
  SubmitFeedbackInput,
  SubmitFeedbackResponse,
  SubmitFormAnswersInput,
} from '@/types/ganap.types';
import type { SavedGanap } from '@/types/profile.types';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META, showErrorToast } from '@/utils/toast-message';
import { ganapQueryKeys } from '../queries/useGanapsQuery';
import { profileQueryKeys } from '../queries/useProfileQuery';

/** Arguments for the like toggle: the Ganap and whether it is already liked. */
export interface ToggleLikeVariables {
  ganapId: string;
  isLiked: boolean;
  ownerId: string;
}

/** Arguments for the save toggle: the Ganap and whether it is already saved. */
export interface ToggleSaveVariables {
  ganapId: string;
  isSaved: boolean;
  ownerId: string;
}

/** Arguments for submitting a Ganap registration form. */
export interface SubmitFormAnswersVariables {
  ganapId: string;
  input: SubmitFormAnswersInput;
}

/** Arguments for submitting a Ganap's combined rating and feedback answers. */
export interface SubmitFeedbackVariables {
  ganapId: string;
  input: SubmitFeedbackInput;
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
    // Both callers render the failure inline against the form the student is
    // still looking at — the registration route via `submissionError`, and the
    // feedback route via its mapped step error — so a global toast duplicates it.
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/**
 * Submits the student's rating and post-attendance answers atomically.
 *
 * @returns The mutation, resolving to the submitted feedback state
 */
export function useSubmitFeedbackMutation(): UseMutationResult<SubmitFeedbackResponse, Error, SubmitFeedbackVariables> {
  const queryClient = useQueryClient();

  return useMutation<SubmitFeedbackResponse, Error, SubmitFeedbackVariables>({
    mutationFn: ({ ganapId, input }: SubmitFeedbackVariables): Promise<SubmitFeedbackResponse> =>
      ganapsAPI.submitFeedback(ganapId, input),
    onSuccess: (_result: SubmitFeedbackResponse, { ganapId }: SubmitFeedbackVariables): void => {
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
    },
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
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
    mutationFn: ({ ganapId, isLiked, ownerId }: ToggleLikeVariables): Promise<void> =>
      isLiked ? ganapsAPI.unlike(ganapId, ownerId) : ganapsAPI.like(ganapId, ownerId),
    onSuccess: (_result: unknown, { ganapId }: ToggleLikeVariables): void => {
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
    },
    onError: async (error: Error, { ganapId, isLiked, ownerId }: ToggleLikeVariables): Promise<void> => {
      if (shouldQueueForReplay(error)) {
        const queued = await enqueueOutbox({ action: isLiked ? 'unlike' : 'like', ganapId, ownerId }).catch(
          () => false,
        );
        if (queued) return;
      }
      showErrorToast(error);
    },
    /** A queued like is not a failure, so this mutation toasts only the errors it could not queue. */
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

type SavedGanapPage = PaginatedResponse<SavedGanap>;
type SavedGanapsData = InfiniteData<SavedGanapPage, number>;

/** Saved-list cache entries captured before an optimistic unsave. */
export interface SaveMutationContext {
  previousSaved: Array<[readonly unknown[], SavedGanapsData | undefined]>;
}

/**
 * Drops one Ganap from every page of a cached saved-Ganap list.
 *
 * @param data - The cached infinite query data.
 * @param ganapId - Id of the Ganap to remove.
 * @returns The data without that Ganap, with page totals decremented.
 */
function removeSavedGanap(data: SavedGanapsData, ganapId: string): SavedGanapsData {
  let removed = false;
  const pages: SavedGanapPage[] = data.pages.map((page: SavedGanapPage): SavedGanapPage => {
    const items: SavedGanap[] = page.items.filter((item: SavedGanap): boolean => item.id !== ganapId);
    if (items.length !== page.items.length) removed = true;
    return { ...page, items };
  });

  if (!removed) return data;

  return {
    ...data,
    pages: pages.map(
      (page: SavedGanapPage): SavedGanapPage => ({
        ...page,
        pagination: { ...page.pagination, total: Math.max(0, page.pagination.total - 1) },
      }),
    ),
  };
}

/**
 * Toggles the current user's save on a Ganap.
 *
 * An unsave removes the row from the cached saved list before the request
 * settles. A server rejection restores it; a transport failure keeps it removed
 * and queues the unsave for replay, since the user's intent is recorded and
 * will reach the server.
 *
 * @returns The mutation, taking the Ganap id and its current saved state
 */
export function useSaveGanapMutation(): UseMutationResult<void, Error, ToggleSaveVariables, SaveMutationContext> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ToggleSaveVariables, SaveMutationContext>({
    mutationFn: ({ ganapId, isSaved, ownerId }: ToggleSaveVariables): Promise<void> =>
      isSaved ? ganapsAPI.unsave(ganapId, ownerId) : ganapsAPI.save(ganapId, ownerId),
    onMutate: async ({ ganapId, isSaved }: ToggleSaveVariables): Promise<SaveMutationContext> => {
      if (!isSaved) return { previousSaved: [] };

      await queryClient.cancelQueries({ queryKey: profileQueryKeys.savedGanapsRoot() });
      const previousSaved = queryClient.getQueriesData<SavedGanapsData>({
        queryKey: profileQueryKeys.savedGanapsRoot(),
      });
      queryClient.setQueriesData<SavedGanapsData>(
        { queryKey: profileQueryKeys.savedGanapsRoot() },
        (data: SavedGanapsData | undefined): SavedGanapsData | undefined =>
          data === undefined ? undefined : removeSavedGanap(data, ganapId),
      );

      return { previousSaved };
    },
    onSuccess: (_result: unknown, { ganapId }: ToggleSaveVariables): void => {
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
    },
    onError: async (
      error: Error,
      { ganapId, isSaved, ownerId }: ToggleSaveVariables,
      context: SaveMutationContext | undefined,
    ): Promise<void> => {
      if (shouldQueueForReplay(error)) {
        const queued = await enqueueOutbox({ action: isSaved ? 'unsave' : 'save', ganapId, ownerId }).catch(
          () => false,
        );
        if (queued) return;
      }

      context?.previousSaved.forEach(([key, data]: [readonly unknown[], SavedGanapsData | undefined]): void => {
        queryClient.setQueryData(key, data);
      });
      showErrorToast(error);
    },
    /** A queued save is not a failure, so this mutation toasts only the errors it could not queue. */
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/** Arguments for recording attendance from a scanned QR. */
export interface CheckInVariables {
  ganapId: string;
  ownerId: string;
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
    mutationFn: async ({ ganapId, ownerId, qrHash, scannedAt }: CheckInVariables): Promise<CheckInOutcome> => {
      try {
        const result = await ganapsAPI.checkIn(ganapId, { qrHash, scannedAt }, ownerId);
        return { kind: 'recorded', result };
      } catch (error) {
        if (error instanceof Error && shouldQueueForReplay(error)) {
          const queued = await enqueueOutbox({ action: 'check-in', ganapId, ownerId, qrHash, scannedAt }).catch(
            () => false,
          );
          if (queued) return { kind: 'queued' };
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

/** Variables accepted by the rating mutation. */
export interface RateGanapVariables {
  ganapId: string;
  input: RateGanapInput;
}

/**
 * Submits the student's 1–5 star rating and refreshes the Ganap caches.
 *
 * Invalidating the detail key is what refreshes `averageRating` and
 * `ratingCount` on the detail screen without a manual reload.
 *
 * @returns The mutation, resolving to the created rating
 */
export function useRateGanapMutation(): UseMutationResult<GanapRating, Error, RateGanapVariables> {
  const queryClient = useQueryClient();

  return useMutation<GanapRating, Error, RateGanapVariables>({
    mutationFn: ({ ganapId, input }: RateGanapVariables): Promise<GanapRating> => ganapsAPI.rateGanap(ganapId, input),
    onSuccess: (_result: GanapRating, { ganapId }: RateGanapVariables): void => {
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
    },
    // The feedback route renders every rating failure inline, and treats
    // `400 Already rated this event` as silent step completion rather than a
    // failure at all. A global toast would both duplicate the inline message
    // and surface a reconciliation the student is not meant to see.
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}

/** Variables accepted by the Ganap report mutation. */
export interface ReportGanapVariables {
  ganapId: string;
  input: ReportGanapInput;
}

/**
 * Reports a Ganap for review by the Ganapps team.
 *
 * Nothing is cached about a report, so there is nothing to invalidate. The report
 * sheet renders every failure inline, including the duplicate and rate-limit cases,
 * so the global error toast is suppressed.
 *
 * @returns The mutation, resolving to the server's receipt
 */
export function useReportGanapMutation(): UseMutationResult<GanapReportReceipt, Error, ReportGanapVariables> {
  return useMutation<GanapReportReceipt, Error, ReportGanapVariables>({
    mutationFn: ({ ganapId, input }: ReportGanapVariables): Promise<GanapReportReceipt> =>
      ganapsAPI.reportGanap(ganapId, input),
    meta: { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true },
  });
}
