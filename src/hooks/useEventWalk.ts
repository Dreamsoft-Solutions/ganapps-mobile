import { type Query, useQueryClient } from '@tanstack/react-query';
import { type Dispatch, useCallback, useEffect, useMemo, useReducer } from 'react';
import { useLikeGanapMutation, useSaveGanapMutation } from '@/hooks/mutations/useGanapMutation';
import { useWalkInteractionMutation } from '@/hooks/mutations/useWalkMutation';
import { ganapQueryKeys } from '@/hooks/queries/useGanapsQuery';
import { useWalkQuery } from '@/hooks/queries/useWalkQuery';
import { walkQueryKeys } from '@/hooks/queries/walk-query-keys';
import type { Coords } from '@/services/location.service';
import { useAuthStore } from '@/store/auth.store';
import type { GanapDetail } from '@/types/ganap.types';
import type { WalkCard, WalkInteractionType, WalkParams } from '@/types/walk.types';
import {
  createWalkState,
  flattenWalkCards,
  isEngagedCard,
  isPositiveRegistration,
  isWalkForbidden,
  passedCards,
  selectWalkScreen,
  type WalkAction,
  type WalkScreen,
  type WalkState,
  walkReducer,
} from '@/utils/event-walk';

/** Fetch the next page once this many unseen cards are left, so Next rarely waits on the network. */
const PREFETCH_WHEN_CARDS_LEFT = 3;

/**
 * Where the walk's position comes from.
 *
 * The walk waits for `ready` so its first request carries the position, since the position
 * is part of what the server ranks and cannot change mid-walk. `coords` is `null` when the
 * User has not allowed location, and the walk then ranks without distance.
 */
export type WalkLocation =
  | { readonly status: 'resolving' }
  | { readonly status: 'ready'; readonly coords: Coords | null };

/** The walk's state and the actions the screen can take on it. */
export interface UseEventWalkResult {
  /** The one thing to show. */
  screen: WalkScreen;
  /** Moves past the current card, recording a Skip when the User did nothing with it. */
  next: () => void;
  /** Records that the User opened the current card; the screen then shows its detail. */
  open: () => void;
  /** Likes or unlikes the current card. */
  toggleLike: () => void;
  /** Saves or unsaves the current card. */
  toggleSave: () => void;
  /** Whether a like on the current card is being sent. */
  isLikePending: boolean;
  /** Whether a save on the current card is being sent. */
  isSavePending: boolean;
  /** Starts a new walk that resembles what the User liked, saved or registered for in this one. */
  startMoreLikeThis: () => void;
  /** Starts a new walk with no seeds. */
  startNewWalk: () => void;
  /** Tries the failed request again. */
  retry: () => void;
}

/**
 * Finds which of these Ganaps the User holds a registration for, as far as the app knows.
 *
 * Registering happens on the event detail screen, so the walk reads its answer from the
 * cached detail rather than tracking it. A Ganap whose detail was never opened has none.
 *
 * @param read - Reads a cached Ganap detail by id
 * @param ganapIds - Ids to check
 * @returns The ids the User registered for
 */
function findRegisteredIds(
  read: (ganapId: string) => GanapDetail | undefined,
  ganapIds: readonly string[],
): ReadonlySet<string> {
  return new Set<string>(
    ganapIds.filter((ganapId: string): boolean => isPositiveRegistration(read(ganapId)?.myRegistration?.status)),
  );
}

/**
 * Drives an Event Walk: a ranked queue of recommended events the User steps through one at a time.
 *
 * Owns the walk's pages, where the User is in them, what they did with each card, and what
 * that sends to the server. It holds no view code, so the screen only renders {@link UseEventWalkResult.screen}
 * and calls the actions.
 *
 * Next sends a Skip only for a card the User did nothing with: not opened, liked, saved or
 * registered for. Opening, Skipping and the like or save from a card are signals for the next
 * walk's ranking, so they are sent and forgotten; none of them waits for the server or
 * blocks the walk. Likes and saves go through the same mutations as everywhere else, which
 * keep the card's heart and bookmark in step and put them back on failure.
 *
 * @param location - The User's position once known
 * @returns The screen to show and the actions on it
 */
export function useEventWalk(location: WalkLocation): UseEventWalkResult {
  const queryClient = useQueryClient();
  const userId: string | undefined = useAuthStore((s) => s.user?.id);
  const [state, dispatch]: [WalkState, Dispatch<WalkAction>] = useReducer(walkReducer, undefined, () =>
    createWalkState(Date.now()),
  );

  const coords: Coords | null = location.status === 'ready' ? location.coords : null;
  const params: WalkParams = useMemo(
    (): WalkParams => ({
      lat: coords?.latitude,
      long: coords?.longitude,
      seed: state.seedIds.length > 0 ? state.seedIds : undefined,
    }),
    [coords?.latitude, coords?.longitude, state.seedIds],
  );
  const query = useWalkQuery(state.run, params, location.status === 'ready' && !state.isClosed);

  const closeWalk = useCallback((error: Error): void => {
    if (isWalkForbidden(error)) dispatch({ type: 'closed' });
  }, []);
  const interaction = useWalkInteractionMutation(closeWalk);
  const likeMutation = useLikeGanapMutation();
  const saveMutation = useSaveGanapMutation();

  const cards: WalkCard[] = useMemo((): WalkCard[] => flattenWalkCards(query.data?.pages ?? []), [query.data]);
  const walkToken: string | undefined = query.data?.pages[0]?.walkToken;

  const readDetail = useCallback(
    (ganapId: string): GanapDetail | undefined => queryClient.getQueryData<GanapDetail>(ganapQueryKeys.detail(ganapId)),
    [queryClient],
  );

  const screen: WalkScreen = useMemo(
    (): WalkScreen =>
      selectWalkScreen(
        state,
        cards,
        {
          status: query.status,
          error: query.error,
          hasNextPage: query.hasNextPage,
          isFetchNextPageError: query.isFetchNextPageError,
        },
        findRegisteredIds(
          readDetail,
          passedCards(cards, state.lastPassedId).map((card: WalkCard): string => card.id),
        ),
      ),
    [state, cards, query.status, query.error, query.hasNextPage, query.isFetchNextPageError, readDetail],
  );

  const currentIndex: number = cards.findIndex((card: WalkCard): boolean => card.id === state.lastPassedId) + 1;
  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage, status } = query;
  useEffect((): void => {
    const cardsLeft: number = cards.length - currentIndex;
    if (status !== 'success' || !hasNextPage || isFetching || isFetchNextPageError) return;
    if (cardsLeft <= PREFETCH_WHEN_CARDS_LEFT) void fetchNextPage();
  }, [cards.length, currentIndex, status, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  useEffect((): void => {
    queryClient.removeQueries({
      queryKey: walkQueryKeys.all,
      predicate: (walkQuery: Query): boolean => walkQuery.queryKey[2] !== state.run,
    });
  }, [queryClient, state.run]);

  const sendInteraction = useCallback(
    (ganapId: string, type: WalkInteractionType): void => {
      if (walkToken !== undefined) interaction.mutate({ ganapId, type, walkToken });
    },
    [interaction, walkToken],
  );

  const currentCard: WalkCard | null = screen.kind === 'card' ? screen.card : null;

  const next = useCallback((): void => {
    if (currentCard === null) return;
    const registeredIds: ReadonlySet<string> = findRegisteredIds(readDetail, [currentCard.id]);
    const isEngaged: boolean = state.openedIds.includes(currentCard.id) || isEngagedCard(currentCard, registeredIds);
    if (!isEngaged) sendInteraction(currentCard.id, 'SKIPPED');
    dispatch({ type: 'passed', ganapId: currentCard.id });
  }, [currentCard, readDetail, sendInteraction, state.openedIds]);

  const open = useCallback((): void => {
    if (currentCard === null || state.openedIds.includes(currentCard.id)) return;
    dispatch({ type: 'opened', ganapId: currentCard.id });
    sendInteraction(currentCard.id, 'OPENED');
  }, [currentCard, sendInteraction, state.openedIds]);

  const toggleLike = useCallback((): void => {
    if (currentCard === null || userId === undefined) return;
    likeMutation.mutate({ ganapId: currentCard.id, isLiked: currentCard.isLiked, ownerId: userId });
  }, [currentCard, likeMutation, userId]);

  const toggleSave = useCallback((): void => {
    if (currentCard === null || userId === undefined) return;
    saveMutation.mutate({ ganapId: currentCard.id, isSaved: currentCard.isSaved, ownerId: userId });
  }, [currentCard, saveMutation, userId]);

  const startMoreLikeThis = useCallback((): void => {
    if (screen.kind === 'end') dispatch({ type: 'restarted', seedIds: screen.seedIds });
  }, [screen]);

  const startNewWalk = useCallback((): void => dispatch({ type: 'restarted', seedIds: [] }), []);

  const retry = useCallback((): void => {
    if (query.isFetchNextPageError) void query.fetchNextPage();
    else void query.refetch();
  }, [query]);

  return {
    screen,
    next,
    open,
    toggleLike,
    toggleSave,
    isLikePending: likeMutation.isPending && likeMutation.variables?.ganapId === currentCard?.id,
    isSavePending: saveMutation.isPending && saveMutation.variables?.ganapId === currentCard?.id,
    startMoreLikeThis,
    startNewWalk,
    retry,
  };
}
