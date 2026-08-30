import { describe, expect, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import type { GanapListItem } from '@/types/ganap.types';

interface MarkerProps {
  anchor: { x: number; y: number };
  children?: ReactNode;
}

interface MockMapState {
  items: GanapListItem[];
  tags: string[];
  search: string;
  setSearch: (value: string) => void;
  tag: string | null;
  setTag: (value: string | null) => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

interface SelectedGanapCardProps {
  ganap: GanapListItem;
  onClose: () => void;
  onPress: () => void;
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
  items: [mockGanap],
  tags: [],
  search: '',
  setSearch: jest.fn<(value: string) => void>(),
  tag: null,
  setTag: jest.fn<(value: string | null) => void>(),
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
};
const mockUseGanapsMap = jest.fn<() => MockMapState>(() => mockMapState);
const mockSelectedGanapCard = jest.fn<(props: SelectedGanapCardProps) => ReactElement>();

jest.mock('lucide-react-native', () => {
  const React = require('react') as typeof import('react');
  return {
    LucideProvider: ({ children }: { children?: ReactNode }): ReactElement =>
      React.createElement(React.Fragment, null, children),
    X: (): null => null,
  };
});

jest.mock('@rnmapbox/maps', () => {
  const React = require('react') as typeof import('react');
  const { View } = require('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: { setAccessToken: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) },
    Camera: (): null => null,
    MapView: ({ children }: { children?: ReactNode }): ReactElement => React.createElement(View, null, children),
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

jest.mock('@/hooks/useGanapsMap', () => ({
  useGanapsMap: (): MockMapState => mockUseGanapsMap(),
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

jest.mock('@/components/map/SelectedGanapCard', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  mockSelectedGanapCard.mockImplementation(
    ({ ganap, onPress }: SelectedGanapCardProps): ReactElement =>
      React.createElement(
        Pressable,
        { testID: 'selected-ganap-card', accessibilityRole: 'button', onPress },
        React.createElement(Text, null, ganap.title),
      ),
  );
  return {
    SelectedGanapCard: (props: SelectedGanapCardProps): ReactElement => mockSelectedGanapCard(props),
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

const HomeScreen = require('./index').default as () => ReactElement;

describe('Home map event markers', (): void => {
  beforeEach((): void => {
    mockCapturedAnchors.length = 0;
    mockSelectedGanapCard.mockClear();
    mockRouter.push.mockClear();
  });

  it('anchors an individual event marker at the visible pin tip and preserves selection', async (): Promise<void> => {
    const screen = await render(<HomeScreen />);

    expect(mockCapturedAnchors).toEqual([{ x: 0.5, y: 1 }]);

    await fireEvent.press(screen.getByTestId('ganap-map-pin-child'));

    expect(screen.getByTestId('selected-ganap-card')).toBeTruthy();
    const selectedCardProps = mockSelectedGanapCard.mock.calls.at(-1)?.[0];
    expect(selectedCardProps?.ganap).toBe(mockGanap);
    expect(screen.getByText(mockGanap.title)).toBeTruthy();
  });
});
