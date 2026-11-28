import { MarkerView } from '@rnmapbox/maps';
import { type ReactElement, useMemo } from 'react';
import { Pressable } from 'react-native';
import { CLUSTER_PREVIEW_LIMIT, GanapClusterPin } from '@/components/map/GanapClusterPin';
import { GanapMapPin } from '@/components/map/GanapMapPin';
import type { GanapListItem } from '@/types/ganap.types';
import {
  type GanapClusterFeature,
  type GanapClusterIndex,
  type GanapMapFeature,
  getClusterPreviewImages,
  getFeatureCoordinate,
  isClusterFeature,
} from '@/utils/map-clustering';

const EVENT_ANCHOR = { x: 0.5, y: 1 } as const;
const CLUSTER_ANCHOR = { x: 0.5, y: 0.5 } as const;

interface ClusteredGanapMarkersProps {
  readonly features: readonly GanapMapFeature[];
  readonly onGanapPress: (ganap: GanapListItem) => void;
  readonly onClusterPress: (cluster: GanapClusterFeature) => void;
  /** The index the clusters came from, for their preview images. */
  readonly clusterIndex: GanapClusterIndex;
  /** Whether cluster previews animate; off while the map is not on screen. */
  readonly isAnimating: boolean;
}

interface ClusterMarkerProps {
  readonly feature: GanapClusterFeature;
  readonly coordinate: [number, number];
  readonly clusterIndex: GanapClusterIndex;
  readonly isAnimating: boolean;
  readonly onPress: (cluster: GanapClusterFeature) => void;
}

function ClusterMarker({ feature, coordinate, clusterIndex, isAnimating, onPress }: ClusterMarkerProps): ReactElement {
  const clusterId: number = feature.properties.cluster_id;
  const count: number = feature.properties.point_count;
  const label: string = `Zoom to group of ${count} events`;
  const images: string[] = useMemo(
    (): string[] => getClusterPreviewImages(clusterIndex, feature, CLUSTER_PREVIEW_LIMIT),
    [clusterIndex, feature],
  );

  return (
    <MarkerView coordinate={coordinate} anchor={CLUSTER_ANCHOR} allowOverlap allowOverlapWithPuck>
      <Pressable
        testID={`map-cluster-marker-${clusterId}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Zooms in until the events separate into individual map pins"
        onPress={(): void => onPress(feature)}
      >
        <GanapClusterPin
          count={count}
          countLabel={String(feature.properties.point_count_abbreviated)}
          images={images}
          isAnimating={isAnimating}
        />
      </Pressable>
    </MarkerView>
  );
}

function renderEventMarker(
  feature: Extract<GanapMapFeature, { properties: { kind: 'ganap' } }>,
  coordinate: [number, number],
  onPress: (ganap: GanapListItem) => void,
): ReactElement {
  const ganap: GanapListItem = feature.properties.ganap;

  return (
    <MarkerView
      key={`ganap-${ganap.id}`}
      coordinate={coordinate}
      anchor={EVENT_ANCHOR}
      allowOverlap
      allowOverlapWithPuck
    >
      <Pressable
        testID={`map-event-marker-${ganap.id}`}
        accessibilityRole="button"
        accessibilityLabel={ganap.isSaved ? `Open saved event ${ganap.title}` : `Open event ${ganap.title}`}
        accessibilityHint="Shows event details"
        onPress={(): void => onPress(ganap)}
      >
        <GanapMapPin ganap={ganap} />
      </Pressable>
    </MarkerView>
  );
}

function renderFeature(feature: GanapMapFeature, props: ClusteredGanapMarkersProps): ReactElement | null {
  const coordinate = getFeatureCoordinate(feature);
  if (coordinate === null) return null;

  if (isClusterFeature(feature)) {
    return (
      <ClusterMarker
        key={`cluster-${feature.properties.cluster_id}`}
        feature={feature}
        coordinate={coordinate}
        clusterIndex={props.clusterIndex}
        isAnimating={props.isAnimating}
        onPress={props.onClusterPress}
      />
    );
  }
  return renderEventMarker(feature, coordinate, props.onGanapPress);
}

/**
 * Renders Supercluster's visible points and clusters through React MarkerView. A cluster previews
 * its events with {@link GanapClusterPin}.
 *
 * @param props - Visible features, their index, whether to animate, and event/cluster press callbacks.
 * @returns A fragment containing one marker per visible valid feature.
 */
export function ClusteredGanapMarkers(props: ClusteredGanapMarkersProps): ReactElement {
  return <>{props.features.map((feature): ReactElement | null => renderFeature(feature, props))}</>;
}
