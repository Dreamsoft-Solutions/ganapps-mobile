import { MarkerView } from '@rnmapbox/maps';
import type { ReactElement } from 'react';
import { Pressable } from 'react-native';
import { Text } from '@/components/common/Text';
import { GanapMapPin } from '@/components/map/GanapMapPin';
import type { GanapListItem } from '@/types/ganap.types';
import {
  type GanapClusterFeature,
  type GanapMapFeature,
  getFeatureCoordinate,
  isClusterFeature,
} from '@/utils/map-clustering';

const EVENT_ANCHOR = { x: 0.5, y: 1 } as const;
const CLUSTER_ANCHOR = { x: 0.5, y: 0.5 } as const;

interface ClusteredGanapMarkersProps {
  readonly features: readonly GanapMapFeature[];
  readonly onGanapPress: (ganap: GanapListItem) => void;
  readonly onClusterPress: (cluster: GanapClusterFeature) => void;
}

function renderClusterMarker(
  feature: GanapClusterFeature,
  coordinate: [number, number],
  onPress: (cluster: GanapClusterFeature) => void,
): ReactElement {
  const clusterId: number = feature.properties.cluster_id;
  const count: number = feature.properties.point_count;
  const label: string = `Zoom to group of ${count} events`;

  return (
    <MarkerView
      key={`cluster-${clusterId}`}
      coordinate={coordinate}
      anchor={CLUSTER_ANCHOR}
      allowOverlap
      allowOverlapWithPuck
    >
      <Pressable
        testID={`map-cluster-marker-${clusterId}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Zooms in until the events separate into individual map pins"
        onPress={(): void => onPress(feature)}
        className="h-14 min-w-14 items-center justify-center rounded-full border-2 border-primary-foreground bg-primary px-3"
      >
        <Text className="font-inter-bold text-body-lg text-primary-foreground">
          {feature.properties.point_count_abbreviated}
        </Text>
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

function renderFeature(
  feature: GanapMapFeature,
  onGanapPress: (ganap: GanapListItem) => void,
  onClusterPress: (cluster: GanapClusterFeature) => void,
): ReactElement | null {
  const coordinate = getFeatureCoordinate(feature);
  if (coordinate === null) return null;

  if (isClusterFeature(feature)) return renderClusterMarker(feature, coordinate, onClusterPress);
  return renderEventMarker(feature, coordinate, onGanapPress);
}

/**
 * Renders Supercluster's visible points and clusters through React MarkerView.
 *
 * @param props - Visible features and event/cluster press callbacks.
 * @returns A fragment containing one marker per visible valid feature.
 */
export function ClusteredGanapMarkers({
  features,
  onGanapPress,
  onClusterPress,
}: ClusteredGanapMarkersProps): ReactElement {
  return <>{features.map((feature): ReactElement | null => renderFeature(feature, onGanapPress, onClusterPress))}</>;
}
