import type { RegistrationStatus } from '@/types/ganap.types';
import type { WalkCard, WalkPage } from '@/types/walk.types';

/** How many Ganaps a "More like this" walk may be seeded with; the server accepts at most this many. */
export const MAX_WALK_SEEDS = 20;

/** Registration statuses that count as the User choosing to go, as the server's ranking does. */
const POSITIVE_REGISTRATION_STATUSES: ReadonlySet<RegistrationStatus> = new Set<RegistrationStatus>([
  'PENDING',
  'REGISTERED',
  'WAITLISTED',
  'ATTENDED',
]);

/**
 * What the User has done in one walk, and which walk it is.
 *
 * Cards are tracked by Ganap id, never by index, because the ids are stable as pages arrive
 * and a Ganap can leave the walk. Only the last card passed is stored: the current card is
 * the first one after it, so the pages can grow without the position moving.
 */
export interface WalkState {
  /** Which walk this is; a new number is a new walk for the same position and seeds. */
  readonly run: number;
  /** Ganaps the walk resembles; empty for an ordinary walk. */
  readonly seedIds: readonly string[];
  /** The last card the User moved past, or `null` before the first Next. */
  readonly lastPassedId: string | null;
  /** Cards the User opened, so a later Next is not a Skip. */
  readonly openedIds: readonly string[];
  /** Set when the server refused an interaction with a 403, which closes the walk. */
  readonly isClosed: boolean;
}

/** Everything that changes a {@link WalkState}. */
export type WalkAction =
  | { readonly type: 'passed'; readonly ganapId: string }
  | { readonly type: 'opened'; readonly ganapId: string }
  | { readonly type: 'closed' }
  | { readonly type: 'restarted'; readonly seedIds: readonly string[] };

/**
 * Starts a walk's state.
 *
 * @param run - A number no earlier walk used
 * @param seedIds - Ganaps the walk should resemble
 * @returns A state with nothing passed or opened
 */
export function createWalkState(run: number, seedIds: readonly string[] = []): WalkState {
  return { run, seedIds, lastPassedId: null, openedIds: [], isClosed: false };
}

/**
 * Applies one action to a walk's state.
 *
 * @param state - The current state
 * @param action - What happened
 * @returns The next state; a restart begins a new run
 */
export function walkReducer(state: WalkState, action: WalkAction): WalkState {
  switch (action.type) {
    case 'passed':
      return { ...state, lastPassedId: action.ganapId };
    case 'opened':
      return state.openedIds.includes(action.ganapId)
        ? state
        : { ...state, openedIds: [...state.openedIds, action.ganapId] };
    case 'closed':
      return { ...state, isClosed: true };
    case 'restarted':
      return createWalkState(state.run + 1, action.seedIds.slice(-MAX_WALK_SEEDS));
  }
}

/**
 * Lists a walk's cards in order, once each.
 *
 * Ordering is best effort when rows change mid-walk, so a Ganap can appear on two pages;
 * the first copy wins and the User sees it once.
 *
 * @param pages - The pages fetched so far
 * @returns The cards without repeated ids
 */
export function flattenWalkCards(pages: readonly WalkPage[]): WalkCard[] {
  const seen = new Set<string>();
  const cards: WalkCard[] = [];
  for (const page of pages) {
    for (const card of page.items) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      cards.push(card);
    }
  }
  return cards;
}

/**
 * Whether a registration status counts as the User choosing to go.
 *
 * @param status - A registration's status
 * @returns True for pending, registered, waitlisted and attended
 */
export function isPositiveRegistration(status: RegistrationStatus | undefined): boolean {
  return status !== undefined && POSITIVE_REGISTRATION_STATUSES.has(status);
}

/** What the walk screen needs to know about the walk's query. */
export interface WalkQueryView {
  status: 'pending' | 'error' | 'success';
  error: Error | null;
  hasNextPage: boolean;
  /** Whether the failure was fetching a later page, with earlier pages still held. */
  isFetchNextPageError: boolean;
}

/**
 * The one thing the walk screen shows.
 *
 * `end` with seeds is "More like this"; `end` without is "Start a new walk". `viewed` is
 * how many cards the User moved past, so a walk that never had any can say so.
 */
export type WalkScreen =
  | { readonly kind: 'loading' }
  | { readonly kind: 'card'; readonly card: WalkCard }
  | { readonly kind: 'end'; readonly viewed: number; readonly seedIds: readonly string[] }
  | { readonly kind: 'closed' }
  | { readonly kind: 'error'; readonly error: Error };

/**
 * Finds the cards the User has moved past.
 *
 * @param cards - The walk's cards in order
 * @param lastPassedId - The last card passed, or null before the first Next
 * @returns Every card up to and including the last passed one
 */
export function passedCards(cards: readonly WalkCard[], lastPassedId: string | null): WalkCard[] {
  if (lastPassedId === null) return [];
  const index: number = cards.findIndex((card: WalkCard): boolean => card.id === lastPassedId);
  return index < 0 ? [] : cards.slice(0, index + 1);
}

/**
 * Whether the User did something with a card beyond looking at it.
 *
 * Liking, saving and registering during a walk all keep the card from being a Skip and make
 * it a seed. The server never offers a Ganap the User had already liked, saved or registered
 * for, so on a walk card those mean the User did it here.
 *
 * @param card - The walk card, with its current like and save state
 * @param registeredIds - Ids of Ganaps the User registered for
 * @returns True when the card was liked, saved or registered for
 */
export function isEngagedCard(card: WalkCard, registeredIds: ReadonlySet<string>): boolean {
  return card.isLiked || card.isSaved || registeredIds.has(card.id);
}

/**
 * Chooses the Ganaps a "More like this" walk resembles.
 *
 * @param passed - The cards the User moved past
 * @param registeredIds - Ids of Ganaps the User registered for
 * @returns Ids of the most recent engaged cards, at most {@link MAX_WALK_SEEDS}
 */
export function collectSeedIds(passed: readonly WalkCard[], registeredIds: ReadonlySet<string>): string[] {
  return passed
    .filter((card: WalkCard): boolean => isEngagedCard(card, registeredIds))
    .map((card: WalkCard): string => card.id)
    .slice(-MAX_WALK_SEEDS);
}

/**
 * Whether an error is the server refusing the walk with a 403.
 *
 * @param error - A rejection from the walk's API calls
 * @returns True for a 403, which means the walk is switched off for this User
 */
export function isWalkForbidden(error: Error): boolean {
  return (error as { status?: number }).status === 403;
}

/**
 * Decides what the walk screen shows.
 *
 * A pure function of the User's position in the walk and the state of its query, so every
 * combination is a case here rather than a flag on the screen. A 403 from the server closes
 * the walk; any other failure is an error the User can retry.
 *
 * @param state - Where the User is in the walk
 * @param cards - The walk's cards in order, once each
 * @param query - The walk query's status
 * @param registeredIds - Ids of Ganaps the User registered for, which seed a "More like this" walk
 * @returns The screen to show
 */
export function selectWalkScreen(
  state: WalkState,
  cards: readonly WalkCard[],
  query: WalkQueryView,
  registeredIds: ReadonlySet<string>,
): WalkScreen {
  if (state.isClosed) return { kind: 'closed' };
  if (query.status === 'error' && query.error !== null && !query.isFetchNextPageError) {
    return isWalkForbidden(query.error) ? { kind: 'closed' } : { kind: 'error', error: query.error };
  }
  if (query.status === 'pending') return { kind: 'loading' };

  const lastPassedIndex: number = cards.findIndex((card: WalkCard): boolean => card.id === state.lastPassedId);
  const current: WalkCard | undefined = cards[lastPassedIndex + 1];
  if (current !== undefined) return { kind: 'card', card: current };

  if (query.hasNextPage) {
    return query.isFetchNextPageError && query.error !== null
      ? { kind: 'error', error: query.error }
      : { kind: 'loading' };
  }

  const passed: WalkCard[] = passedCards(cards, state.lastPassedId);
  return { kind: 'end', viewed: passed.length, seedIds: collectSeedIds(passed, registeredIds) };
}

/**
 * Words a card's distance for the User.
 *
 * The walk's position is rounded to about a kilometre before it leaves the device, so the
 * distance is a whole number of kilometres, never a decimal that claims more than it knows.
 *
 * @param distanceKm - The server's distance from the walk's start, or null when it started without a position
 * @returns A phrase such as `About 3 km away`, or null when there is no distance
 */
export function formatWalkDistance(distanceKm: number | null): string | null {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm < 0) return null;
  return distanceKm < 1 ? 'Under 1 km away' : `About ${String(Math.round(distanceKm))} km away`;
}
