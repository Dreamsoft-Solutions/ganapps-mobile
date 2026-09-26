import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import type { GanapListItem } from '@/types/ganap.types';
import { type GanapClusterFeature, type GanapPointFeature, toGanapPointFeature } from '@/utils/map-clustering';

const mockMarkerProps: Array<{
  anchor?: { x: number; y: number };
  allowOverlap?: boolean;
}> = [];

jest.mock('@rnmapbox/maps', () => {
  const React = require('react') as typeof import('react');
  const ReactNative = require('react-native') as typeof import('react-native');

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

  return { __esModule: true, MarkerView: MockMarkerView };
});

const React = require('react') as typeof import('react');
const ReactNative = require('react-native') as typeof import('react-native');

const mockGanapMapPin = jest.fn(
  ({ ganap }: { ganap: GanapListItem }): ReactElement =>
    React.createElement(ReactNative.View, { testID: `forwarded-pin-${ganap.id}` }),
);

jest.mock('./GanapMapPin', () => ({
  GanapMapPin: (props: { ganap: GanapListItem }): ReactElement => mockGanapMapPin(props),
}));

import { ClusteredGanapMarkers } from './ClusteredGanapMarkers';

function ganap(id: string, mapPinImage: string | null = null): GanapListItem {
  return {
    id,
    businessId: 'business_1',
    businessName: 'CPU Developers',
    slug: id,
    title: `Event ${id}`,
    description: 'Bring a laptop.',
    address: 'Student Union',
    locationLat: 10.7313,
    locationLong: 122.5489,
    startDate: '2026-08-08T02:00:00.000Z',
    endDate: null,
    attendanceOpenMinutesBefore: 30,
    tags: ['study'],
    coverImage: 'https://cdn.example.test/cover.jpg',
    mapPinImage,
    registrationCount: 5,
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

function pointFeature(item: GanapListItem): GanapPointFeature {
  const feature = toGanapPointFeature(item);
  if (feature === null) throw new Error('Expected a valid point feature');
  return feature;
}

const clusterFeature: GanapClusterFeature = {
  type: 'Feature',
  id: 42,
  geometry: { type: 'Point', coordinates: [122.5489, 10.7313] },
  properties: {
    cluster: true,
    cluster_id: 42,
    point_count: 2,
    point_count_abbreviated: 2,
  },
};

describe('ClusteredGanapMarkers', (): void => {
  beforeEach((): void => {
    mockMarkerProps.length = 0;
    mockGanapMapPin.mockClear();
  });

  it('renders no MarkerView for an empty visible feature list', async (): Promise<void> => {
    const screen = await render(
      <ClusteredGanapMarkers features={[]} onGanapPress={jest.fn()} onClusterPress={jest.fn()} />,
    );

    expect(mockMarkerProps).toHaveLength(0);
    expect(screen.queryByTestId(/^map-(event|cluster)-marker-/)).toBeNull();
  });

  it('bottom-anchors and forwards a remote-image individual Ganap pin', async (): Promise<void> => {
    const item = ganap('remote-image', 'https://cdn.example.test/map-pin.jpg');
    const onGanapPress = jest.fn<(value: GanapListItem) => void>();
    const screen = await render(
      <ClusteredGanapMarkers features={[pointFeature(item)]} onGanapPress={onGanapPress} onClusterPress={jest.fn()} />,
    );

    expect(mockMarkerProps).toEqual([{ anchor: { x: 0.5, y: 1 }, allowOverlap: true }]);
    expect(mockGanapMapPin).toHaveBeenCalledWith({ ganap: item });
    expect(screen.getByTestId('map-event-marker-remote-image')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Open event Event remote-image' }));
    expect(onGanapPress).toHaveBeenCalledWith(item);
  });

  it('center-anchors an accessible cluster badge and forwards one press for expansion', async (): Promise<void> => {
    const onClusterPress = jest.fn<(value: GanapClusterFeature) => void>();
    const screen = await render(
      <ClusteredGanapMarkers features={[clusterFeature]} onGanapPress={jest.fn()} onClusterPress={onClusterPress} />,
    );

    expect(mockMarkerProps).toEqual([{ anchor: { x: 0.5, y: 0.5 }, allowOverlap: true }]);
    const clusterButton = screen.getByRole('button', { name: 'Zoom to group of 2 events' });
    expect(clusterButton.props.testID).toBe('map-cluster-marker-42');

    fireEvent.press(clusterButton);
    expect(onClusterPress).toHaveBeenCalledWith(clusterFeature);
  });
});
