import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { UseGanapsResult } from '@/hooks/useGanaps';
import type { GanapListItem } from '@/types/ganap.types';
import {
  createGanapClusterIndex,
  type GanapClusterFeature,
  type GanapClusterIndex,
  getVisibleMapFeatures,
  isClusterFeature,
} from '@/utils/map-clustering';
import { GanapFeedSheet } from './GanapFeedSheet';

const mockSnapToIndex = jest.fn<(index: number) => void>();

/**
 * Builds on the library's own mock, which renders children and swaps
 * `BottomSheetFlatList` for a real `FlatList` — so `renderItem` and
 * `onEndReached` behave. Two things it does not do are exactly what needs
 * asserting here, so they are added: it never renders `handleComponent` (the
 * title and its controls), and its `snapToIndex` is a no-op rather than
 * observable.
 */
jest.mock('@gorhom/bottom-sheet', () => {
  const libraryMock = require('@gorhom/bottom-sheet/mock') as Record<string, unknown>;
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');

  const Sheet = React.forwardRef(
    (
      props: { children?: React.ReactNode; handleComponent?: () => React.ReactElement },
      ref: React.Ref<unknown>,
    ): React.ReactElement => {
      React.useImperativeHandle(ref, (): { snapToIndex: (index: number) => void } => ({
        snapToIndex: mockSnapToIndex,
      }));
      return React.createElement(
        View,
        { testID: 'bottom-sheet' },
        props.handleComponent ? React.createElement(props.handleComponent) : null,
        props.children,
      );
    },
  );

  return { ...libraryMock, __esModule: true, default: Sheet };
});

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  const icon =
    (name: string) =>
    (props: { color?: string }): React.ReactElement =>
      React.createElement(View, { testID: `icon-${name}`, ...props });
  return {
    X: icon('x'),
    ZoomIn: icon('zoom-in'),
    Clock: icon('clock'),
    MapPin: icon('map-pin'),
    Users: icon('users'),
    Calendar: icon('calendar'),
  };
});

function ganap(id: string, longitude: number, latitude: number): GanapListItem {
  return {
    id,
    businessId: 'business_1',
    businessName: 'Renzo Org',
    slug: id,
    title: `Event ${id}`,
    description: '',
    address: 'Iloilo, Philippines',
    locationLat: latitude,
    locationLong: longitude,
    startDate: '2026-10-08T02:00:00.000Z',
    endDate: null,
    attendanceOpenMinutesBefore: 30,
    tags: ['music'],
    coverImage: null,
    mapPinImage: null,
    registrationCount: 2,
    likesCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    isLiked: false,
    isSaved: false,
  };
}

const FEED_ITEMS: GanapListItem[] = [ganap('one', 122.54, 10.73), ganap('two', 122.55, 10.74)];

function feedState(overrides: Partial<UseGanapsResult> = {}): UseGanapsResult {
  return {
    items: FEED_ITEMS,
    isLoading: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: jest.fn<UseGanapsResult['fetchNextPage']>(),
    isFetchingNextPage: false,
    join: jest.fn<UseGanapsResult['join']>(),
    leave: jest.fn<UseGanapsResult['leave']>(),
    toggleLike: jest.fn<UseGanapsResult['toggleLike']>(),
    toggleSave: jest.fn<UseGanapsResult['toggleSave']>(),
    isJoining: false,
    isLeaving: false,
    isTogglingLike: false,
    isTogglingSave: false,
    ...overrides,
  };
}

/** Two events at the same spot, so the index reliably produces one cluster. */
const CLUSTERED: GanapListItem[] = [ganap('leaf-a', 122.5489, 10.7313), ganap('leaf-b', 122.5489, 10.7313)];

function clusterFixture(): { index: GanapClusterIndex; cluster: GanapClusterFeature } {
  const index = createGanapClusterIndex(CLUSTERED);
  const cluster = getVisibleMapFeatures(index, {
    bounds: [-180, -85.051129, 180, 85.051129],
    zoom: 0,
  }).find(isClusterFeature);
  if (cluster === undefined) throw new Error('Expected a cluster fixture');
  return { index, cluster };
}

interface SheetHarnessProps {
  feed?: UseGanapsResult;
  hasActiveFilters?: boolean;
  isNearbyApplied?: boolean;
  selectedGanap?: GanapListItem | null;
  selectedCluster?: GanapClusterFeature | null;
  clusterIndex?: GanapClusterIndex;
  onSelectGanap?: (item: GanapListItem) => void;
  onClearSelection?: () => void;
  onZoomToCluster?: jest.Mock<(target: { coordinate: [number, number]; zoom: number }) => void>;
}

function renderSheet(props: SheetHarnessProps = {}): ReturnType<typeof render> {
  return render(
    <GanapFeedSheet
      feed={props.feed ?? feedState()}
      hasActiveFilters={props.hasActiveFilters ?? false}
      isNearbyApplied={props.isNearbyApplied ?? false}
      topOverlayHeight={191}
      selectedGanap={props.selectedGanap ?? null}
      selectedCluster={props.selectedCluster ?? null}
      clusterIndex={props.clusterIndex ?? createGanapClusterIndex(FEED_ITEMS)}
      onSelectGanap={props.onSelectGanap ?? jest.fn()}
      onClearSelection={props.onClearSelection ?? jest.fn()}
      onZoomToCluster={props.onZoomToCluster ?? jest.fn()}
    />,
  );
}

describe('GanapFeedSheet browse mode', () => {
  beforeEach((): void => {
    mockSnapToIndex.mockClear();
  });

  it('lists the feed and titles it by whether a radius applied', async (): Promise<void> => {
    const screen = await renderSheet();

    expect(screen.getByText('Upcoming events')).toBeTruthy();
    expect(screen.getByText('Event one')).toBeTruthy();
    expect(screen.getByText('Event two')).toBeTruthy();

    await screen.rerender(
      <GanapFeedSheet
        feed={feedState()}
        hasActiveFilters={false}
        isNearbyApplied
        topOverlayHeight={191}
        selectedGanap={null}
        selectedCluster={null}
        clusterIndex={createGanapClusterIndex(FEED_ITEMS)}
        onSelectGanap={jest.fn()}
        onClearSelection={jest.fn()}
        onZoomToCluster={jest.fn()}
      />,
    );
    expect(screen.getByText('Nearby events')).toBeTruthy();
  });

  it('shows the loading state instead of the list while the feed loads', async (): Promise<void> => {
    const screen = await renderSheet({ feed: feedState({ isLoading: true, items: [] }) });

    expect(screen.getByText('Finding events...')).toBeTruthy();
    expect(screen.queryByTestId('ganap-feed-sheet-list')).toBeNull();
  });

  it('shows the error state instead of the list when the feed fails', async (): Promise<void> => {
    const screen = await renderSheet({ feed: feedState({ error: new Error('offline'), items: [] }) });

    expect(screen.getByText('offline')).toBeTruthy();
    expect(screen.queryByTestId('ganap-feed-sheet-list')).toBeNull();
  });

  it('distinguishes an empty catalogue from an over-narrow filter', async (): Promise<void> => {
    const bare = await renderSheet({ feed: feedState({ items: [] }) });
    expect(bare.getByText('No events yet. Check back soon.')).toBeTruthy();
    await bare.unmount();

    const filtered = await renderSheet({ feed: feedState({ items: [] }), hasActiveFilters: true });
    expect(filtered.getByText('No events match these filters.')).toBeTruthy();
  });

  it('pages when the list end is reached', async (): Promise<void> => {
    const fetchNextPage = jest.fn<UseGanapsResult['fetchNextPage']>();
    const screen = await renderSheet({ feed: feedState({ hasNextPage: true, fetchNextPage }) });

    await fireEvent(screen.getByTestId('ganap-feed-sheet-list'), 'endReached');

    expect(fetchNextPage).toHaveBeenCalled();
  });

  it('offers no control to leave a selection, because there is none', async (): Promise<void> => {
    const screen = await renderSheet();

    expect(screen.queryByLabelText('Show all events')).toBeNull();
    expect(screen.queryByLabelText('Zoom in to this area')).toBeNull();
  });
});

describe('GanapFeedSheet selected mode', () => {
  beforeEach((): void => {
    mockSnapToIndex.mockClear();
  });

  it('shows only the selected event, not the whole feed', async (): Promise<void> => {
    const screen = await renderSheet({ selectedGanap: FEED_ITEMS[1] });

    expect(screen.getByText('Selected event')).toBeTruthy();
    expect(screen.getByText('Event two')).toBeTruthy();
    expect(screen.queryByText('Event one')).toBeNull();
  });

  it('re-snaps when a pin is tapped even though browse shares the peek index', async (): Promise<void> => {
    /**
     * Browse and selected both resolve to snap index 0. An effect keyed on the
     * index alone would not re-run, leaving a sheet the user had dragged open
     * still showing the whole feed.
     */
    const screen = await renderSheet();
    const callsAfterMount: number = mockSnapToIndex.mock.calls.length;

    await screen.rerender(
      <GanapFeedSheet
        feed={feedState()}
        hasActiveFilters={false}
        isNearbyApplied={false}
        topOverlayHeight={191}
        selectedGanap={FEED_ITEMS[0] ?? null}
        selectedCluster={null}
        clusterIndex={createGanapClusterIndex(FEED_ITEMS)}
        onSelectGanap={jest.fn()}
        onClearSelection={jest.fn()}
        onZoomToCluster={jest.fn()}
      />,
    );

    expect(mockSnapToIndex.mock.calls.length).toBeGreaterThan(callsAfterMount);
    expect(mockSnapToIndex).toHaveBeenLastCalledWith(0);
  });

  it('does not page the feed while a single event is shown', async (): Promise<void> => {
    const fetchNextPage = jest.fn<UseGanapsResult['fetchNextPage']>();
    const screen = await renderSheet({
      feed: feedState({ hasNextPage: true, fetchNextPage }),
      selectedGanap: FEED_ITEMS[0],
    });

    await fireEvent(screen.getByTestId('ganap-feed-sheet-list'), 'endReached');

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('clears the selection from the header control', async (): Promise<void> => {
    const onClearSelection = jest.fn();
    const screen = await renderSheet({ selectedGanap: FEED_ITEMS[0], onClearSelection });

    await fireEvent.press(screen.getByLabelText('Show all events'));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});

describe('GanapFeedSheet cluster mode', () => {
  beforeEach((): void => {
    mockSnapToIndex.mockClear();
  });

  it('lists the cluster leaves and counts them in the title', async (): Promise<void> => {
    const { index, cluster } = clusterFixture();
    const screen = await renderSheet({ selectedCluster: cluster, clusterIndex: index });

    expect(screen.getByText('2 events in this area')).toBeTruthy();
    expect(screen.getByText('Event leaf-a')).toBeTruthy();
    expect(screen.getByText('Event leaf-b')).toBeTruthy();
  });

  it('opens to the half snap rather than the peek', async (): Promise<void> => {
    const { index, cluster } = clusterFixture();
    await renderSheet({ selectedCluster: cluster, clusterIndex: index });

    expect(mockSnapToIndex).toHaveBeenLastCalledWith(1);
  });

  it('zooms to the cluster and clears it, so the sheet stops listing a group that dissolved', async (): Promise<void> => {
    const { index, cluster } = clusterFixture();
    const onZoomToCluster = jest.fn<(target: { coordinate: [number, number]; zoom: number }) => void>();
    const onClearSelection = jest.fn();
    const screen = await renderSheet({
      selectedCluster: cluster,
      clusterIndex: index,
      onZoomToCluster,
      onClearSelection,
    });

    await fireEvent.press(screen.getByLabelText('Zoom in to this area'));

    expect(onZoomToCluster).toHaveBeenCalledTimes(1);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('wins over a stale pin selection', async (): Promise<void> => {
    const { index, cluster } = clusterFixture();
    const screen = await renderSheet({
      selectedGanap: FEED_ITEMS[0],
      selectedCluster: cluster,
      clusterIndex: index,
    });

    expect(screen.getByText('2 events in this area')).toBeTruthy();
    expect(screen.queryByText('Event one')).toBeNull();
  });

  it('answers about the group when it has no resolvable leaves', async (): Promise<void> => {
    const { cluster } = clusterFixture();
    const screen = await renderSheet({
      selectedCluster: cluster,
      clusterIndex: createGanapClusterIndex([]),
    });

    expect(screen.getByText('No events in this group.')).toBeTruthy();
  });
});
