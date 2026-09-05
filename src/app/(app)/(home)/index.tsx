import Mapbox, { Camera, type MapState, MapView } from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import type { ComponentRef, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { ClusterEventsSheet, type ClusterZoomTarget } from '@/components/map/ClusterEventsSheet';
import { ClusteredGanapMarkers } from '@/components/map/ClusteredGanapMarkers';
import { LocateMeButton } from '@/components/map/LocateMeButton';
import { LocationPrimingSheet } from '@/components/map/LocationPrimingSheet';
import { MapSearchBar } from '@/components/map/MapSearchBar';
import { ReducedAccuracyNotice } from '@/components/map/ReducedAccuracyNotice';
import { SelectedGanapCard } from '@/components/map/SelectedGanapCard';
import { TagChips } from '@/components/map/TagChips';
import { Routes } from '@/constants/routes';
import { useGanapsMap } from '@/hooks/useGanapsMap';
import type { GanapListItem } from '@/types/ganap.types';
import {
  createGanapClusterIndex,
  DEFAULT_MAP_VIEWPORT,
  type GanapClusterFeature,
  type GanapClusterIndex,
  getVisibleMapFeatures,
  type MapViewport,
  mapStateToViewport,
} from '@/utils/map-clustering';

const MAPBOX_TOKEN: string = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

const ILOILO_CITY_CENTER: [number, number] = [122.5621, 10.7202];
const CITY_ZOOM = 12;
const USER_ZOOM = 14;

export default function HomeScreen(): ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    items,
    tags,
    search,
    setSearch,
    tag,
    setTag,
    isLoading,
    isError,
    error,
    refetch,
    isNearbyActive,
    isNearbyDisabled,
    toggleNearby,
    userCoords,
    isPrimingVisible,
    confirmPriming,
    dismissPriming,
    isAccuracyNoticeVisible,
    dismissAccuracyNotice,
    openLocationSettings,
    locationErrorMessage,
  } = useGanapsMap();

  const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
  const hasCentredOnUser = useRef<boolean>(false);
  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_MAP_VIEWPORT);
  const [selectedGanap, setSelectedGanap] = useState<GanapListItem | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<GanapClusterFeature | null>(null);
  const [selectedClusterIndex, setSelectedClusterIndex] = useState<GanapClusterIndex | null>(null);

  const clusterIndex = useMemo(() => createGanapClusterIndex(items), [items]);
  const visibleFeatures = useMemo(() => getVisibleMapFeatures(clusterIndex, viewport), [clusterIndex, viewport]);

  useEffect((): void => {
    setSelectedCluster(null);
    setSelectedClusterIndex(null);
  }, [clusterIndex]);

  const activeCluster: GanapClusterFeature | null = selectedClusterIndex === clusterIndex ? selectedCluster : null;

  useEffect(() => {
    if (MAPBOX_TOKEN) {
      void Mapbox.setAccessToken(MAPBOX_TOKEN);
    }
  }, []);

  useEffect((): void => {
    if (!userCoords || hasCentredOnUser.current) return;
    hasCentredOnUser.current = true;
    cameraRef.current?.setCamera({
      centerCoordinate: [userCoords.longitude, userCoords.latitude],
      zoomLevel: USER_ZOOM,
      animationDuration: 500,
    });
  }, [userCoords]);

  const handleLocateMe = useCallback((): void => {
    if (userCoords) {
      cameraRef.current?.setCamera({
        centerCoordinate: [userCoords.longitude, userCoords.latitude],
        zoomLevel: USER_ZOOM,
        animationDuration: 500,
      });
      return;
    }
    toggleNearby();
  }, [toggleNearby, userCoords]);

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
    setSelectedClusterIndex(null);
    setSelectedGanap(ganap);
  }, []);

  const handleClusterPress = useCallback(
    (cluster: GanapClusterFeature): void => {
      setSelectedCluster(cluster);
      setSelectedClusterIndex(clusterIndex);
    },
    [clusterIndex],
  );

  const handleClusterClose = useCallback((): void => {
    setSelectedCluster(null);
    setSelectedClusterIndex(null);
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
        <Camera ref={cameraRef} centerCoordinate={ILOILO_CITY_CENTER} zoomLevel={CITY_ZOOM} animationMode="none" />
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
        <TagChips
          tags={tags}
          selectedTag={tag}
          onSelectTag={setTag}
          isNearbyActive={isNearbyActive}
          isNearbyDisabled={isNearbyDisabled}
          onToggleNearby={toggleNearby}
        />
        <ReducedAccuracyNotice
          visible={isAccuracyNoticeVisible}
          onOpenSettings={(): void => {
            void openLocationSettings();
          }}
          onDismiss={dismissAccuracyNotice}
        />
        {isNearbyDisabled && (
          <View className="mx-4 mt-2 rounded-md bg-card border border-border p-sm gap-1">
            <Text className="text-label-md text-card-foreground">Location is off</Text>
            <Text className="text-body-md text-muted-foreground">
              Turn on location for Ganapps in Settings to filter events near you. Everything else on the map still
              works.
            </Text>
            <Pressable
              onPress={(): void => {
                void openLocationSettings();
              }}
              accessibilityRole="button"
            >
              <Text className="text-label-md text-primary">Open Settings</Text>
            </Pressable>
          </View>
        )}
        {locationErrorMessage !== null && (
          <View className="mx-4 mt-2 rounded-md bg-card border border-border p-sm">
            <Text className="text-body-md text-muted-foreground">{locationErrorMessage}</Text>
          </View>
        )}
      </View>

      <View className="absolute right-4" style={{ bottom: 96 }} pointerEvents="box-none">
        <LocateMeButton onPress={handleLocateMe} />
      </View>

      <LocationPrimingSheet
        visible={isPrimingVisible}
        onConfirm={(): void => {
          void confirmPriming();
        }}
        onDismiss={dismissPriming}
      />

      <ClusterEventsSheet
        cluster={activeCluster}
        index={clusterIndex}
        onClose={handleClusterClose}
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
