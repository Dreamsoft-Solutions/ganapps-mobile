import { X } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { FlatList, type ListRenderItemInfo, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import type { GanapListItem } from '@/types/ganap.types';
import {
  type GanapClusterFeature,
  type GanapClusterIndex,
  getClusterExpansionZoom,
  getClusterLeaves,
  getFeatureCoordinate,
  type MapCoordinate,
} from '@/utils/map-clustering';

export interface ClusterZoomTarget {
  readonly coordinate: MapCoordinate;
  readonly zoom: number;
}

interface ClusterEventsSheetProps {
  readonly cluster: GanapClusterFeature | null;
  readonly index: GanapClusterIndex;
  readonly onClose: () => void;
  readonly onSelectGanap: (ganap: GanapListItem) => void;
  readonly onZoomIn: (target: ClusterZoomTarget) => void;
}

/**
 * Presents every leaf in a selected cluster and offers an explicit expansion-zoom action.
 *
 * @param props - Selected cluster, immutable index, and close/select/zoom callbacks.
 * @returns A native modal sheet, or null when no cluster is selected.
 */
export function ClusterEventsSheet({
  cluster,
  index,
  onClose,
  onSelectGanap,
  onZoomIn,
}: ClusterEventsSheetProps): ReactElement | null {
  const insets = useSafeAreaInsets();

  const leaves: GanapListItem[] = useMemo(
    (): GanapListItem[] => (cluster === null ? [] : getClusterLeaves(index, cluster)),
    [cluster, index],
  );

  const zoomTarget: ClusterZoomTarget | null = useMemo((): ClusterZoomTarget | null => {
    if (cluster === null) return null;
    const coordinate: MapCoordinate | null = getFeatureCoordinate(cluster);
    if (coordinate === null) return null;
    return {
      coordinate,
      zoom: getClusterExpansionZoom(index, cluster),
    };
  }, [cluster, index]);

  if (cluster === null) return null;

  const handleSelectGanap = (ganap: GanapListItem): void => {
    onSelectGanap(ganap);
    onClose();
  };

  const handleZoomIn = (): void => {
    if (zoomTarget === null) return;
    onZoomIn(zoomTarget);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View
          testID="cluster-events-sheet"
          className="max-h-[80%] rounded-t-3xl bg-background px-md pt-md"
          style={{ paddingBottom: insets.bottom + 16 }}
          accessibilityViewIsModal
        >
          <View className="mb-md flex-row items-center justify-between">
            <Text accessibilityRole="header" className="text-headline-md">
              {cluster.properties.point_count} events nearby
            </Text>
            <Pressable
              testID="cluster-events-close"
              accessibilityRole="button"
              accessibilityLabel="Close event group"
              onPress={onClose}
              className="rounded-full bg-muted p-2"
            >
              <X size={18} className="text-muted-foreground" />
            </Pressable>
          </View>

          <Button
            accessibilityHint="Zooms the map to where this group separates"
            onPress={handleZoomIn}
            disabled={zoomTarget === null}
            variant="outline"
            size="sm"
          >
            Zoom in
          </Button>

          <FlatList
            testID="cluster-events-list"
            data={leaves}
            keyExtractor={(item: GanapListItem): string => item.id}
            renderItem={({ item }: ListRenderItemInfo<GanapListItem>): ReactElement => (
              <Pressable
                testID={`cluster-event-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Open event ${item.title}`}
                accessibilityHint="Shows event details"
                onPress={(): void => handleSelectGanap(item)}
                className="border-b border-border py-md"
              >
                <Text className="text-headline-sm">{item.title}</Text>
                <Text className="text-body-md text-muted-foreground">{item.businessName}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text className="py-lg text-center text-muted-foreground">No events in this group.</Text>
            }
            contentContainerStyle={{ paddingBottom: 16 }}
          />
        </View>
      </View>
    </Modal>
  );
}
