import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { MapState } from '@rnmapbox/maps';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Routes } from '@/constants/routes';
import type { UseGanapDiscoveryResult } from '@/hooks/useGanapDiscovery';
import type { Coords } from '@/services/location.service';
import { useThemeStore } from '@/store/theme.store';
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

const mockMapProps: Array<{
  styleURL?: string;
  onMapIdle?: (state: MapState) => void;
  onCameraChanged?: (state: MapState) => void;
  onPress?: () => void;
}> = [];
const mockTerrainSourceProps: Array<{ id: string; url?: string; tileSize?: number; maxZoomLevel?: number }> = [];
const mockBuildingLayerProps: Array<{
  id: string;
  sourceID?: string;
  sourceLayerID?: string;
  minZoomLevel?: number;
  maxZoomLevel?: number;
  filter?: unknown;
  style?: unknown;
}> = [];
const mockMarkerProps: Array<{ anchor?: { x: number; y: number }; allowOverlap?: boolean }> = [];
const mockSetCamera =
  jest.fn<
    (config: {
      centerCoordinate: [number, number];
      zoomLevel: number;
      heading?: number;
      pitch?: number;
      animationDuration: number;
      padding: { paddingTop: number; paddingBottom: number; paddingLeft: number; paddingRight: number };
    }) => void
  >();
const mockUseGanapDiscovery = jest.fn<() => UseGanapDiscoveryResult>();
const mockRouterPush = jest.fn<(href: unknown) => void>();

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native') as typeof import('react-native');
  const React = require('react') as typeof import('react');
  return {
    __esModule: true,
    default: { View: ReactNative.View },
    useSharedValue: (value: number): { value: number } => React.useRef({ value }).current,
    useAnimatedStyle: (updater: () => unknown): unknown => updater(),
  };
});

jest.mock('@expo/ui/community/slider', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');
  return {
    Slider: (props: { onValueChange?: (value: number) => void; value?: number }): ReactElement =>
      React.createElement(ReactNative.View, { ...props, testID: 'map-pitch-slider' }),
  };
});

jest.mock('@rnmapbox/maps', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');

  const MockMapView = ({
    children,
    styleURL,
    onMapIdle,
    onCameraChanged,
    onPress,
  }: {
    children?: ReactNode;
    styleURL?: string;
    onMapIdle?: (state: MapState) => void;
    onCameraChanged?: (state: MapState) => void;
    onPress?: () => void;
  }): ReactElement => {
    mockMapProps.push({ styleURL, onMapIdle, onCameraChanged, onPress });
    return React.createElement(ReactNative.View, null, children);
  };

  const MockRasterDemSource = ({
    children,
    id,
    url,
    tileSize,
    maxZoomLevel,
  }: {
    children?: ReactNode;
    id: string;
    url?: string;
    tileSize?: number;
    maxZoomLevel?: number;
  }): ReactElement => {
    mockTerrainSourceProps.push({ id, url, tileSize, maxZoomLevel });
    return React.createElement(ReactNative.View, { testID: `terrain-source-${id}` }, children);
  };

  const MockTerrain = ({ sourceID }: { sourceID?: string }): ReactElement =>
    React.createElement(ReactNative.View, { testID: `terrain-layer-${sourceID ?? 'missing-source'}` });

  const MockFillExtrusionLayer = ({
    id,
    sourceID,
    sourceLayerID,
    minZoomLevel,
    maxZoomLevel,
    filter,
    style,
  }: {
    id: string;
    sourceID?: string;
    sourceLayerID?: string;
    minZoomLevel?: number;
    maxZoomLevel?: number;
    filter?: unknown;
    style?: unknown;
  }): ReactElement => {
    mockBuildingLayerProps.push({ id, sourceID, sourceLayerID, minZoomLevel, maxZoomLevel, filter, style });
    return React.createElement(ReactNative.View, { testID: `building-extrusion-layer-${id}` });
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
    default: {
      setAccessToken: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      StyleURL: { Dark: 'mapbox://styles/mapbox/dark-v11' },
    },
    MapView: MockMapView,
    MarkerView: MockMarkerView,
    Camera: MockCamera,
    RasterDemSource: MockRasterDemSource,
    Terrain: MockTerrain,
    FillExtrusionLayer: MockFillExtrusionLayer,
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
jest.mock('@/components/map/MapSearchBar', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');

  return {
    MapSearchBar: ({
      value,
      suggestions,
      isErrorSuggestions,
      onSelectSuggestion,
    }: {
      value: string;
      suggestions: GanapListItem[];
      isErrorSuggestions: boolean;
      onSelectSuggestion: (ganap: GanapListItem) => void;
    }): ReactElement =>
      React.createElement(
        ReactNative.View,
        { testID: 'map-search-value', accessibilityLabel: `Search: ${value}` },
        ...(isErrorSuggestions
          ? [React.createElement(ReactNative.Text, { key: 'search-error' }, "Couldn't load event suggestions.")]
          : suggestions.map(
              (suggestion: GanapListItem): ReactElement =>
                React.createElement(
                  ReactNative.Pressable,
                  {
                    key: suggestion.id,
                    testID: `map-search-suggestion-${suggestion.id}`,
                    accessibilityRole: 'button',
                    accessibilityLabel: suggestion.title,
                    onPress: (): void => onSelectSuggestion(suggestion),
                  },
                  React.createElement(ReactNative.Text, null, suggestion.title),
                ),
            )),
      ),
  };
});
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
              if (target !== null) {
                onZoomToCluster(target);
                onClearSelection('keep-current');
              }
            },
          })
        : null,
      React.createElement(ReactNative.Pressable, {
        accessibilityRole: 'button',
        accessibilityLabel: 'Close events list',
        onPress: (): void => onClearSelection(),
      }),
    );
  },
}));

interface GanapFeedSheetStubProps {
  selectedGanap: GanapListItem | null;
  selectedCluster: GanapClusterFeature | null;
  clusterIndex: GanapClusterIndex;
  onSelectGanap: (ganap: GanapListItem) => void;
  onClearSelection: (reason?: 'keep-current') => void;
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
      isFetching: false,
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

function idleState(
  zoom: number,
  center: [number, number] = [122.5489, 10.7313],
  isGestureActive: boolean = false,
): MapState {
  return {
    properties: {
      center,
      bounds: {
        sw: [-180, -85.051129],
        ne: [180, 85.051129],
      },
      zoom,
      heading: 0,
      pitch: 0,
    },
    gestures: { isGestureActive },
  };
}

function cameraFrame(pitch: number, isGestureActive: boolean = false): MapState {
  const state: MapState = idleState(16.5, [0, 0], isGestureActive);
  return { ...state, properties: { ...state.properties, pitch } };
}

async function triggerIdle(state: MapState): Promise<void> {
  const latestMapProps = mockMapProps[mockMapProps.length - 1];
  if (latestMapProps?.onMapIdle === undefined) throw new Error('Map mock did not receive onMapIdle');
  await act(async (): Promise<void> => {
    latestMapProps.onMapIdle?.(state);
  });
}

async function triggerMapPress(): Promise<void> {
  const latestMapProps = mockMapProps[mockMapProps.length - 1];
  if (latestMapProps?.onPress === undefined) throw new Error('Map mock did not receive onPress');
  await act(async (): Promise<void> => {
    latestMapProps.onPress?.();
  });
}

async function triggerCameraChanged(state: MapState): Promise<void> {
  const latestMapProps = mockMapProps[mockMapProps.length - 1];
  if (latestMapProps?.onCameraChanged === undefined) {
    throw new Error('Map mock did not receive onCameraChanged');
  }
  await act(async (): Promise<void> => {
    latestMapProps.onCameraChanged?.(state);
  });
}

async function renderHome(items: GanapListItem[]): Promise<Awaited<ReturnType<typeof render>>> {
  mockUseGanapDiscovery.mockReturnValue(mapHookResult(items));
  return render(<HomeScreen />);
}

/**
 * Renders and discards Home once so the first test doesn't pay the cold first render. On a
 * loaded CI runner that cost alone can exceed Jest's 5-second per-test limit.
 *
 * @returns Resolves once the warm-up render has unmounted
 */
async function warmUpHomeScreen(): Promise<void> {
  const warmUp = await renderHome([]);
  await warmUp.unmount();
}

beforeAll(async (): Promise<void> => {
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = 'test-token';
  const homeModule = require('@/app/(app)/(home)/index') as typeof import('@/app/(app)/(home)/index');
  HomeScreen = homeModule.default;
  await warmUpHomeScreen();
}, 30_000);

afterAll((): void => {
  if (previousMapboxToken === undefined) {
    delete process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  } else {
    process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = previousMapboxToken;
  }
});

beforeEach((): void => {
  useThemeStore.setState({ mode: 'light' });
  mockMapProps.length = 0;
  mockMarkerProps.length = 0;
  mockTerrainSourceProps.length = 0;
  mockBuildingLayerProps.length = 0;
  mockSetCamera.mockClear();
  mockRouterPush.mockClear();
  mockUseGanapDiscovery.mockReset();
});

describe('home map clustering integration', (): void => {
  it('switches the mounted map style without resetting its camera', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0)]);
    await fireEvent.press(screen.getByTestId('map-event-marker-one'));
    await triggerIdle({
      ...idleState(14, [20, 10]),
      properties: { ...idleState(14, [20, 10]).properties, heading: 90, pitch: 35 },
    });
    expect(mockMapProps.at(-1)?.styleURL).toBe('mapbox://styles/mapbox/streets-v12');
    const cameraCalls = mockSetCamera.mock.calls.length;
    await act(async (): Promise<void> => {
      useThemeStore.setState({ mode: 'dark' });
    });
    expect(mockMapProps.at(-1)?.styleURL).toBe('mapbox://styles/mapbox/dark-v11');
    expect(mockSetCamera).toHaveBeenCalledTimes(cameraCalls);
    expect(screen.getByTestId('feed-sheet-card-one')).toBeTruthy();
    expect(screen.getByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeTruthy();
    expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();
  });

  it('adjusts pitch and resets pitch and bearing without moving the map', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0)]);
    expect(screen.queryByLabelText('Map pitch')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Map view controls' }));
    const currentView: MapState = idleState(14, [20, 10]);
    await triggerIdle({ ...currentView, properties: { ...currentView.properties, heading: 90, pitch: 40 } });
    await fireEvent(screen.getByTestId('map-pitch-slider', { includeHiddenElements: true }), 'valueChange', 35);
    expect(mockSetCamera).toHaveBeenLastCalledWith(
      expect.objectContaining({ pitch: 35, centerCoordinate: [20, 10], zoomLevel: 14 }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Return to overhead view' }));
    expect(mockSetCamera).toHaveBeenLastCalledWith(
      expect.objectContaining({ pitch: 0, heading: 0, centerCoordinate: [20, 10], zoomLevel: 14 }),
    );
  });

  it('toggles only buildings while keeping the selected event and terrain', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0)]);
    await fireEvent.press(screen.getByTestId('map-event-marker-one'));
    expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Map view controls' }));
    await fireEvent(screen.getByLabelText('Show 3D buildings'), 'valueChange', false);
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();
    expect(screen.getByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeTruthy();
    expect(screen.getByTestId('feed-sheet-card-one')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Show 3D buildings'), 'valueChange', true);
    expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();
  });

  it('shows 3D buildings without a selection once the map is tilted, and hides them when toggled off', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0)]);
    await triggerIdle(idleState(17));
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Map view controls' }));
    await fireEvent(screen.getByTestId('map-pitch-slider', { includeHiddenElements: true }), 'valueChange', 45);
    expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();
    expect(screen.queryByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeNull();

    await fireEvent(screen.getByLabelText('Show 3D buildings'), 'valueChange', false);
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();
  });

  it('keeps 3D buildings off in the overhead view while the toggle stays on', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0)]);
    const tiltedView: MapState = idleState(17);
    await triggerIdle({ ...tiltedView, properties: { ...tiltedView.properties, pitch: 40 } });
    expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Map view controls' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Return to overhead view' }));
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();
  });

  it('hides 3D buildings but keeps terrain when a selected event returns to the overhead view', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0)]);
    await fireEvent.press(screen.getByTestId('map-event-marker-one'));
    expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Map view controls' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Return to overhead view' }));
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();
    expect(screen.getByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeTruthy();
    expect(screen.getByTestId('feed-sheet-card-one')).toBeTruthy();
  });

  it('keeps 3D buildings off while closing an event animates the camera back to overhead', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0)]);
    await fireEvent.press(screen.getByTestId('map-event-marker-one'));
    await fireEvent.press(screen.getByLabelText('Close events list'));
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();

    for (const pitch of [79.9, 40, 10]) {
      await triggerCameraChanged(cameraFrame(pitch));
      expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();
    }
    await triggerIdle(cameraFrame(0));
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();
  });

  it('keeps 3D buildings on while selecting an event animates the camera up', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0)]);
    await fireEvent.press(screen.getByTestId('map-event-marker-one'));
    expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();

    for (const pitch of [0.01, 0.3, 40]) {
      await triggerCameraChanged(cameraFrame(pitch));
      expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();
    }
  });

  it('shows 3D buildings while a two-finger tilt is still in progress without a selection', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0)]);
    await triggerIdle(cameraFrame(0));
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();

    await triggerCameraChanged(cameraFrame(40, true));
    expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();
  });

  it('renders expanded pins during camera changes before map idle', async (): Promise<void> => {
    const screen = await renderHome([ganap('one', 0, 0), ganap('two', 30, 0)]);
    await triggerIdle(idleState(0.9));
    expect(screen.getByRole('button', { name: 'Zoom to group of 2 events' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom to group of 2 events' }));
    await triggerCameraChanged(idleState(17));
    expect(screen.getByTestId('map-event-marker-one')).toBeTruthy();
    expect(screen.getByTestId('map-event-marker-two')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zoom to group of 2 events' })).toBeNull();
  });

  it('renders no marker for an empty dataset and one bottom-anchored marker for one point', async (): Promise<void> => {
    const emptyScreen = await renderHome([]);
    expect(emptyScreen.queryByTestId(/^map-(event|cluster)-marker-/)).toBeNull();

    await emptyScreen.unmount();
    const single = ganap('single', 122.5489, 10.7313);
    const screen = await renderHome([single]);
    const originalView = idleState(13.25, [121.8, 10.6]);
    await triggerIdle(originalView);
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();
    expect(mockMarkerProps).toContainEqual({ anchor: { x: 0.5, y: 1 }, allowOverlap: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Open event Event single' }));
    // The tapped pin becomes the sheet's selection rather than a card of its own.
    expect(screen.getByTestId('feed-sheet-card-single')).toBeTruthy();
    expect(screen.getByTestId('terrain-source-ganapps-map-terrain-dem')).toBeTruthy();
    expect(screen.getByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeTruthy();
    expect(screen.getByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeTruthy();
    expect(mockBuildingLayerProps).toContainEqual({
      id: 'ganapps-map-building-height',
      sourceID: 'composite',
      sourceLayerID: 'building',
      minZoomLevel: 16,
      maxZoomLevel: 22,
      filter: ['all', ['==', ['get', 'extrude'], 'true'], ['has', 'height']],
      style: {
        fillExtrusionColor: '#9ca3af',
        fillExtrusionHeight: ['to-number', ['get', 'height'], 0],
        fillExtrusionBase: ['to-number', ['get', 'min_height'], 0],
        fillExtrusionOpacity: 0.9,
        fillExtrusionVerticalGradient: true,
      },
    });
    expect(mockTerrainSourceProps).toContainEqual({
      id: 'ganapps-map-terrain-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxZoomLevel: 14,
    });
    expect(mockSetCamera).toHaveBeenCalledWith({
      centerCoordinate: [single.locationLong, single.locationLat],
      zoomLevel: 16.5,
      pitch: 80,
      animationDuration: 500,
      padding: {
        paddingTop: MAP_OVERLAY_TOP,
        paddingBottom: FEED_SHEET_PEEK_HEIGHT,
        paddingLeft: 0,
        paddingRight: 0,
      },
    });

    await fireEvent.press(screen.getByLabelText('Close events list'));
    expect(screen.queryByTestId('terrain-source-ganapps-map-terrain-dem')).toBeNull();
    expect(screen.queryByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeNull();
    expect(screen.queryByTestId('building-extrusion-layer-ganapps-map-building-height')).toBeNull();
    expect(mockSetCamera).toHaveBeenLastCalledWith({
      centerCoordinate: originalView.properties.center,
      zoomLevel: originalView.properties.zoom,
      heading: originalView.properties.heading,
      pitch: 0,
      animationDuration: 500,
      padding: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
    });
  });

  it('clears a selected area on an empty map tap and restores the previous overhead view', async (): Promise<void> => {
    jest.useFakeTimers();
    try {
      const single = ganap('blank-tap', 122.5489, 10.7313);
      const screen = await renderHome([single]);
      const originalView = idleState(12.75, [121.9, 10.65]);
      await triggerIdle(originalView);
      await fireEvent.press(screen.getByRole('button', { name: 'Open event Event blank-tap' }));
      expect(screen.getByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeTruthy();

      await act(async (): Promise<void> => {
        jest.advanceTimersByTime(100);
      });
      await triggerMapPress();
      await act(async (): Promise<void> => {
        jest.advanceTimersByTime(151);
      });

      expect(screen.queryByTestId('ganap-feed-sheet')).toBeNull();
      expect(screen.queryByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeNull();
      expect(mockSetCamera).toHaveBeenLastCalledWith({
        centerCoordinate: originalView.properties.center,
        zoomLevel: originalView.properties.zoom,
        heading: originalView.properties.heading,
        pitch: 0,
        animationDuration: 500,
        padding: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not clear a marker selection when its press also reaches the map listener', async (): Promise<void> => {
    jest.useFakeTimers();
    try {
      const single = ganap('tap-propagation', 122.5489, 10.7313);
      const screen = await renderHome([single]);
      await triggerIdle(idleState(12));
      const marker = screen.getByRole('button', { name: 'Open event Event tap-propagation' });
      await fireEvent.press(marker);

      await act(async (): Promise<void> => {
        jest.advanceTimersByTime(100);
      });
      await triggerMapPress();
      await fireEvent.press(marker);
      await act(async (): Promise<void> => {
        jest.advanceTimersByTime(151);
      });

      expect(screen.getByTestId('feed-sheet-card-tap-propagation')).toBeTruthy();
      expect(screen.getByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not clear a marker selection when the map press follows the marker press', async (): Promise<void> => {
    jest.useFakeTimers();
    try {
      const single = ganap('reverse-tap-propagation', 122.5489, 10.7313);
      const screen = await renderHome([single]);
      await triggerIdle(idleState(12));
      const marker = screen.getByRole('button', { name: 'Open event Event reverse-tap-propagation' });
      await fireEvent.press(marker);
      await triggerMapPress();
      await act(async (): Promise<void> => {
        jest.advanceTimersByTime(151);
      });

      expect(screen.getByTestId('feed-sheet-card-reverse-tap-propagation')).toBeTruthy();
      expect(screen.getByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the original camera view when a different marker is selected before clearing', async (): Promise<void> => {
    const first = ganap('first-selection', 122.5489, 10.7313);
    const second = ganap('second-selection', 122.8, 10.7313);
    const screen = await renderHome([first, second]);
    const originalView = idleState(12.5, [121.8, 10.6]);
    await triggerIdle(originalView);

    await fireEvent.press(screen.getByRole('button', { name: 'Open event Event first-selection' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open event Event second-selection' }));

    expect(screen.getByTestId('feed-sheet-card-second-selection')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close events list'));

    expect(mockSetCamera).toHaveBeenLastCalledWith({
      centerCoordinate: originalView.properties.center,
      zoomLevel: originalView.properties.zoom,
      heading: originalView.properties.heading,
      pitch: 0,
      animationDuration: 500,
      padding: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
    });
  });

  it('keeps the user-adjusted center and zoom when clearing after a camera gesture', async (): Promise<void> => {
    const single = ganap('gesture', 122.5489, 10.7313);
    const screen = await renderHome([single]);
    await triggerIdle(idleState(12.5, [121.9, 10.65]));
    await fireEvent.press(screen.getByRole('button', { name: 'Open event Event gesture' }));

    await triggerCameraChanged(idleState(13.25, [120.4, 11.2], true));
    await triggerCameraChanged(idleState(13.25, [120.4, 11.2]));
    await fireEvent.press(screen.getByLabelText('Close events list'));

    expect(mockSetCamera).toHaveBeenLastCalledWith({
      centerCoordinate: [120.4, 11.2],
      zoomLevel: 13.25,
      heading: 0,
      pitch: 0,
      animationDuration: 500,
      padding: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
    });
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
    expect(screen.queryByTestId('ganap-feed-sheet')).toBeNull();
    const originalView = idleState(0.9, [40, 20]);
    await triggerIdle(originalView);

    const clusterButton = screen.getByRole('button', { name: 'Zoom to group of 2 events' });
    expect(clusterButton).toBeTruthy();
    await fireEvent.press(clusterButton);
    expect(screen.getByTestId('feed-sheet-cluster-mode')).toBeTruthy();
    expect(screen.getByTestId('feed-sheet-card-one')).toBeTruthy();
    expect(screen.getByTestId('feed-sheet-card-two')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Close events list'));
    expect(screen.queryByTestId('feed-sheet-cluster-mode')).toBeNull();
    expect(screen.queryByTestId('ganap-feed-sheet')).toBeNull();

    expect(mockSetCamera).toHaveBeenCalledTimes(2);
    expect(mockSetCamera).toHaveBeenNthCalledWith(1, {
      centerCoordinate: getFeatureCoordinate(expectedCluster),
      zoomLevel: getClusterExpansionZoom(expectedIndex, expectedCluster),
      pitch: 80,
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
    expect(mockSetCamera).toHaveBeenNthCalledWith(2, {
      centerCoordinate: originalView.properties.center,
      zoomLevel: originalView.properties.zoom,
      heading: originalView.properties.heading,
      pitch: 0,
      animationDuration: 500,
      padding: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
    });
  });

  it('clears a cluster after zoom-in while keeping its expanded center and zoom overhead', async (): Promise<void> => {
    const items: GanapListItem[] = [
      ganap('zoom-clear-one', 122.5489, 10.7313),
      ganap('zoom-clear-two', 122.5489, 10.7313),
    ];
    const expectedIndex = createGanapClusterIndex(items);
    const expectedCluster: GanapClusterFeature | undefined = getVisibleMapFeatures(expectedIndex, {
      bounds: [-180, -85.051129, 180, 85.051129],
      zoom: 0,
    }).find(isClusterFeature);
    if (expectedCluster === undefined) throw new Error('Expected cluster fixture');
    const expansionZoom = getClusterExpansionZoom(expectedIndex, expectedCluster);
    const clusterCenter = getFeatureCoordinate(expectedCluster);
    if (clusterCenter === null) throw new Error('Expected cluster coordinate');

    const screen = await renderHome(items);
    await triggerIdle(idleState(0));
    await fireEvent.press(screen.getByRole('button', { name: 'Zoom to group of 2 events' }));
    expect(screen.getByTestId('feed-sheet-cluster-mode')).toBeTruthy();

    await triggerIdle(idleState(expansionZoom, clusterCenter));
    await fireEvent.press(screen.getByLabelText('Zoom in to this area'));

    expect(screen.queryByTestId('feed-sheet-cluster-mode')).toBeNull();
    expect(screen.queryByTestId('terrain-layer-ganapps-map-terrain-dem')).toBeNull();
    expect(mockSetCamera).toHaveBeenCalledTimes(2);
    expect(mockSetCamera).toHaveBeenLastCalledWith({
      centerCoordinate: clusterCenter,
      zoomLevel: expansionZoom,
      heading: 0,
      pitch: 0,
      animationDuration: 500,
      padding: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
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

  it('centers on a search suggestion while preserving the search text', async (): Promise<void> => {
    const suggestion = ganap('search-result', 122.572, 10.728);
    const discovery = mapHookResult([suggestion]);
    const setSearch = jest.fn<(value: string) => void>();
    discovery.search = 'developer meetup';
    discovery.setSearch = setSearch;
    mockUseGanapDiscovery.mockReturnValue(discovery);

    const screen = await render(<HomeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: suggestion.title }));

    expect(mockSetCamera).toHaveBeenCalledWith({
      centerCoordinate: [suggestion.locationLong, suggestion.locationLat],
      zoomLevel: 13.4,
      pitch: 0,
      animationDuration: 500,
      padding: {
        paddingTop: MAP_OVERLAY_TOP,
        paddingBottom: FEED_SHEET_PEEK_HEIGHT,
        paddingLeft: 0,
        paddingRight: 0,
      },
    });
    expect(setSearch).not.toHaveBeenCalled();
    expect(screen.getByTestId('map-search-value').props.accessibilityLabel).toBe('Search: developer meetup');
  });

  it('keeps the map available and reports a failed active search', async (): Promise<void> => {
    const staleSuggestion = ganap('stale-search-result', 122.572, 10.728);
    const discovery = mapHookResult([staleSuggestion]);
    discovery.search = 'developer meetup';
    discovery.filters = { search: 'developer meetup' };
    discovery.map.isError = true;
    mockUseGanapDiscovery.mockReturnValue(discovery);

    const screen = await render(<HomeScreen />);

    expect(screen.getByTestId('mock-camera')).toBeTruthy();
    expect(screen.getByTestId('map-search-value')).toBeTruthy();
    expect(screen.getByText("Couldn't load event suggestions.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: staleSuggestion.title })).toBeNull();
  });
});
