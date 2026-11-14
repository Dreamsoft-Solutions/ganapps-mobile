import {
  type InfiniteData,
  type Query,
  type QueryClient,
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { ganapsAPI } from '@/api/endpoints/ganaps';
import type { CursorPage, PaginatedResponse } from '@/api/types/api-response';
import {
  classifyReplayError,
  enqueueOutbox,
  queueBehindPendingToggle,
  type ToggleCommand,
} from '@/services/sync.service';
import { useAuthStore } from '@/store/auth.store';
import type {
  CheckInResult,
  GanapDetail,
  GanapListItem,
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

/** The fields of a Ganap that a like or save changes. */
interface GanapEngagement {
  isLiked?: boolean;
  isSaved?: boolean;
  likesCount?: number;
}

/** Rewrites one cached copy of a Ganap, returning the same object when nothing changes. */
type GanapEngagementUpdate = <T extends GanapEngagement>(ganap: T) => T;

type GanapListPage = CursorPage<GanapListItem>;
type GanapListCache = GanapListPage | InfiniteData<GanapListPage, string | undefined>;

/** How a like or save left the device: sent to the server, or queued for replay. */
export type ToggleOutcome = 'sent' | 'queued';

/**
 * Marks a cached Ganap liked or unliked and moves its like count with it.
 *
 * @param ganap - A cached detail or list item
 * @param isLiked - The liked state to show
 * @returns The updated copy, or the same object when it already shows that state
 */
function withLiked<T extends GanapEngagement>(ganap: T, isLiked: boolean): T {
  if ((ganap.isLiked ?? false) === isLiked) return ganap;
  if (typeof ganap.likesCount !== 'number') return { ...ganap, isLiked };
  return { ...ganap, isLiked, likesCount: Math.max(0, ganap.likesCount + (isLiked ? 1 : -1)) };
}

/**
 * Marks a cached Ganap saved or unsaved.
 *
 * @param ganap - A cached detail or list item
 * @param isSaved - The saved state to show
 * @returns The updated copy, or the same object when it already shows that state
 */
function withSaved<T extends GanapEngagement>(ganap: T, isSaved: boolean): T {
  return (ganap.isSaved ?? false) === isSaved ? ganap : { ...ganap, isSaved };
}

/**
 * Reads the pages of a cached map, filter or feed list.
 *
 * @param data - The cached query data
 * @returns Its pages, or none when the data is not a Ganap list
 */
function listPages(data: unknown): GanapListPage[] {
  if (typeof data !== 'object' || data === null) return [];
  if ('pages' in data) return (data as InfiniteData<GanapListPage>).pages;
  return 'items' in data ? [data as GanapListPage] : [];
}

/**
 * Applies an update to one Ganap within a cached list page.
 *
 * @param page - A cached page of list items
 * @param ganapId - Id of the Ganap to update
 * @param update - The change to apply
 * @returns The updated page, or the same page when it does not change
 */
function updateGanapInPage(page: GanapListPage, ganapId: string, update: GanapEngagementUpdate): GanapListPage {
  let changed = false;
  const items: GanapListItem[] = page.items.map((item: GanapListItem): GanapListItem => {
    if (item.id !== ganapId) return item;
    const next: GanapListItem = update(item);
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...page, items } : page;
}

/**
 * Applies an update to one Ganap in a cached map, filter or feed list.
 *
 * @param data - A single page (map and filters) or paged feed data
 * @param ganapId - Id of the Ganap to update
 * @param update - The change to apply
 * @returns The updated data, or the same data when it does not change
 */
function updateGanapInList(data: GanapListCache, ganapId: string, update: GanapEngagementUpdate): GanapListCache {
  if (!('pages' in data)) return updateGanapInPage(data, ganapId, update);

  const pages: GanapListPage[] = data.pages.map(
    (page: GanapListPage): GanapListPage => updateGanapInPage(page, ganapId, update),
  );
  const changed: boolean = pages.some((page: GanapListPage, index: number): boolean => page !== data.pages[index]);
  return changed ? { ...data, pages } : data;
}

/**
 * Shows a like or save, or takes one back, on every cached copy of one Ganap.
 *
 * Only queries that hold the Ganap are touched: their in-flight refetches are
 * cancelled first so an older response cannot overwrite the change, and a copy
 * that already shows the state is left alone, so unrelated lists keep their
 * freshness and pending invalidations.
 *
 * @param queryClient - The app's query client
 * @param ganapId - Id of the Ganap being toggled
 * @param update - The change to show
 * @returns Nothing
 */
async function showGanapToggle(
  queryClient: QueryClient,
  ganapId: string,
  update: GanapEngagementUpdate,
): Promise<void> {
  const detailKey = ganapQueryKeys.detail(ganapId);
  const holdsGanap = (query: Query): boolean =>
    listPages(query.state.data).some((page: GanapListPage): boolean =>
      page.items.some((item: GanapListItem): boolean => item.id === ganapId),
    );
  await Promise.all([
    queryClient.cancelQueries({ queryKey: detailKey, exact: true }),
    queryClient.cancelQueries({ queryKey: ganapQueryKeys.lists(), predicate: holdsGanap }),
  ]);

  queryClient.setQueryData<GanapDetail>(detailKey, (data: GanapDetail | undefined): GanapDetail | undefined => {
    if (data === undefined) return undefined;
    const next: GanapDetail = update(data);
    return next === data ? undefined : next;
  });
  queryClient.setQueriesData<GanapListCache>(
    { queryKey: ganapQueryKeys.lists(), predicate: holdsGanap },
    (data: GanapListCache | undefined): GanapListCache | undefined => {
      if (data === undefined) return undefined;
      const next: GanapListCache = updateGanapInList(data, ganapId, update);
      return next === data ? undefined : next;
    },
  );
}

/**
 * Sends a like or save, or queues it when that is the only safe way to deliver it.
 *
 * It is queued without a request when an older like or save for the same Ganap
 * is still queued, so the two reach the server in order. It is also queued when
 * the request gets no response. A rejection that carries a status is a real
 * answer from the server and rejects.
 *
 * @param command - The like, unlike, save or unsave
 * @param send - Sends it to the server
 * @returns Whether it was sent or queued
 * @throws The server's rejection, or the transport failure when it could not be queued
 */
async function sendOrQueueToggle(command: ToggleCommand, send: () => Promise<void>): Promise<ToggleOutcome> {
  if (await queueBehindPendingToggle(command).catch((): boolean => false)) return 'queued';

  try {
    await send();
    return 'sent';
  } catch (error) {
    if (error instanceof Error && shouldQueueForReplay(error)) {
      const queued: boolean = await enqueueOutbox(command).catch((): boolean => false);
      if (queued) return 'queued';
    }
    throw error;
  }
}

/**
 * Whether a failed like or save belongs to the user who is still signed in.
 *
 * A rejection can arrive after sign-out; changing the cache then would write one
 * user's state into the cache the next user starts from.
 *
 * @param ownerId - The user who made the like or save
 * @returns True when that user is still signed in
 */
function isStillSignedIn(ownerId: string): boolean {
  return useAuthStore.getState().user?.id === ownerId;
}

/**
 * Refreshes every cache that shows these Ganaps' like or save state.
 *
 * The outbox drain calls this once a pass has sent the queued likes and saves it
 * could reach, so the screen shows the server's answer either way.
 *
 * @param queryClient - The app's query client
 * @param ganapIds - Ids of the Ganaps whose like or save settled
 * @returns Nothing
 */
export function refreshGanapEngagement(queryClient: QueryClient, ganapIds: string[]): void {
  ganapIds.forEach((ganapId: string): void => {
    queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
  });
  queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
  queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
}

/**
 * Toggles the current user's like on a Ganap.
 *
 * The heart and like count change before the request settles and stay changed
 * when the like is queued. A 400 or 404 means the server already holds the
 * state the user chose, so the Ganap refreshes without an error. Any other
 * rejection puts the heart back and shows the error.
 *
 * @returns The mutation, taking the Ganap id and its current liked state
 */
export function useLikeGanapMutation(): UseMutationResult<ToggleOutcome, Error, ToggleLikeVariables> {
  const queryClient = useQueryClient();

  return useMutation<ToggleOutcome, Error, ToggleLikeVariables>({
    mutationFn: ({ ganapId, isLiked, ownerId }: ToggleLikeVariables): Promise<ToggleOutcome> =>
      sendOrQueueToggle(
        { action: isLiked ? 'unlike' : 'like', ganapId, ownerId },
        (): Promise<void> => (isLiked ? ganapsAPI.unlike(ganapId, ownerId) : ganapsAPI.like(ganapId, ownerId)),
      ),
    onMutate: async ({ ganapId, isLiked }: ToggleLikeVariables): Promise<void> => {
      await showGanapToggle(
        queryClient,
        ganapId,
        <T extends GanapEngagement>(ganap: T): T => withLiked(ganap, !isLiked),
      );
    },
    onSuccess: (outcome: ToggleOutcome, { ganapId }: ToggleLikeVariables): void => {
      if (outcome !== 'sent') return;
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.lists() });
    },
    onError: async (error: Error, { ganapId, isLiked, ownerId }: ToggleLikeVariables): Promise<void> => {
      if (!isStillSignedIn(ownerId)) return;
      if (classifyReplayError(isLiked ? 'unlike' : 'like', error) !== 'success') {
        await showGanapToggle(
          queryClient,
          ganapId,
          <T extends GanapEngagement>(ganap: T): T => withLiked(ganap, isLiked),
        );
        showErrorToast(error);
      }
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
    },
    /** This mutation decides which failures to show, so the global error toast stays out of it. */
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
 * The bookmark changes before the request settles, and an unsave also removes
 * the row from the cached saved list; both stay when the save is queued. A 400
 * or 404 means the server already holds the state the user chose, so the
 * caches refresh without an error. Any other rejection puts both back and
 * shows the error.
 *
 * @returns The mutation, taking the Ganap id and its current saved state
 */
export function useSaveGanapMutation(): UseMutationResult<
  ToggleOutcome,
  Error,
  ToggleSaveVariables,
  SaveMutationContext
> {
  const queryClient = useQueryClient();

  return useMutation<ToggleOutcome, Error, ToggleSaveVariables, SaveMutationContext>({
    mutationFn: ({ ganapId, isSaved, ownerId }: ToggleSaveVariables): Promise<ToggleOutcome> =>
      sendOrQueueToggle(
        { action: isSaved ? 'unsave' : 'save', ganapId, ownerId },
        (): Promise<void> => (isSaved ? ganapsAPI.unsave(ganapId, ownerId) : ganapsAPI.save(ganapId, ownerId)),
      ),
    onMutate: async ({ ganapId, isSaved }: ToggleSaveVariables): Promise<SaveMutationContext> => {
      await showGanapToggle(
        queryClient,
        ganapId,
        <T extends GanapEngagement>(ganap: T): T => withSaved(ganap, !isSaved),
      );
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
    onSuccess: (outcome: ToggleOutcome, { ganapId }: ToggleSaveVariables): void => {
      if (outcome === 'sent') refreshGanapEngagement(queryClient, [ganapId]);
    },
    onError: async (
      error: Error,
      { ganapId, isSaved, ownerId }: ToggleSaveVariables,
      context: SaveMutationContext | undefined,
    ): Promise<void> => {
      if (!isStillSignedIn(ownerId)) return;
      if (classifyReplayError(isSaved ? 'unsave' : 'save', error) === 'success') {
        refreshGanapEngagement(queryClient, [ganapId]);
        return;
      }

      await showGanapToggle(
        queryClient,
        ganapId,
        <T extends GanapEngagement>(ganap: T): T => withSaved(ganap, isSaved),
      );
      context?.previousSaved.forEach(([key, data]: [readonly unknown[], SavedGanapsData | undefined]): void => {
        queryClient.setQueryData(key, data);
      });
      queryClient.invalidateQueries({ queryKey: ganapQueryKeys.detail(ganapId) });
      showErrorToast(error);
    },
    /** This mutation decides which failures to show, so the global error toast stays out of it. */
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
