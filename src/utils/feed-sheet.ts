import type { GanapListItem } from '@/types/ganap.types';
import {
  type ClusterZoomTarget,
  type GanapClusterFeature,
  type GanapClusterIndex,
  getClusterExpansionZoom,
  getFeatureCoordinate,
} from './map-clustering';

/** What the feed sheet is currently showing. */
export type FeedSheetMode = 'browse' | 'selected' | 'cluster';

export interface FeedSheetState {
  mode: FeedSheetMode;
  /** Index into the snap points: 0 peek, 1 half, 2 full. */
  snapIndex: number;
}

/**
 * How much of the map the sheet covers at rest, in points.
 *
 * Tall enough for the handle plus the top of the first card, which is what tells
 * a user the sheet is draggable without them having to try it. The screen reads
 * this too — anything floating over the map has to clear it, and the map camera
 * has to pad for it, or pins centre underneath the sheet.
 *
 * This is the whole of what the sheet covers. The tab bar is **not** included:
 * a custom `tabBar` is rendered by `BottomTabView` as a flex sibling of the
 * screen container, so the screen — and therefore the sheet — already ends at
 * the top of the bar. `tabBarStyle.position: 'absolute'` does not change that,
 * because only React Navigation's own `BottomTabBar` reads `tabBarStyle`.
 */
export const FEED_SHEET_PEEK_HEIGHT = 180;

/**
 * The sheet's three snap heights: peek, half, full.
 *
 * Two properties this array has to keep, both of which `@gorhom/bottom-sheet`
 * enforces silently rather than loudly:
 *
 * 1. The peek is a **number**. Every string snap point is read as a percentage —
 *    `normalizeSnapPoint` parses `'180'` as 180% of the container, not 180
 *    points. Numbers are points.
 * 2. The entries are **ascending**. `useAnimatedDetents` sorts the normalized
 *    detents, so an out-of-order array silently reassigns the indices that
 *    `resolveFeedSheetMode` addresses by position. The peek is well under half
 *    the container on every supported device, which is what keeps it in order.
 *
 * A fresh array each call, because the sheet hands this straight to a prop the
 * library treats as mutable.
 *
 * @returns Snap points ordered peek, half, full
 */
export function buildFeedSheetSnapPoints(): (string | number)[] {
  return [FEED_SHEET_PEEK_HEIGHT, '50%', '100%'];
}

export interface FeedSheetSelection {
  selectedGanap: GanapListItem | null;
  selectedCluster: GanapClusterFeature | null;
}

/**
 * Decides what the feed sheet shows and how far it opens.
 *
 * The sheet is the map tab's only bottom surface, so a pin tap and a cluster tap
 * are modes of the feed rather than separate cards stacked over it. A cluster
 * wins over a pin: tapping a cluster is a deliberate act on a wider area, and
 * the pin selection behind it is usually stale.
 *
 * @param selection - The current pin and cluster selection
 * @returns The mode to render and the snap point to animate to
 */
export function resolveFeedSheetMode(selection: FeedSheetSelection): FeedSheetState {
  if (selection.selectedCluster) return { mode: 'cluster', snapIndex: 1 };
  if (selection.selectedGanap) return { mode: 'selected', snapIndex: 0 };
  return { mode: 'browse', snapIndex: 0 };
}

/**
 * Where the camera should move to expand a cluster the sheet is showing.
 *
 * Pure so the screen's camera wiring can be asserted without rendering a sheet.
 * Returns `null` when the cluster's geometry does not validate, which makes the
 * zoom action unavailable rather than moving the camera somewhere meaningless.
 *
 * @param index - The cluster index the feature came from
 * @param cluster - The selected cluster
 * @returns The camera target, or null when the geometry is malformed
 */
export function resolveClusterZoomTarget(
  index: GanapClusterIndex,
  cluster: GanapClusterFeature,
): ClusterZoomTarget | null {
  const coordinate = getFeatureCoordinate(cluster);
  if (coordinate === null) return null;
  return { coordinate, zoom: getClusterExpansionZoom(index, cluster) };
}

export interface FeedSheetTitleInput {
  mode: FeedSheetMode;
  /** How many events the selected cluster holds; read only in `cluster` mode. */
  leafCount: number;
  /**
   * Whether a distance filter actually reached the server.
   *
   * Not the same as the Nearby chip being on: the chip can be active while the
   * device position is still resolving, and until it arrives no `lat`/`long`/
   * `radius` is sent and the list really is the whole catalogue.
   */
  isNearbyApplied: boolean;
}

/**
 * The sheet's title for what it is currently showing.
 *
 * Browse mode must not claim "Nearby" unless a radius was genuinely applied —
 * the list is otherwise every upcoming event in the city, and the server sorts
 * by start date rather than by distance.
 *
 * @param input - The current mode, the cluster size, and whether a radius applied
 * @returns The heading to render
 */
export function resolveFeedSheetTitle({ mode, leafCount, isNearbyApplied }: FeedSheetTitleInput): string {
  if (mode === 'cluster') return `${leafCount} ${leafCount === 1 ? 'event' : 'events'} in this area`;
  if (mode === 'selected') return 'Selected event';
  return isNearbyApplied ? 'Nearby events' : 'Upcoming events';
}

export interface FeedSheetEmptyInput {
  mode: FeedSheetMode;
  /** Whether a search, tag, or distance filter is narrowing the catalogue. */
  hasActiveFilters: boolean;
}

/**
 * What the sheet says when it has nothing to list.
 *
 * A cluster or a single selection is a group the user pointed at, so browse
 * copy about the catalogue being empty would be answering a question they did
 * not ask.
 *
 * @param input - The current mode and whether any filter is narrowing the list
 * @returns The empty-state message
 */
export function resolveFeedSheetEmptyMessage({ mode, hasActiveFilters }: FeedSheetEmptyInput): string {
  if (mode !== 'browse') return 'No events in this group.';
  return hasActiveFilters ? 'No events match these filters.' : 'No events yet. Check back soon.';
}
