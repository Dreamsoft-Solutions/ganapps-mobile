import Mapbox, { Camera, type MapState, MapView } from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import type { ComponentRef, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { ClusterEventsSheet, type ClusterZoomTarget } from '@/components/map/ClusterEventsSheet';
import { ClusteredGanapMarkers } from '@/components/map/ClusteredGanapMarkers';
import { MapSearchBar } from '@/components/map/MapSearchBar';
import { SelectedGanapCard } from '@/components/map/SelectedGanapCard';
import { TagChips } from '@/components/map/TagChips';
import { Routes } from '@/constants/routes';
import { useGanapsMap } from '@/hooks/useGanapsMap';
import type { GanapListItem } from '@/types/ganap.types';
import {
  createGanapClusterIndex,
  DEFAULT_MAP_VIEWPORT,
  type GanapClusterFeature,
  getVisibleMapFeatures,
  type MapViewport,
  mapStateToViewport,
} from '@/utils/map-clustering';

const MAPBOX_TOKEN: string = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

const CPU_CENTER: [number, number] = [122.5489, 10.7313];
const INITIAL_ZOOM = 15.5;

/**
 * Home screen for authenticated users.
 *
 * Displays a full-screen Mapbox map of discoverable Ganaps around CPU with a
 * floating search bar, category chips, and a selected-event card.
 *
 * @returns The map home screen.
 */
export default function HomeScreen(): ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, tags, search, setSearch, tag, setTag, isLoading, isError, error, refetch } = useGanapsMap();

  const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_MAP_VIEWPORT);
  const [selectedGanap, setSelectedGanap] = useState<GanapListItem | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<GanapClusterFeature | null>(null);

  const clusterIndex = useMemo(() => createGanapClusterIndex(items), [items]);
  const visibleFeatures = useMemo(() => getVisibleMapFeatures(clusterIndex, viewport), [clusterIndex, viewport]);

  useEffect((): void => {
    setSelectedCluster(null);
  }, [clusterIndex]);

  useEffect(() => {
    if (MAPBOX_TOKEN) {
      void Mapbox.setAccessToken(MAPBOX_TOKEN);
    }
  }, []);

  const handleMapIdle = useCallback((state: MapState): void => {
    setViewport(
      mapStateToViewport({
        bounds: state.properties.bounds,
        zoom: state.properties.zoom,
      }),
    );
  }, []);

  const handleGanapPress = useCallback((ganap: GanapListItem): void => {
    setSelectedCluster(null);
    setSelectedGanap(ganap);
  }, []);

  const handleClusterPress = useCallback((cluster: GanapClusterFeature): void => {
    setSelectedCluster(cluster);
  }, []);

  const handleClusterZoomIn = useCallback((target: ClusterZoomTarget): void => {
    cameraRef.current?.setCamera({
      centerCoordinate: target.coordinate,
      zoomLevel: target.zoom,
      animationDuration: 300,
    });
  }, []);

  if (!MAPBOX_TOKEN) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-md">
        <Text className="text-headline-md text-foreground mb-sm">Mapbox token missing</Text>
        <Text className="text-body-md text-muted-foreground text-center">
          Add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file to load the map.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return <Loading message="Finding events nearby..." />;
  }

  if (isError) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  return (
    <View className="flex-1">
      <MapView
        style={{ flex: 1 }}
        styleURL="mapbox://styles/mapbox/streets-v12"
        scaleBarEnabled={false}
        attributionEnabled
        logoEnabled
        onMapIdle={handleMapIdle}
      >
        <Camera ref={cameraRef} centerCoordinate={CPU_CENTER} zoomLevel={INITIAL_ZOOM} animationMode="none" />
        <ClusteredGanapMarkers
          features={visibleFeatures}
          onGanapPress={handleGanapPress}
          onClusterPress={handleClusterPress}
        />
      </MapView>

      <View className="absolute left-0 right-0" style={{ top: insets.top + 12 }} pointerEvents="box-none">
        <View className="mx-4">
          <MapSearchBar value={search} onChangeText={setSearch} />
        </View>
        <TagChips tags={tags} selectedTag={tag} onSelectTag={setTag} />
      </View>

      <ClusterEventsSheet
        cluster={selectedCluster}
        index={clusterIndex}
        onClose={(): void => setSelectedCluster(null)}
        onSelectGanap={handleGanapPress}
        onZoomIn={handleClusterZoomIn}
      />

      {selectedGanap && (
        <View className="absolute bottom-4 left-0 right-0" pointerEvents="box-none">
          <SelectedGanapCard
            ganap={selectedGanap}
            onClose={(): void => setSelectedGanap(null)}
            onPress={(): void => router.push(Routes.ganapDetail(selectedGanap.id))}
          />
        </View>
      )}
    </View>
  );
}
