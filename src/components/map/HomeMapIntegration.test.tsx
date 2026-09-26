import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { MapState } from '@rnmapbox/maps';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Routes } from '@/constants/routes';
import type { UseGanapDiscoveryResult } from '@/hooks/useGanapDiscovery';
import type { Coords } from '@/services/location.service';
import type { GanapListItem } from '@/types/ganap.types';
import { FEED_SHEET_PEEK_HEIGHT } from '@/utils/feed-sheet';
import {
  type ClusterZoomTarget,
  createGanapClusterIndex,
  type GanapClusterFeature,
  type GanapClusterIndex,
  getClusterExpansionZoom,
  getFeatureCoordinate,
  getVisibleMapFeatures,
  isClusterFeature,
  normalizeClusterZoom,
} from '@/utils/map-clustering';
import { MAP_OVERLAY_TOP } from '@/utils/map-viewport';

const mockMapProps: Array<{ onMapIdle?: (state: MapState) => void }> = [];
const mockMarkerProps: Array<{ anchor?: { x: number; y: number }; allowOverlap?: boolean }> = [];
const mockSetCamera =
  jest.fn<
    (config: {
      centerCoordinate: [number, number];
      zoomLevel: number;
      animationDuration: number;
      padding: { paddingTop: number; paddingBottom: number; paddingLeft: number; paddingRight: number };
    }) => void
  >();
const mockUseGanapDiscovery = jest.fn<() => UseGanapDiscoveryResult>();
const mockRouterPush = jest.fn<(href: unknown) => void>();

jest.mock('@rnmapbox/maps', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');

  const MockMapView = ({
    children,
    onMapIdle,
  }: {
    children?: ReactNode;
    onMapIdle?: (state: MapState) => void;
  }): ReactElement => {
    mockMapProps.push({ onMapIdle });
    return React.createElement(ReactNative.View, null, children);
  };

  const MockMarkerView = ({
    anchor,
    allowOverlap,
    children,
  }: {
    anchor?: { x: number; y: number };
    allowOverlap?: boolean;
    children: ReactElement;
  }): ReactElement => {
    mockMarkerProps.push({ anchor, allowOverlap });
    return React.createElement(ReactNative.View, null, children);
  };

  const MockCamera = React.forwardRef<
    { setCamera: typeof mockSetCamera },
    { centerCoordinate?: [number, number]; zoomLevel?: number; animationMode?: string }
  >((_props, ref): ReactElement => {
    React.useImperativeHandle(ref, (): { setCamera: typeof mockSetCamera } => ({ setCamera: mockSetCamera }));
    return React.createElement(ReactNative.View, { testID: 'mock-camera' });
  });

  return {
    __esModule: true,
    default: { setAccessToken: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) },
    MapView: MockMapView,
    MarkerView: MockMarkerView,
    Camera: MockCamera,
  };
});

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  return {
    LucideProvider: ({ children }: { children?: ReactNode }): ReactElement =>
      React.createElement(React.Fragment, null, children),
    X: (): null => null,
    LocateFixed: (): null => null,
  };
});

jest.mock('expo-router', () => ({
  useRouter: (): { push: typeof mockRouterPush } => ({ push: mockRouterPush }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; right: number; bottom: number; left: number } => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }),
}));

jest.mock('@/hooks/useGanapDiscovery', () => ({ useGanapDiscovery: mockUseGanapDiscovery }));
jest.mock('@/components/map/GanapMapPin', () => ({
  GanapMapPin: ({ ganap }: { ganap: GanapListItem }): ReactElement => {
    const React = require('react') as typeof import('react');
    const ReactNative = require('react-native') as typeof import('react-native');
    return React.createElement(ReactNative.View, { testID: `ganap-pin-${ganap.id}` });
  },
}));
jest.mock('@/components/map/MapSearchBar', () => ({ MapSearchBar: (): null => null }));
jest.mock('@/components/map/TagChips', () => ({
  TagChips: ({ onToggleNearby }: { onToggleNearby: () => void }): ReactElement => {
    const React = require('react') as typeof import('react');
    const ReactNative = require('react-native') as typeof import('react-native');
    return React.createElement(ReactNative.Pressable, {
      accessibilityRole: 'switch',
      accessibilityLabel: 'Show events near me',
      onPress: onToggleNearby,
    });
  },
}));
// The sheet's own rendering is covered by its unit tests; here it stands in as
// the single bottom surface so the screen's wiring can be asserted. The zoom
// target comes from the real resolver, so the camera assertion stays honest.
jest.mock('@/components/map/GanapFeedSheet', () => ({
  GanapFeedSheet: ({
    selectedGanap,
    selectedCluster,
    clusterIndex,
    onSelectGanap,
    onClearSelection,
    onZoomToCluster,
  }: GanapFeedSheetStubProps): ReactElement => {
    const React = require('react') as typeof import('react');
    const ReactNative = require('react-native') as typeof import('react-native');
    const clustering = require('@/utils/map-clustering') as typeof import('@/utils/map-clustering');
    const sheet = require('@/utils/feed-sheet') as typeof import('@/utils/feed-sheet');

    const leaves: GanapListItem[] =
      selectedCluster === null ? [] : clustering.getClusterLeaves(clusterIndex, selectedCluster);
    const shown: GanapListItem[] = selectedCluster !== null ? leaves : selectedGanap ? [selectedGanap] : [];

    return React.createElement(
      ReactNative.View,
      { testID: selectedCluster !== null ? 'feed-sheet-cluster-mode' : 'ganap-feed-sheet' },
      ...shown.map(
        (item: GanapListItem): ReactElement =>
          React.createElement(
            ReactNative.Pressable,
            {
              key: item.id,
              testID: `feed-sheet-card-${item.id}`,
              accessibilityRole: 'button',
              accessibilityLabel: `Open event details for ${item.title}`,
              onPress: (): void => onSelectGanap(item),
            },
            React.createElement(ReactNative.Text, null, item.title),
          ),
      ),
      selectedCluster !== null
        ? React.createElement(ReactNative.Pressable, {
            accessibilityRole: 'button',
            accessibilityLabel: 'Zoom in to this area',
            onPress: (): void => {
              const target = sheet.resolveClusterZoomTarget(clusterIndex, selectedCluster);
              if (target !== null) onZoomToCluster(target);
            },
          })
        : null,
      React.createElement(ReactNative.Pressable, {
        accessibilityRole: 'button',
        accessibilityLabel: 'Show all events',
        onPress: onClearSelection,
      }),
    );
  },
}));

interface GanapFeedSheetStubProps {
  selectedGanap: GanapListItem | null;
  selectedCluster: GanapClusterFeature | null;
  clusterIndex: GanapClusterIndex;
  onSelectGanap: (ganap: GanapListItem) => void;
  onClearSelection: () => void;
  onZoomToCluster: (target: ClusterZoomTarget) => void;
}

let HomeScreen: typeof import('@/app/(app)/(home)/index').default;
const previousMapboxToken: string | undefined = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

function ganap(id: string, longitude: number, latitude: number): GanapListItem {
  return {
    id,
    businessId: 'business_1',
    businessName: 'CPU Developers',
    slug: id,
    title: `Event ${id}`,
    description: 'Bring a laptop.',
    address: 'Student Union',
    locationLat: latitude,
    locationLong: longitude,
    startDate: '2026-08-08T02:00:00.000Z',
    endDate: null,
    attendanceOpenMinutesBefore: 30,
    tags: ['study'],
    coverImage: null,
    mapPinImage: null,
    registrationCount: 5,
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

function mapHookResult(
  items: GanapListItem[],
  overrides: Partial<UseGanapDiscoveryResult['nearby']> = {},
): UseGanapDiscoveryResult {
  return {
    filters: {},
    search: '',
    setSearch: jest.fn(),
    tag: null,
    setTag: jest.fn(),
    tags: [],
    map: {
      items,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn<UseGanapDiscoveryResult['map']['refetch']>(),
    },
    feed: {
      items,
      isLoading: false,
      error: null,
      hasNextPage: false,
      fetchNextPage: jest.fn<UseGanapDiscoveryResult['feed']['fetchNextPage']>(),
      isFetchingNextPage: false,
      join: jest.fn<UseGanapDiscoveryResult['feed']['join']>(),
      leave: jest.fn<UseGanapDiscoveryResult['feed']['leave']>(),
      toggleLike: jest.fn<UseGanapDiscoveryResult['feed']['toggleLike']>(),
      toggleSave: jest.fn<UseGanapDiscoveryResult['feed']['toggleSave']>(),
      isJoining: false,
      isLeaving: false,
      isTogglingLike: false,
      isTogglingSave: false,
    },
    nearby: {
      isActive: false,
      isDisabled: false,
      coords: null,
      isPrimingVisible: false,
      isAccuracyNoticeVisible: false,
      errorMessage: null,
      toggle: jest.fn(),
      refresh: jest.fn<() => Promise<Coords | null>>(),
      confirmPriming: jest.fn<() => Promise<void>>(),
      dismissPriming: jest.fn(),
      dismissAccuracyNotice: jest.fn(),
      openSettings: jest.fn<() => Promise<void>>(),
      ...overrides,
    },
  };
}

function idleState(zoom: number): MapState {
  return {
    properties: {
      center: [122.5489, 10.7313],
      bounds: {
        sw: [-180, -85.051129],
        ne: [180, 85.051129],
      },
      zoom,
      heading: 0,
      pitch: 0,
    },
    gestures: { isGestureActive: false },
  };
}

async function triggerIdle(state: MapState): Promise<void> {
  const latestMapProps = mockMapProps[mockMapProps.length - 1];
  if (latestMapProps?.onMapIdle === undefined) throw new Error('Map mock did not receive onMapIdle');
  await act(async (): Promise<void> => {
    latestMapProps.onMapIdle?.(state);
  });
}

async function renderHome(items: GanapListItem[]): Promise<Awaited<ReturnType<typeof render>>> {
  mockUseGanapDiscovery.mockReturnValue(mapHookResult(items));
  return render(<HomeScreen />);
}

beforeAll((): void => {
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = 'test-token';
  const homeModule = require('@/app/(app)/(home)/index') as typeof import('@/app/(app)/(home)/index');
  HomeScreen = homeModule.default;
});

afterAll((): void => {
  if (previousMapboxToken === undefined) {
    delete process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  } else {
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = previousMapboxToken;
  }
});

beforeEach((): void => {
  mockMapProps.length = 0;
  mockMarkerProps.length = 0;
  mockSetCamera.mockClear();
  mockRouterPush.mockClear();
  mockUseGanapDiscovery.mockReset();
});

describe('home map clustering integration', (): void => {
  it('renders no marker for an empty dataset and one bottom-anchored marker for one point', async (): Promise<void> => {
    const emptyScreen = await renderHome([]);
    expect(emptyScreen.queryByTestId(/^map-(event|cluster)-marker-/)).toBeNull();

    await emptyScreen.unmount();
    const single = ganap('single', 122.5489, 10.7313);
    const screen = await renderHome([single]);
    expect(mockMarkerProps).toContainEqual({ anchor: { x: 0.5, y: 1 }, allowOverlap: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Open event Event single' }));
    // The tapped pin becomes the sheet's selection rather than a card of its own.
    expect(screen.getByTestId('feed-sheet-card-single')).toBeTruthy();
  });

  it('automatically zooms a cluster to its leaf pins and keeps the leaf list at the peek', async (): Promise<void> => {
    const items: GanapListItem[] = [ganap('one', 0, 0), ganap('two', 30, 0)];
    const expectedIndex = createGanapClusterIndex(items);
    const normalizedZoom = normalizeClusterZoom(0.9);
    expect(normalizedZoom).toBe(0);
    const expectedCluster: GanapClusterFeature | undefined = getVisibleMapFeatures(expectedIndex, {
      bounds: [-180, -85.051129, 180, 85.051129],
      zoom: normalizedZoom,
    }).find(isClusterFeature);
    if (expectedCluster === undefined) throw new Error('Expected cluster fixture');

    const screen = await renderHome(items);
    await triggerIdle(idleState(0.9));

    const clusterButton = screen.getByRole('button', { name: 'Zoom to group of 2 events' });
    expect(clusterButton).toBeTruthy();
    await fireEvent.press(clusterButton);
    expect(screen.getByTestId('feed-sheet-cluster-mode')).toBeTruthy();
    expect(screen.getByTestId('feed-sheet-card-one')).toBeTruthy();
    expect(screen.getByTestId('feed-sheet-card-two')).toBeTruthy();

    expect(mockSetCamera).toHaveBeenCalledTimes(1);
    expect(mockSetCamera).toHaveBeenCalledWith({
      centerCoordinate: getFeatureCoordinate(expectedCluster),
      zoomLevel: getClusterExpansionZoom(expectedIndex, expectedCluster),
      animationDuration: 300,
      /**
       * Padded so the expanded cluster centres in the map the user can see,
       * rather than behind the search bar or the feed sheet.
       */
      padding: {
        paddingTop: MAP_OVERLAY_TOP,
        paddingBottom: FEED_SHEET_PEEK_HEIGHT,
        paddingLeft: 0,
        paddingRight: 0,
      },
    });
  });

  it('opens the detail screen when a leaf is tapped in the sheet', async (): Promise<void> => {
    const items: GanapListItem[] = [ganap('one', 122.5489, 10.7313), ganap('two', 122.5489, 10.7313)];
    const screen = await renderHome(items);
    await triggerIdle(idleState(0));
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom to group of 2 events' }));
    await fireEvent.press(screen.getByTestId('feed-sheet-card-two'));

    // Every card tap navigates now, including a cluster leaf — the sheet is the
    // detail surface, so there is nothing further to select in place.
    expect(mockRouterPush).toHaveBeenCalledWith(Routes.ganapDetail('two'));
  });

  it('closes a selected cluster safely when the map dataset replaces its index', async (): Promise<void> => {
    const initialItems: GanapListItem[] = [
      ganap('initial-one', 122.5489, 10.7313),
      ganap('initial-two', 122.5489, 10.7313),
    ];
    const screen = await renderHome(initialItems);
    await triggerIdle(idleState(0));
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom to group of 2 events' }));
    expect(screen.getByTestId('feed-sheet-cluster-mode')).toBeTruthy();

    mockUseGanapDiscovery.mockReturnValue(mapHookResult([ganap('replacement', 122.5489, 10.7313)]));
    await screen.rerender(<HomeScreen />);

    expect(screen.queryByTestId('feed-sheet-cluster-mode')).toBeNull();
  });

  it('does not move the camera when a stale cluster press is already at its expansion zoom', async (): Promise<void> => {
    const items: GanapListItem[] = [ganap('one', 122.5489, 10.7313), ganap('two', 122.5489, 10.7313)];
    const index = createGanapClusterIndex(items);
    const cluster: GanapClusterFeature | undefined = getVisibleMapFeatures(index, {
      bounds: [-180, -85.051129, 180, 85.051129],
      zoom: 0,
    }).find(isClusterFeature);
    if (cluster === undefined) throw new Error('Expected cluster fixture');
    const expansionZoom = getClusterExpansionZoom(index, cluster);
    const screen = await renderHome(items);
    await triggerIdle(idleState(0));

    const staleClusterButton = screen.getByRole('button', { name: 'Zoom to group of 2 events' });
    await triggerIdle(idleState(expansionZoom));
    await fireEvent.press(staleClusterButton);

    expect(mockSetCamera).not.toHaveBeenCalled();
  });

  it('toggles Nearby from the filter row', async (): Promise<void> => {
    const toggleNearby = jest.fn();
    mockUseGanapDiscovery.mockReturnValue(mapHookResult([], { toggle: toggleNearby }));

    const { getByLabelText } = await render(<HomeScreen />);
    fireEvent.press(getByLabelText('Show events near me'));

    expect(toggleNearby).toHaveBeenCalledTimes(1);
  });
});
