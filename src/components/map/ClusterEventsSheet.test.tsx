import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import type { GanapListItem } from '@/types/ganap.types';
import {
  createGanapClusterIndex,
  type GanapClusterFeature,
  getClusterExpansionZoom,
  getFeatureCoordinate,
  getVisibleMapFeatures,
  isClusterFeature,
} from '@/utils/map-clustering';
import { ClusterEventsSheet, type ClusterZoomTarget } from './ClusterEventsSheet';

jest.mock('lucide-react-native', () => ({
  X: (props: { className?: string; color?: string; size?: number }): null => {
    mockXProps.push(props);
    return null;
  },
}));

const mockUseResolvedTheme = jest.fn<() => 'light' | 'dark'>(() => 'light');
const mockXProps: Array<{ className?: string; color?: string; size?: number }> = [];

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' | 'dark' => mockUseResolvedTheme(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; right: number; bottom: number; left: number } => ({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }),
}));

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

function clusterFor(items: readonly GanapListItem[]): {
  index: ReturnType<typeof createGanapClusterIndex>;
  cluster: GanapClusterFeature;
} {
  const index = createGanapClusterIndex(items);
  const feature = getVisibleMapFeatures(index, {
    bounds: [-180, -85.051129, 180, 85.051129],
    zoom: 0,
  }).find(isClusterFeature);
  if (feature === undefined) throw new Error('Expected cluster fixture');
  return { index, cluster: feature };
}

describe('ClusterEventsSheet', (): void => {
  beforeEach((): void => {
    mockUseResolvedTheme.mockReturnValue('light');
    mockXProps.length = 0;
  });

  it('renders nothing when no cluster is selected', async (): Promise<void> => {
    const { index } = clusterFor([ganap('a', 122.5489, 10.7313), ganap('b', 122.5489, 10.7313)]);
    const screen = await render(
      <ClusterEventsSheet
        cluster={null}
        index={index}
        onClose={jest.fn()}
        onSelectGanap={jest.fn()}
        onZoomIn={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('cluster-events-sheet')).toBeNull();
  });

  it('exposes every leaf through the accessible virtualized list and closes after selection', async (): Promise<void> => {
    const items: GanapListItem[] = [
      ganap('one', 122.5489, 10.7313),
      ganap('two', 122.5489, 10.7313),
      ganap('three', 122.549, 10.7314),
    ];
    const { index, cluster } = clusterFor(items);
    const onClose = jest.fn<() => void>();
    const onSelectGanap = jest.fn<(item: GanapListItem) => void>();
    const screen = await render(
      <ClusterEventsSheet
        cluster={cluster}
        index={index}
        onClose={onClose}
        onSelectGanap={onSelectGanap}
        onZoomIn={jest.fn()}
      />,
    );

    expect(screen.getByTestId('cluster-events-sheet')).toBeTruthy();
    const list = screen.getByTestId('cluster-events-list');
    expect(list.props.data).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Open event Event one' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open event Event two' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open event Event three' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Open event Event two' }));
    expect(onSelectGanap).toHaveBeenCalledWith(items[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('forwards the exact cluster coordinate and Supercluster expansion zoom from Zoom in', async (): Promise<void> => {
    const { index, cluster } = clusterFor([ganap('one', 122.5489, 10.7313), ganap('two', 122.5489, 10.7313)]);
    const onClose = jest.fn<() => void>();
    const onZoomIn = jest.fn<(target: ClusterZoomTarget) => void>();
    const screen = await render(
      <ClusterEventsSheet
        cluster={cluster}
        index={index}
        onClose={onClose}
        onSelectGanap={jest.fn()}
        onZoomIn={onZoomIn}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Zoom in' }));

    expect(onZoomIn).toHaveBeenCalledWith({
      coordinate: getFeatureCoordinate(cluster),
      zoom: getClusterExpansionZoom(index, cluster),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the explicit close button', async (): Promise<void> => {
    const { index, cluster } = clusterFor([ganap('one', 122.5489, 10.7313), ganap('two', 122.5489, 10.7313)]);
    const onClose = jest.fn<() => void>();
    const screen = await render(
      <ClusterEventsSheet
        cluster={cluster}
        index={index}
        onClose={onClose}
        onSelectGanap={jest.fn()}
        onZoomIn={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Close event group' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    'light',
    'dark',
  ] as const)('uses the resolved %s theme for the scrim and close icon', async (theme): Promise<void> => {
    mockUseResolvedTheme.mockReturnValue(theme);
    const { index, cluster } = clusterFor([ganap('one', 122.5489, 10.7313), ganap('two', 122.5489, 10.7313)]);
    const screen = await render(
      <ClusterEventsSheet
        cluster={cluster}
        index={index}
        onClose={jest.fn()}
        onSelectGanap={jest.fn()}
        onZoomIn={jest.fn()}
      />,
    );

    const scrimStyle = StyleSheet.flatten(
      screen.getByTestId('cluster-events-scrim', { includeHiddenElements: true }).props.style,
    ) as ViewStyle;
    const sheetStyle = StyleSheet.flatten(screen.getByTestId('cluster-events-sheet').props.style) as ViewStyle;

    expect(scrimStyle.backgroundColor).toBe(Colors[theme].foreground);
    expect(scrimStyle.opacity).toBe(0.4);
    expect(sheetStyle.opacity).toBeUndefined();
    expect(mockXProps.at(-1)).toMatchObject({ color: Colors[theme]['muted-foreground'] });
    expect(mockXProps.at(-1)?.className).toBeUndefined();
  });
});
