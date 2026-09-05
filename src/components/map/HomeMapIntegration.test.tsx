import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { MapState } from '@rnmapbox/maps';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import type { UseGanapsMapResult } from '@/hooks/useGanapsMap';
import type { GanapListItem } from '@/types/ganap.types';
import {
  createGanapClusterIndex,
  type GanapClusterFeature,
  getClusterExpansionZoom,
  getFeatureCoordinate,
  getVisibleMapFeatures,
  isClusterFeature,
  normalizeClusterZoom,
} from '@/utils/map-clustering';

const mockMapProps: Array<{ onMapIdle?: (state: MapState) => void }> = [];
const mockMarkerProps: Array<{ anchor?: { x: number; y: number }; allowOverlap?: boolean }> = [];
const mockSetCamera =
  jest.fn<(config: { centerCoordinate: [number, number]; zoomLevel: number; animationDuration: number }) => void>();
const mockUseGanapsMap = jest.fn<() => UseGanapsMapResult>();
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

jest.mock('@/hooks/useGanapsMap', () => ({ useGanapsMap: mockUseGanapsMap }));
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
jest.mock('@/components/map/SelectedGanapCard', () => ({
  SelectedGanapCard: ({ ganap, onPress }: { ganap: GanapListItem; onPress: () => void }): ReactElement => {
    const React = require('react') as typeof import('react');
    const ReactNative = require('react-native') as typeof import('react-native');
    return React.createElement(
      ReactNative.Pressable,
      {
        testID: 'selected-ganap-card',
        accessibilityRole: 'button',
        accessibilityLabel: `Open event details for ${ganap.title}`,
        onPress,
      },
      React.createElement(ReactNative.Text, null, ganap.title),
    );
  },
}));

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

function mapHookResult(items: GanapListItem[], overrides: Partial<UseGanapsMapResult> = {}): UseGanapsMapResult {
  return {
    items,
    tags: [],
    search: '',
    setSearch: jest.fn(),
    tag: null,
    setTag: jest.fn(),
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn<UseGanapsMapResult['refetch']>(),
    isNearbyActive: false,
    isNearbyDisabled: false,
    toggleNearby: jest.fn(),
    userCoords: null,
    isPrimingVisible: false,
    confirmPriming: jest.fn<() => Promise<void>>(),
    dismissPriming: jest.fn(),
    isAccuracyNoticeVisible: false,
    dismissAccuracyNotice: jest.fn(),
    openLocationSettings: jest.fn<() => Promise<void>>(),
    locationErrorMessage: null,
    ...overrides,
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
  mockUseGanapsMap.mockReturnValue(mapHookResult(items));
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
  mockUseGanapsMap.mockReset();
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
    expect(screen.getByTestId('selected-ganap-card')).toBeTruthy();
  });

  it('uses onMapIdle bounds and floored zoom to expose a cluster, list leaves, and zoom to expansion', async (): Promise<void> => {
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

    const clusterButton = screen.getByRole('button', { name: 'Open group of 2 events' });
    expect(clusterButton).toBeTruthy();
    await fireEvent.press(clusterButton);
    expect(screen.getByTestId('cluster-events-sheet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open event Event one' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open event Event two' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));
    expect(mockSetCamera).toHaveBeenCalledWith({
      centerCoordinate: getFeatureCoordinate(expectedCluster),
      zoomLevel: getClusterExpansionZoom(expectedIndex, expectedCluster),
      animationDuration: 300,
    });
  });

  it('selects a leaf from the sheet through the existing selected-Ganap card flow', async (): Promise<void> => {
    const items: GanapListItem[] = [ganap('one', 122.5489, 10.7313), ganap('two', 122.5489, 10.7313)];
    const screen = await renderHome(items);
    await triggerIdle(idleState(0));
    await fireEvent.press(screen.getByRole('button', { name: 'Open group of 2 events' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open event Event two' }));

    expect(screen.getByTestId('selected-ganap-card')).toBeTruthy();
    expect(screen.getByText('Event two')).toBeTruthy();
  });

  it('closes a selected cluster safely when the map dataset replaces its index', async (): Promise<void> => {
    const initialItems: GanapListItem[] = [
      ganap('initial-one', 122.5489, 10.7313),
      ganap('initial-two', 122.5489, 10.7313),
    ];
    const screen = await renderHome(initialItems);
    await triggerIdle(idleState(0));
    await fireEvent.press(screen.getByRole('button', { name: 'Open group of 2 events' }));
    expect(screen.getByTestId('cluster-events-sheet')).toBeTruthy();

    mockUseGanapsMap.mockReturnValue(mapHookResult([ganap('replacement', 122.5489, 10.7313)]));
    await screen.rerender(<HomeScreen />);

    expect(screen.queryByTestId('cluster-events-sheet')).toBeNull();
  });

  it('toggles Nearby from the filter row', async (): Promise<void> => {
    const toggleNearby = jest.fn();
    mockUseGanapsMap.mockReturnValue(mapHookResult([], { toggleNearby }));

    const { getByLabelText } = await render(<HomeScreen />);
    fireEvent.press(getByLabelText('Show events near me'));

    expect(toggleNearby).toHaveBeenCalledTimes(1);
  });
});
