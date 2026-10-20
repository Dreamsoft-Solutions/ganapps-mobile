import { describe, expect, it } from '@jest/globals';
import type { GanapListItem } from '@/types/ganap.types';
import {
  buildFeedSheetSnapPoints,
  FEED_SHEET_PEEK_HEIGHT,
  resolveFeedSheetEmptyMessage,
  resolveFeedSheetMode,
  resolveFeedSheetTitle,
} from './feed-sheet';
import type { GanapClusterFeature } from './map-clustering';

const GANAP = { id: 'ganap_1' } as GanapListItem;
const CLUSTER = {
  type: 'Feature',
  properties: { cluster: true, cluster_id: 1, point_count: 4 },
} as unknown as GanapClusterFeature;

describe('resolveFeedSheetMode', () => {
  it('browses at the peek snap when nothing is selected', () => {
    expect(resolveFeedSheetMode({ selectedGanap: null, selectedCluster: null })).toEqual({
      mode: 'browse',
      snapIndex: 0,
    });
  });

  it('drops to peek and shows the one event when a pin is selected', () => {
    expect(resolveFeedSheetMode({ selectedGanap: GANAP, selectedCluster: null })).toEqual({
      mode: 'selected',
      snapIndex: 0,
    });
  });

  it('keeps the cluster leaf list at the peek so expanded map pins stay visible', () => {
    expect(resolveFeedSheetMode({ selectedGanap: null, selectedCluster: CLUSTER })).toEqual({
      mode: 'cluster',
      snapIndex: 0,
    });
  });

  it('lets a cluster win over a stale pin selection', () => {
    expect(resolveFeedSheetMode({ selectedGanap: GANAP, selectedCluster: CLUSTER })).toEqual({
      mode: 'cluster',
      snapIndex: 0,
    });
  });
});

describe('buildFeedSheetSnapPoints', () => {
  /** Smallest sheet container across supported devices: an iPhone SE under the search bar and chips. */
  const SMALLEST_CONTAINER = 440;

  it('exposes three snap points, peek through full', () => {
    expect(buildFeedSheetSnapPoints()).toHaveLength(3);
  });

  it('gives the peek as a number, never a string', () => {
    expect(typeof buildFeedSheetSnapPoints()[0]).toBe('number');
  });

  it('covers only the sheet itself at the peek, not the tab bar below it', () => {
    /**
     * The screen container already ends at the top of the tab bar, because a
     * custom tabBar is a flex sibling of the screens container. Adding the bar's
     * height here would make the sheet cover that much more of the map than the
     * peek claims.
     */
    expect(buildFeedSheetSnapPoints()[0]).toBe(FEED_SHEET_PEEK_HEIGHT);
  });

  it('fills the area below the top clamp at the full snap, never the whole screen', () => {
    /**
     * `topInset` is subtracted from the container height before percentages are
     * normalised, so 100% is everything below the search bar and chips rather
     * than the whole screen — which would put the title under the status bar.
     */
    expect(buildFeedSheetSnapPoints().at(-1)).toBe('100%');
  });

  it('stays ascending on the smallest supported container', () => {
    /**
     * `useAnimatedDetents` sorts the normalized detents, so an out-of-order
     * array silently reassigns the indices `resolveFeedSheetMode` addresses by
     * position — the peek would become the half snap. Percentages only resolve
     * at runtime, so this pins the one relationship that can invert: the peek
     * against 50% of the smallest container.
     */
    const [peek, half] = buildFeedSheetSnapPoints();
    const halfInPoints: number = (Number(String(half).replace('%', '')) * SMALLEST_CONTAINER) / 100;

    expect(typeof peek).toBe('number');
    expect(peek as number).toBeLessThan(halfInPoints);
  });

  it('indexes every mode the resolver can return', () => {
    const snapPoints = buildFeedSheetSnapPoints();
    const indices = [
      resolveFeedSheetMode({ selectedGanap: null, selectedCluster: null }).snapIndex,
      resolveFeedSheetMode({ selectedGanap: GANAP, selectedCluster: null }).snapIndex,
      resolveFeedSheetMode({ selectedGanap: null, selectedCluster: CLUSTER }).snapIndex,
    ];

    for (const index of indices) {
      expect(snapPoints[index]).toBeDefined();
    }
  });
});

describe('resolveFeedSheetTitle', () => {
  it('names the distance filter only when it is actually applied', () => {
    expect(resolveFeedSheetTitle({ mode: 'browse', leafCount: 0, isNearbyApplied: true })).toBe('Nearby events');
  });

  it('does not claim nearby when the whole catalogue is listed', () => {
    expect(resolveFeedSheetTitle({ mode: 'browse', leafCount: 0, isNearbyApplied: false })).toBe('Upcoming events');
  });

  it('names a single selection', () => {
    expect(resolveFeedSheetTitle({ mode: 'selected', leafCount: 0, isNearbyApplied: true })).toBe('Selected event');
  });

  it('counts the cluster leaves, singular and plural', () => {
    expect(resolveFeedSheetTitle({ mode: 'cluster', leafCount: 1, isNearbyApplied: false })).toBe(
      '1 event in this area',
    );
    expect(resolveFeedSheetTitle({ mode: 'cluster', leafCount: 4, isNearbyApplied: false })).toBe(
      '4 events in this area',
    );
  });

  it('ignores the nearby state outside browse, where the count is what matters', () => {
    expect(resolveFeedSheetTitle({ mode: 'cluster', leafCount: 2, isNearbyApplied: true })).toBe(
      '2 events in this area',
    );
  });
});

describe('resolveFeedSheetEmptyMessage', () => {
  it('distinguishes an empty catalogue from an over-narrow filter', () => {
    expect(resolveFeedSheetEmptyMessage({ mode: 'browse', hasActiveFilters: false })).toBe(
      'No events yet. Check back soon.',
    );
    expect(resolveFeedSheetEmptyMessage({ mode: 'browse', hasActiveFilters: true })).toBe(
      'No events match these filters.',
    );
  });

  it('answers about the group the user pointed at, not the catalogue', () => {
    expect(resolveFeedSheetEmptyMessage({ mode: 'cluster', hasActiveFilters: false })).toBe('No events in this group.');
    expect(resolveFeedSheetEmptyMessage({ mode: 'selected', hasActiveFilters: true })).toBe('No events in this group.');
  });
});
