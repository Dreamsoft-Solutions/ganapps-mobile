import Mapbox, { Camera, LocationPuck, type MapState, MapView } from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import type { ComponentRef, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { ClusteredGanapMarkers } from '@/components/map/ClusteredGanapMarkers';
import { GanapFeedSheet } from '@/components/map/GanapFeedSheet';
import { LocateMeButton } from '@/components/map/LocateMeButton';
import { LocationPrimingSheet } from '@/components/map/LocationPrimingSheet';
import { MapSearchBar } from '@/components/map/MapSearchBar';
import { ReducedAccuracyNotice } from '@/components/map/ReducedAccuracyNotice';
import { TagChips } from '@/components/map/TagChips';
import { Routes } from '@/constants/routes';
import { useGanapDiscovery } from '@/hooks/useGanapDiscovery';
import type { Coords } from '@/services/location.service';
import type { GanapListItem } from '@/types/ganap.types';
import { FEED_SHEET_PEEK_HEIGHT, resolveClusterZoomTarget } from '@/utils/feed-sheet';
import {
  CLUSTER_EXPANSION_MAX_ZOOM,
  type ClusterZoomTarget,
  createGanapClusterIndex,
  DEFAULT_MAP_VIEWPORT,
  type GanapClusterFeature,
  type GanapClusterIndex,
  getVisibleMapFeatures,
  type MapViewport,
  mapStateToViewport,
} from '@/utils/map-clustering';
import { MAP_OVERLAY_TOP, USER_ZOOM } from '@/utils/map-viewport';

const MAPBOX_TOKEN: string = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

const ILOILO_CITY_CENTER: [number, number] = [122.5621, 10.7202];
const CITY_ZOOM = 12;
/**
 * How much of the map the feed sheet covers at rest.
 *
 * Camera padding and anything floating over the map both have to clear it. The
 * tab bar is not included: a custom `tabBar` is a flex sibling of the screens
 * container, so this screen already ends at the top of the bar.
 */
const MAP_OVERLAY_BOTTOM: number = FEED_SHEET_PEEK_HEIGHT;

/**
 * Home screen for authenticated users.
 *
 * Full-screen Mapbox map of discoverable Ganaps across Iloilo City, with a
 * floating search bar, category chips, the Nearby distance filter, and a
 * selected-event card.
 *
 * @returns The map home screen
 */
export default function HomeScreen(): ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const discovery = useGanapDiscovery();
  const { search, setSearch, tag, setTag, tags, map, feed, nearby } = discovery;
  const { items, isLoading, isError, error, refetch } = map;
  const userCoords = nearby.coords;
  const isNearbyActive: boolean = nearby.isActive;
  const hasActiveFilters: boolean =
    tag !== null || discovery.filters.search !== undefined || discovery.filters.radius !== undefined;
  /**
   * Whether a radius actually reached the server, which is not the same as the
   * chip being on: the position can still be resolving. The title follows what
   * was queried rather than what the chip says.
   */
  const isNearbyApplied: boolean = discovery.filters.radius !== undefined;

  const cameraRef = useRef<ComponentRef<typeof Camera>>(null);
  const hasCentredOnUser = useRef<boolean>(false);
  const wasNearbyActive = useRef<boolean>(false);
  const mapZoomRef = useRef<number>(CITY_ZOOM);
  const isClusterZoomPendingRef = useRef<boolean>(false);
  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_MAP_VIEWPORT);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [selectedGanap, setSelectedGanap] = useState<GanapListItem | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<GanapClusterFeature | null>(null);
  const [selectedClusterIndex, setSelectedClusterIndex] = useState<GanapClusterIndex | null>(null);

  const clusterIndex = useMemo(() => createGanapClusterIndex(items), [items]);
  const visibleFeatures = useMemo(() => getVisibleMapFeatures(clusterIndex, viewport), [clusterIndex, viewport]);

  useEffect((): void => {
    setSelectedGanap(null);
    setSelectedCluster(null);
    setSelectedClusterIndex(null);
  }, [clusterIndex]);

  const activeCluster: GanapClusterFeature | null = selectedClusterIndex === clusterIndex ? selectedCluster : null;

  useEffect(() => {
    if (MAPBOX_TOKEN) {
      void Mapbox.setAccessToken(MAPBOX_TOKEN);
    }
  }, []);

  const centreOnUser = useCallback(
    (coords: Coords): void => {
      cameraRef.current?.setCamera({
        centerCoordinate: [coords.longitude, coords.latitude],
        zoomLevel: USER_ZOOM,
        animationDuration: 500,
        padding: {
          paddingTop: insets.top + MAP_OVERLAY_TOP,
          paddingBottom: MAP_OVERLAY_BOTTOM,
          paddingLeft: 0,
          paddingRight: 0,
        },
      });
    },
    [insets.top],
  );

  useEffect((): void => {
    if (!isMapReady || !userCoords || hasCentredOnUser.current) return; // see ADR 0003
    hasCentredOnUser.current = true;
    centreOnUser(userCoords);
  }, [centreOnUser, isMapReady, userCoords]);

  useEffect((): void => {
    const turnedOn = isNearbyActive && !wasNearbyActive.current;
    wasNearbyActive.current = isNearbyActive;
    if (!turnedOn || !userCoords) return;
    centreOnUser(userCoords);
  }, [centreOnUser, isNearbyActive, userCoords]);

  const handleLocateMe = useCallback((): void => {
    void (async (): Promise<void> => {
      const fresh = await nearby.refresh();
      if (fresh) {
        centreOnUser(fresh);
        return;
      }
      if (!userCoords) nearby.toggle();
    })();
  }, [centreOnUser, nearby.refresh, nearby.toggle, userCoords]);

  const handleMapReady = useCallback((): void => {
    setIsMapReady(true);
  }, []);

  const handleMapIdle = useCallback((state: MapState): void => {
    const zoom: number = state.properties.zoom;
    mapZoomRef.current = zoom;
    isClusterZoomPendingRef.current = false;
    setViewport(
      mapStateToViewport({
        bounds: state.properties.bounds,
        zoom,
      }),
    );
  }, []);

  const requestClusterZoom = useCallback(
    (target: ClusterZoomTarget): void => {
      const camera = cameraRef.current;
      if (camera === null || isClusterZoomPendingRef.current) return;

      const zoom: number = Math.min(target.zoom, CLUSTER_EXPANSION_MAX_ZOOM);
      if (zoom <= mapZoomRef.current) return;

      isClusterZoomPendingRef.current = true;
      camera.setCamera({
        centerCoordinate: target.coordinate,
        zoomLevel: zoom,
        animationDuration: 300,
        padding: {
          paddingTop: insets.top + MAP_OVERLAY_TOP,
          paddingBottom: MAP_OVERLAY_BOTTOM,
          paddingLeft: 0,
          paddingRight: 0,
        },
      });
    },
    [insets.top],
  );

  const handleGanapPress = useCallback((ganap: GanapListItem): void => {
    setSelectedCluster(null);
    setSelectedClusterIndex(null);
    setSelectedGanap(ganap);
  }, []);

  const handleClusterPress = useCallback(
    (cluster: GanapClusterFeature): void => {
      if (isClusterZoomPendingRef.current) return;
      setSelectedCluster(cluster);
      setSelectedClusterIndex(clusterIndex);
      const target: ClusterZoomTarget | null = resolveClusterZoomTarget(clusterIndex, cluster);
      if (target !== null) requestClusterZoom(target);
    },
    [clusterIndex, requestClusterZoom],
  );

  const handleClearSelection = useCallback((): void => {
    setSelectedGanap(null);
    setSelectedCluster(null);
    setSelectedClusterIndex(null);
  }, []);

  const handleOpenGanap = useCallback(
    (ganap: GanapListItem): void => {
      router.push(Routes.ganapDetail(ganap.id));
    },
    [router],
  );

  const handleClusterZoomIn = useCallback(
    (target: ClusterZoomTarget): void => {
      requestClusterZoom(target);
    },
    [requestClusterZoom],
  );

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
    return <Loading message="Finding events..." />;
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
        onDidFinishLoadingMap={handleMapReady}
      >
        <Camera ref={cameraRef} centerCoordinate={ILOILO_CITY_CENTER} zoomLevel={CITY_ZOOM} animationMode="none" />
        {userCoords !== null && <LocationPuck puckBearing="heading" puckBearingEnabled />}
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
          isNearbyActive={nearby.isActive}
          isNearbyDisabled={nearby.isDisabled}
          onToggleNearby={nearby.toggle}
        />
        <ReducedAccuracyNotice
          visible={nearby.isAccuracyNoticeVisible}
          onOpenSettings={(): void => {
            void nearby.openSettings();
          }}
          onDismiss={nearby.dismissAccuracyNotice}
        />
        {nearby.isDisabled && (
          <View className="mx-4 mt-2 rounded-md bg-card border border-border p-sm gap-1">
            <Text className="text-label-md text-card-foreground">Location is off</Text>
            <Text className="text-body-md text-muted-foreground">
              Turn on location for Ganapps in Settings to filter events near you. Everything else on the map still
              works.
            </Text>
            <Pressable
              onPress={(): void => {
                void nearby.openSettings();
              }}
              accessibilityRole="button"
            >
              <Text className="text-label-md text-primary">Open Settings</Text>
            </Pressable>
          </View>
        )}
        {nearby.errorMessage !== null && (
          <View className="mx-4 mt-2 rounded-md bg-card border border-border p-sm">
            <Text className="text-body-md text-muted-foreground">{nearby.errorMessage}</Text>
          </View>
        )}
      </View>

      <View className="absolute right-4" style={{ bottom: MAP_OVERLAY_BOTTOM + 12 }} pointerEvents="box-none">
        <LocateMeButton onPress={handleLocateMe} />
      </View>

      <LocationPrimingSheet
        visible={nearby.isPrimingVisible}
        onConfirm={(): void => {
          void nearby.confirmPriming();
        }}
        onDismiss={nearby.dismissPriming}
      />

      {(selectedGanap !== null || activeCluster !== null) && (
        <GanapFeedSheet
          feed={feed}
          hasActiveFilters={hasActiveFilters}
          isNearbyApplied={isNearbyApplied}
          topOverlayHeight={insets.top + MAP_OVERLAY_TOP}
          selectedGanap={selectedGanap}
          selectedCluster={activeCluster}
          clusterIndex={clusterIndex}
          onSelectGanap={handleOpenGanap}
          onClearSelection={handleClearSelection}
          onZoomToCluster={handleClusterZoomIn}
        />
      )}
    </View>
  );
}
