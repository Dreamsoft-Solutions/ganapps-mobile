import Supercluster from 'supercluster';
import type { GanapListItem } from '@/types/ganap.types';

const MIN_LONGITUDE: number = -180;
const MAX_LONGITUDE: number = 180;
const MIN_LATITUDE: number = -90;
const MAX_LATITUDE: number = 90;
const DEFAULT_ZOOM: number = 15;

export const CLUSTER_RADIUS_PX: number = 60;
export const CLUSTER_MAX_ZOOM: number = 16;
export const CLUSTER_MIN_POINTS: number = 2;

export type MapCoordinate = [longitude: number, latitude: number];
export type MapBounds = [west: number, south: number, east: number, north: number];

export interface MapViewport {
  readonly bounds: MapBounds;
  readonly zoom: number;
}

export interface MapViewportInput {
  readonly bounds: {
    readonly ne: readonly number[];
    readonly sw: readonly number[];
  };
  readonly zoom: number;
}

export interface GanapPointProperties {
  readonly kind: 'ganap';
  readonly ganap: GanapListItem;
}

export type GanapClusterProperties = Supercluster.ClusterProperties;
export type GanapPointFeature = Supercluster.PointFeature<GanapPointProperties>;
export type GanapClusterFeature = Supercluster.ClusterFeature<Record<string, unknown>>;
export type GanapMapFeature = GanapPointFeature | GanapClusterFeature;
export type GanapClusterIndex = Supercluster<GanapPointProperties, Record<string, unknown>>;

export const WORLD_MAP_BOUNDS: MapBounds = [-180, -85.051129, 180, 85.051129];
export const DEFAULT_MAP_VIEWPORT: MapViewport = {
  bounds: WORLD_MAP_BOUNDS,
  zoom: DEFAULT_ZOOM,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= MIN_LONGITUDE && value <= MAX_LONGITUDE;
}

function isLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= MIN_LATITUDE && value <= MAX_LATITUDE;
}

function defaultViewport(): MapViewport {
  return {
    bounds: [-180, -85.051129, 180, 85.051129],
    zoom: DEFAULT_ZOOM,
  };
}

/** Converts an arbitrary GeoJSON position to a validated longitude/latitude tuple. */
export function toMapCoordinate(position: readonly number[]): MapCoordinate | null {
  const longitude: unknown = position[0];
  const latitude: unknown = position[1];

  if (!isLongitude(longitude) || !isLatitude(latitude)) return null;
  return [longitude, latitude];
}

/** Converts one Ganap into a Supercluster point, omitting invalid coordinates. */
export function toGanapPointFeature(ganap: GanapListItem): GanapPointFeature | null {
  const coordinate: MapCoordinate | null = toMapCoordinate([ganap.locationLong, ganap.locationLat]);
  if (coordinate === null) return null;

  return {
    type: 'Feature',
    id: ganap.id,
    geometry: { type: 'Point', coordinates: coordinate },
    properties: { kind: 'ganap', ganap },
  };
}

/** Converts all valid Ganaps while preserving the input order. */
export function toGanapPointFeatures(ganaps: readonly GanapListItem[]): GanapPointFeature[] {
  const features: GanapPointFeature[] = [];

  for (const ganap of ganaps) {
    const feature: GanapPointFeature | null = toGanapPointFeature(ganap);
    if (feature !== null) features.push(feature);
  }

  return features;
}

/** Floors and clamps a camera zoom to the integer range accepted by the index. */
export function normalizeClusterZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_ZOOM;
  return Math.min(CLUSTER_MAX_ZOOM, Math.max(0, Math.floor(zoom)));
}

/** Converts a Mapbox idle payload into deterministic Supercluster viewport input. */
export function mapStateToViewport(input: MapViewportInput): MapViewport {
  const west: unknown = input.bounds.sw[0];
  const south: unknown = input.bounds.sw[1];
  const east: unknown = input.bounds.ne[0];
  const north: unknown = input.bounds.ne[1];

  if (
    !isLongitude(west) ||
    !isLatitude(south) ||
    !isLongitude(east) ||
    !isLatitude(north) ||
    !isFiniteNumber(input.zoom) ||
    south > north
  ) {
    return defaultViewport();
  }

  return {
    bounds: [west, south, east, north],
    zoom: normalizeClusterZoom(input.zoom),
  };
}

/** Builds the immutable index once for the current map dataset. */
export function createGanapClusterIndex(ganaps: readonly GanapListItem[]): GanapClusterIndex {
  const index = new Supercluster<GanapPointProperties, Record<string, unknown>>({
    radius: CLUSTER_RADIUS_PX,
    maxZoom: CLUSTER_MAX_ZOOM,
    minPoints: CLUSTER_MIN_POINTS,
  });

  return index.load(toGanapPointFeatures(ganaps));
}

/** Returns individual points and clusters visible in the normalized viewport. */
export function getVisibleMapFeatures(index: GanapClusterIndex, viewport: MapViewport): GanapMapFeature[] {
  return index.getClusters(viewport.bounds, normalizeClusterZoom(viewport.zoom));
}

/** Identifies a Supercluster cluster in the visible feature union. */
export function isClusterFeature(feature: GanapMapFeature): feature is GanapClusterFeature {
  return 'cluster' in feature.properties && feature.properties.cluster === true;
}

/** Identifies an individual Ganap point in the visible feature union. */
export function isGanapPointFeature(feature: GanapMapFeature): feature is GanapPointFeature {
  return 'kind' in feature.properties && feature.properties.kind === 'ganap';
}

/** Converts either a cluster or a point feature into a validated MarkerView coordinate. */
export function getFeatureCoordinate(feature: GanapMapFeature): MapCoordinate | null {
  return toMapCoordinate(feature.geometry.coordinates);
}

/** Resolves every Ganap leaf so duplicate coordinates remain selectable. */
export function getClusterLeaves(index: GanapClusterIndex, cluster: GanapClusterFeature): GanapListItem[] {
  return index
    .getLeaves(cluster.properties.cluster_id, Number.POSITIVE_INFINITY, 0)
    .map((feature: GanapPointFeature): GanapListItem => feature.properties.ganap);
}

/** Resolves the zoom at which Supercluster expands the selected cluster. */
export function getClusterExpansionZoom(index: GanapClusterIndex, cluster: GanapClusterFeature): number {
  return index.getClusterExpansionZoom(cluster.properties.cluster_id);
}
