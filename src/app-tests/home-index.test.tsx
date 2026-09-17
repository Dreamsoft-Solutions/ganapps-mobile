import { describe, expect, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import type { UseGanapDiscoveryResult } from '@/hooks/useGanapDiscovery';
import type { Coords } from '@/services/location.service';
import type { GanapListItem } from '@/types/ganap.types';

interface MarkerProps {
  anchor: { x: number; y: number };
  children?: ReactNode;
}

/**
 * Typed against the real hook result, not a hand-rolled shape: the previous
 * local interface let the screen's contract drift without failing type-check.
 */
type MockMapState = UseGanapDiscoveryResult;

interface MockCameraStop {
  centerCoordinate: [number, number];
  zoomLevel: number;
}

interface GanapFeedSheetStubProps {
  selectedGanap: GanapListItem | null;
  onSelectGanap: (ganap: GanapListItem) => void;
}

const mockCapturedAnchors: Array<{ x: number; y: number }> = [];
const mockRouter = {
  push: jest.fn<(href: unknown) => void>(),
};
const mockGanap: GanapListItem = {
  id: 'ganap_1',
  businessId: 'business_1',
  businessName: 'CPU Developers',
  slug: 'coffee-and-code',
  title: 'Coffee & Code',
  description: 'Bring a laptop.',
  address: 'Student Union',
  locationLat: 10.7313,
  locationLong: 122.5489,
  startDate: '2026-08-08T02:00:00.000Z',
  endDate: '2026-08-08T04:00:00.000Z',
  attendanceOpenMinutesBefore: 30,
  tags: ['study'],
  coverImage: null,
  mapPinImage: null,
  registrationCount: 5,
  likesCount: 2,
  createdAt: '2026-08-01T00:00:00.000Z',
};
const mockMapState: MockMapState = {
  filters: {},
  search: '',
  setSearch: jest.fn<(value: string) => void>(),
  tag: null,
  setTag: jest.fn<(value: string | null) => void>(),
  tags: [],
  map: {
    items: [mockGanap],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn<MockMapState['map']['refetch']>(),
  },
  feed: {
    items: [mockGanap],
    isLoading: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: jest.fn<MockMapState['feed']['fetchNextPage']>(),
    isFetchingNextPage: false,
    join: jest.fn<MockMapState['feed']['join']>(),
    leave: jest.fn<MockMapState['feed']['leave']>(),
    toggleLike: jest.fn<MockMapState['feed']['toggleLike']>(),
    toggleSave: jest.fn<MockMapState['feed']['toggleSave']>(),
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
  },
};
const mockSetCamera = jest.fn<(stop: MockCameraStop) => void>();
const mockUseGanapDiscovery = jest.fn<() => MockMapState>(() => mockMapState);
const mockGanapFeedSheet = jest.fn<(props: GanapFeedSheetStubProps) => ReactElement>();

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  return {
    LucideProvider: ({ children }: { children?: ReactNode }): ReactElement =>
      React.createElement(React.Fragment, null, children),
    X: (): null => null,
    LocateFixed: (): null => null,
  };
});

jest.mock('@rnmapbox/maps', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: { setAccessToken: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) },
    Camera: React.forwardRef((_props: unknown, ref: React.Ref<{ setCamera: (stop: MockCameraStop) => void }>): null => {
      React.useImperativeHandle(ref, (): { setCamera: (stop: MockCameraStop) => void } => ({
        setCamera: mockSetCamera,
      }));
      return null;
    }),
    LocationPuck: (): null => null,
    MapView: ({
      children,
      onDidFinishLoadingMap,
    }: {
      children?: ReactNode;
      onDidFinishLoadingMap?: () => void;
    }): ReactElement => {
      React.useEffect((): void => onDidFinishLoadingMap?.(), [onDidFinishLoadingMap]);
      return React.createElement(View, null, children);
    },
    MarkerView: ({ anchor, children }: MarkerProps): ReactElement => {
      mockCapturedAnchors.push(anchor);
      return React.createElement(View, null, children);
    },
  };
});

jest.mock('expo-router', () => ({
  useRouter: (): typeof mockRouter => mockRouter,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; right: number; bottom: number; left: number } => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }),
}));

jest.mock('@/hooks/useGanapDiscovery', () => ({
  useGanapDiscovery: (): MockMapState => mockUseGanapDiscovery(),
}));

jest.mock('@/components/map/MapSearchBar', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    MapSearchBar: (): ReactElement => React.createElement(View, { testID: 'map-search-bar' }),
  };
});

jest.mock('@/components/map/TagChips', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    TagChips: (): ReactElement => React.createElement(View, { testID: 'tag-chips' }),
  };
});

jest.mock('@/components/map/GanapMapPin', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    GanapMapPin: ({ ganap }: { ganap: GanapListItem }): ReactElement =>
      React.createElement(View, { testID: 'ganap-map-pin-child', accessibilityLabel: ganap.title }),
  };
});

jest.mock('@/components/map/GanapFeedSheet', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text, View } = require('react-native') as typeof import('react-native');
  mockGanapFeedSheet.mockImplementation(
    ({ selectedGanap, onSelectGanap }: GanapFeedSheetStubProps): ReactElement =>
      React.createElement(
        View,
        { testID: 'ganap-feed-sheet' },
        selectedGanap
          ? React.createElement(
              Pressable,
              {
                testID: 'selected-ganap-card',
                accessibilityRole: 'button',
                onPress: (): void => onSelectGanap(selectedGanap),
              },
              React.createElement(Text, null, selectedGanap.title),
            )
          : null,
      ),
  );
  return {
    GanapFeedSheet: (props: GanapFeedSheetStubProps): ReactElement => mockGanapFeedSheet(props),
  };
});

jest.mock('@/components/common/Error', () => ({
  ErrorView: (): ReactElement => {
    const React = require('react') as typeof import('react');
    const { View } = require('react-native') as typeof import('react-native');
    return React.createElement(View);
  },
}));

jest.mock('@/components/common/Loading', () => ({
  Loading: (): ReactElement => {
    const React = require('react') as typeof import('react');
    const { View } = require('react-native') as typeof import('react-native');
    return React.createElement(View);
  },
}));

jest.mock('@/components/common/Text', () => ({
  Text: ({ children }: { children?: ReactNode }): ReactElement => {
    const React = require('react') as typeof import('react');
    const { Text: NativeText } = require('react-native') as typeof import('react-native');
    return React.createElement(NativeText, null, children);
  },
}));

process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN = 'test-token';

const HomeScreen = require('@/app/(app)/(home)/index').default as () => ReactElement;

describe('Home map event markers', (): void => {
  beforeEach((): void => {
    mockCapturedAnchors.length = 0;
    mockGanapFeedSheet.mockClear();
    mockRouter.push.mockClear();
    mockSetCamera.mockClear();
    mockMapState.map.isLoading = false;
    mockMapState.nearby.coords = null;
  });

  it('centres on the user when the position arrives while the events query is still loading', async (): Promise<void> => {
    mockMapState.map.isLoading = true;
    mockMapState.nearby.coords = { latitude: 10.71, longitude: 122.55 };

    const screen = await render(<HomeScreen />);

    expect(mockSetCamera).not.toHaveBeenCalled();

    mockMapState.map.isLoading = false;
    await screen.rerender(<HomeScreen />);

    expect(mockSetCamera).toHaveBeenCalledTimes(1);
    expect(mockSetCamera.mock.calls[0]?.[0].centerCoordinate).toEqual([122.55, 10.71]);
  });

  it('anchors an individual event marker at the visible pin tip and preserves selection', async (): Promise<void> => {
    const screen = await render(<HomeScreen />);

    const distinctAnchors = mockCapturedAnchors.filter(
      (anchor, index): boolean =>
        mockCapturedAnchors.findIndex((other): boolean => other.x === anchor.x && other.y === anchor.y) === index,
    );

    expect(distinctAnchors).toEqual([{ x: 0.5, y: 1 }]);

    await fireEvent.press(screen.getByTestId('ganap-map-pin-child'));

    expect(screen.getByTestId('selected-ganap-card')).toBeTruthy();
    const sheetProps = mockGanapFeedSheet.mock.calls.at(-1)?.[0];
    expect(sheetProps?.selectedGanap).toBe(mockGanap);
    expect(screen.getByText(mockGanap.title)).toBeTruthy();
  });
});
