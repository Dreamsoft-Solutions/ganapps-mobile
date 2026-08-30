import { describe, expect, it } from '@jest/globals';
import type { GanapListItem } from '@/types/ganap.types';
import {
  CLUSTER_MAX_ZOOM,
  createGanapClusterIndex,
  DEFAULT_MAP_VIEWPORT,
  type GanapClusterFeature,
  type GanapMapFeature,
  getClusterExpansionZoom,
  getClusterLeaves,
  getFeatureCoordinate,
  getVisibleMapFeatures,
  isClusterFeature,
  isGanapPointFeature,
  mapStateToViewport,
  normalizeClusterZoom,
  toGanapPointFeature,
  toGanapPointFeatures,
  toMapCoordinate,
  WORLD_MAP_BOUNDS,
} from './map-clustering';

function ganap(
  id: string,
  locationLong: number,
  locationLat: number,
  mapPinImage: string | null = null,
): GanapListItem {
  return {
    id,
    businessId: 'business_1',
    businessName: 'CPU Developers',
    slug: id,
    title: `Event ${id}`,
    description: 'Bring a laptop.',
    address: 'Student Union',
    locationLat,
    locationLong,
    startDate: '2026-08-08T02:00:00.000Z',
    endDate: null,
    attendanceOpenMinutesBefore: 30,
    tags: ['study'],
    coverImage: mapPinImage,
    mapPinImage,
    registrationCount: 5,
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

function visibleAt(index: ReturnType<typeof createGanapClusterIndex>, zoom: number): GanapMapFeature[] {
  return getVisibleMapFeatures(index, { bounds: [...WORLD_MAP_BOUNDS], zoom });
}

function onlyCluster(features: readonly GanapMapFeature[]): GanapClusterFeature {
  const cluster: GanapMapFeature | undefined = features.find(isClusterFeature);
  if (cluster === undefined) {
    throw new Error('Expected a cluster feature');
  }
  return cluster;
}

describe('map clustering utility', (): void => {
  it('converts valid points deterministically and omits invalid coordinates', (): void => {
    const invalidLatitude: GanapListItem = { ...ganap('bad-latitude', 122.5489, 10.7313), locationLat: Number.NaN };
    const invalidLongitude: GanapListItem = { ...ganap('bad-longitude', 122.5489, 10.7313), locationLong: 181 };

    const features = toGanapPointFeatures([
      ganap('valid', 122.5489, 10.7313, 'https://cdn.example.test/pin.jpg'),
      invalidLatitude,
      invalidLongitude,
    ]);

    expect(features).toHaveLength(1);
    expect(features[0]?.id).toBe('valid');
    expect(features[0]?.geometry.coordinates).toEqual([122.5489, 10.7313]);
    expect(features[0]?.properties.ganap.mapPinImage).toBe('https://cdn.example.test/pin.jpg');
    expect(toMapCoordinate([122.5489, 10.7313])).toEqual([122.5489, 10.7313]);
    expect(toMapCoordinate([Number.POSITIVE_INFINITY, 10.7313])).toBeNull();
    expect(toGanapPointFeature(invalidLatitude)).toBeNull();
  });

  it('returns no visible features for an empty dataset', (): void => {
    const index = createGanapClusterIndex([]);

    expect(visibleAt(index, 0)).toEqual([]);
  });

  it('keeps a single valid point as an individual feature', (): void => {
    const point: GanapListItem = ganap('single', 122.5489, 10.7313);
    const index = createGanapClusterIndex([point]);
    const features: GanapMapFeature[] = visibleAt(index, 0);

    expect(features).toHaveLength(1);
    const feature: GanapMapFeature | undefined = features[0];
    if (feature === undefined || !isGanapPointFeature(feature)) throw new Error('Expected a Ganap point feature');
    expect(feature.properties.ganap.id).toBe('single');
    expect(getFeatureCoordinate(feature)).toEqual([122.5489, 10.7313]);
  });

  it('clusters same and nearby coordinates while exposing every leaf and an expansion zoom', (): void => {
    const points: GanapListItem[] = [
      ganap('same-1', 122.5489, 10.7313),
      ganap('same-2', 122.5489, 10.7313),
      ganap('nearby', 122.5492, 10.7315),
    ];
    const index = createGanapClusterIndex(points);
    const cluster: GanapClusterFeature = onlyCluster(visibleAt(index, 0));
    const leaves: string[] = getClusterLeaves(index, cluster)
      .map((item: GanapListItem): string => item.id)
      .sort();

    expect(cluster.properties.point_count).toBe(3);
    expect(leaves).toEqual(['nearby', 'same-1', 'same-2']);
    expect(getClusterExpansionZoom(index, cluster)).toBeGreaterThan(0);
  });

  it('keeps distant points as separate individual features', (): void => {
    const index = createGanapClusterIndex([ganap('cpu', 122.5489, 10.7313), ganap('new-york', -73.9857, 40.7484)]);
    const features: GanapMapFeature[] = visibleAt(index, 0);

    expect(features).toHaveLength(2);
    expect(features.every(isGanapPointFeature)).toBe(true);
    expect(features.some(isClusterFeature)).toBe(false);
  });

  it('normalizes zoom and converts Mapbox bounds in west/south/east/north order', (): void => {
    expect(normalizeClusterZoom(15.9)).toBe(15);
    expect(normalizeClusterZoom(-2)).toBe(0);
    expect(normalizeClusterZoom(CLUSTER_MAX_ZOOM + 4)).toBe(CLUSTER_MAX_ZOOM);
    expect(normalizeClusterZoom(Number.NaN)).toBe(15);

    expect(
      mapStateToViewport({
        bounds: { sw: [122, 10], ne: [123, 11] },
        zoom: 15.9,
      }),
    ).toEqual({ bounds: [122, 10, 123, 11], zoom: 15 });

    expect(
      mapStateToViewport({
        bounds: { sw: [170, -10], ne: [-170, 10] },
        zoom: 3.2,
      }),
    ).toEqual({ bounds: [170, -10, -170, 10], zoom: 3 });

    expect(
      mapStateToViewport({
        bounds: { sw: [123, 11], ne: [122, 10] },
        zoom: 15,
      }),
    ).toEqual(DEFAULT_MAP_VIEWPORT);

    expect(
      mapStateToViewport({
        bounds: { sw: [122, 10], ne: [123, 11] },
        zoom: Number.NaN,
      }),
    ).toEqual(DEFAULT_MAP_VIEWPORT);
  });
});
