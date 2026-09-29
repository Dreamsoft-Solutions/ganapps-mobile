import { describe, expect, it } from '@jest/globals';
import type { GanapListItem } from '@/types/ganap.types';
import { resolveClusterZoomTarget } from './feed-sheet';
import {
  CLUSTER_EXPANSION_MAX_ZOOM,
  CLUSTER_MAX_ZOOM,
  createGanapClusterIndex,
  DEFAULT_MAP_VIEWPORT,
  type GanapClusterFeature,
  type GanapMapFeature,
  type GanapPointFeature,
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

function visibleClusterLeafIdsAtZoom(
  index: ReturnType<typeof createGanapClusterIndex>,
  cluster: GanapClusterFeature,
  zoom: number,
): string[] {
  const leafIds: Set<string> = new Set(getClusterLeaves(index, cluster).map((item: GanapListItem): string => item.id));
  return getVisibleMapFeatures(index, { bounds: WORLD_MAP_BOUNDS, zoom })
    .filter(isGanapPointFeature)
    .map((feature: GanapPointFeature): string => feature.properties.ganap.id)
    .filter((id: string): boolean => leafIds.has(id))
    .sort();
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

  it('expands a sparse cluster at its first leaf zoom instead of jumping to the cap', (): void => {
    const points: GanapListItem[] = [ganap('sparse-west', 122.5489, 10.7313), ganap('sparse-east', 122.5589, 10.7313)];
    const index = createGanapClusterIndex(points);
    const cluster: GanapClusterFeature = onlyCluster(visibleAt(index, 0));
    const firstExpansionZoom: number = index.getClusterExpansionZoom(cluster.properties.cluster_id);
    const targetZoom: number = getClusterExpansionZoom(index, cluster);

    expect(targetZoom).toBe(firstExpansionZoom);
    expect(targetZoom).toBeLessThan(CLUSTER_EXPANSION_MAX_ZOOM);
    expect(visibleClusterLeafIdsAtZoom(index, cluster, targetZoom)).toEqual(['sparse-east', 'sparse-west']);
  });

  it('continues through dense child clusters until every leaf is an individual point', (): void => {
    const points: GanapListItem[] = [
      ganap('dense-a1', 122.5489, 10.7313),
      ganap('dense-a2', 122.5489, 10.7313),
      ganap('dense-b1', 122.5589, 10.7313),
      ganap('dense-b2', 122.5589, 10.7313),
    ];
    const index = createGanapClusterIndex(points);
    const cluster: GanapClusterFeature = onlyCluster(visibleAt(index, 0));
    const firstExpansionZoom: number = index.getClusterExpansionZoom(cluster.properties.cluster_id);
    const targetZoom: number = getClusterExpansionZoom(index, cluster);

    expect(index.getChildren(cluster.properties.cluster_id).some(isClusterFeature)).toBe(true);
    expect(targetZoom).toBeGreaterThan(firstExpansionZoom);
    expect(targetZoom).toBe(CLUSTER_EXPANSION_MAX_ZOOM);
    expect(visibleClusterLeafIdsAtZoom(index, cluster, targetZoom)).toEqual([
      'dense-a1',
      'dense-a2',
      'dense-b1',
      'dense-b2',
    ]);
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
    expect(normalizeClusterZoom(CLUSTER_MAX_ZOOM + 4)).toBe(CLUSTER_EXPANSION_MAX_ZOOM);
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

describe('getClusterLeaves resilience', () => {
  it('returns an empty array for a cluster that is not in the index', () => {
    /**
     * Supercluster throws rather than returning nothing, which during a render
     * takes the screen down. Holding a cluster from a replaced index is a
     * transient state the UI should survive.
     */
    const populated = createGanapClusterIndex([ganap('a', 122.5489, 10.7313), ganap('b', 122.5489, 10.7313)]);
    const cluster = getVisibleMapFeatures(populated, {
      bounds: [-180, -85.051129, 180, 85.051129],
      zoom: 0,
    }).find(isClusterFeature);
    if (cluster === undefined) throw new Error('Expected a cluster fixture');

    expect(getClusterLeaves(createGanapClusterIndex([]), cluster)).toEqual([]);
  });

  it('returns no camera target for a cluster from a replaced index', () => {
    const index = createGanapClusterIndex([ganap('a', 122.5489, 10.7313), ganap('b', 122.5489, 10.7313)]);
    const cluster = onlyCluster(visibleAt(index, 0));

    expect(resolveClusterZoomTarget(createGanapClusterIndex([]), cluster)).toBeNull();
  });
});
