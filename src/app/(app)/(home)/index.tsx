import Mapbox, {
  Camera,
  FillExtrusionLayer,
  type FillExtrusionLayerStyle,
  LocationPuck,
  type MapState,
  MapView,
  RasterDemSource,
  Terrain,
} from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import type { ComponentRef, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { ClusteredGanapMarkers } from '@/components/map/ClusteredGanapMarkers';
import { GanapFeedSheet } from '@/components/map/GanapFeedSheet';
import { LocateMeButton } from '@/components/map/LocateMeButton';
import { LocationPrimingSheet } from '@/components/map/LocationPrimingSheet';
import { MapControlsOverlay } from '@/components/map/MapControlsOverlay';
import { MapSearchBar } from '@/components/map/MapSearchBar';
import { MAX_MAP_PITCH, MapViewControls } from '@/components/map/MapViewControls';
import { ReducedAccuracyNotice } from '@/components/map/ReducedAccuracyNotice';
import { TagChips } from '@/components/map/TagChips';
import { Routes } from '@/constants/routes';
import { useGanapDiscovery } from '@/hooks/useGanapDiscovery';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
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
const LOCATION_SELECTION_ZOOM: number = 16.5;
const LOCATION_SELECTION_PITCH: number = 80;
const OVERHEAD_PITCH: number = 0;
const MAP_FEATURE_PRESS_GUARD_MS: number = 150;
const FEATURE_PRESS_PROPAGATION_WINDOW_MS: number = 75;
const TERRAIN_SOURCE_ID = 'ganapps-map-terrain-dem';
const TERRAIN_SOURCE_URL = 'mapbox://mapbox.mapbox-terrain-dem-v1';
const BUILDING_SOURCE_ID: string = 'composite';
const BUILDING_SOURCE_LAYER_ID: string = 'building';
const BUILDING_EXTRUSION_LAYER_ID: string = 'ganapps-map-building-height';
const BUILDING_MIN_ZOOM: number = 16;
const BUILDING_MAX_ZOOM: number = 22;
const BUILDING_EXTRUSION_STYLE: FillExtrusionLayerStyle = {
  fillExtrusionColor: '#9ca3af',
  fillExtrusionHeight: ['to-number', ['get', 'height'], 0],
  fillExtrusionBase: ['to-number', ['get', 'min_height'], 0],
  fillExtrusionOpacity: 0.9,
  fillExtrusionVerticalGradient: true,
};

/**
 * Selects a built-in map style with compatible composite building sources.
 * @param theme - Resolved application appearance.
 * @returns The style URL without changing camera state.
 */
function resolveMapStyleURL(theme: 'light' | 'dark'): string {
  return theme === 'dark' ? Mapbox.StyleURL.Dark : 'mapbox://styles/mapbox/streets-v12';
}

interface CameraPadding {
  readonly paddingTop: number;
  readonly paddingBottom: number;
  readonly paddingLeft: number;
  readonly paddingRight: number;
}

interface CameraViewSnapshot {
  readonly centerCoordinate: [number, number];
  readonly zoomLevel: number;
  readonly heading: number;
  readonly pitch: number;
  readonly padding: CameraPadding;
}

type SelectionClearReason = 'restore' | 'keep-current' | 'search-target';

interface SelectionClearCameraViewInput {
  readonly reason: SelectionClearReason;
  readonly hasUserGestureDuringSelection: boolean;
  readonly originalView: CameraViewSnapshot | null;
  readonly currentView: CameraViewSnapshot;
}

interface MutableValue<T> {
  current: T;
}

interface MapPressGuardInput {
  readonly isSelectionActive: MutableValue<boolean>;
  readonly lastFeaturePressAt: MutableValue<number | null>;
  readonly featurePressCount: MutableValue<number>;
  readonly mapPressTimeout: MutableValue<ReturnType<typeof setTimeout> | null>;
  readonly clearSelection: () => void;
}

const ZERO_CAMERA_PADDING: CameraPadding = {
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
};

function getCameraViewSnapshot(state: MapState, padding: CameraPadding): CameraViewSnapshot {
  return {
    centerCoordinate: [state.properties.center[0], state.properties.center[1]],
    zoomLevel: state.properties.zoom,
    heading: state.properties.heading,
    pitch: state.properties.pitch,
    padding,
  };
}

function getSelectionClearCameraView({
  reason,
  hasUserGestureDuringSelection,
  originalView,
  currentView,
}: SelectionClearCameraViewInput): CameraViewSnapshot {
  if (reason === 'restore' && !hasUserGestureDuringSelection && originalView !== null) return originalView;

  return {
    ...currentView,
    padding: originalView === null ? currentView.padding : originalView.padding,
  };
}

function handleMapPressWithGuard({
  isSelectionActive,
  lastFeaturePressAt,
  featurePressCount,
  mapPressTimeout,
  clearSelection,
}: MapPressGuardInput): void {
  if (!isSelectionActive.current) return;
  if (mapPressTimeout.current !== null) clearTimeout(mapPressTimeout.current);

  const mapPressStartedAt: number = Date.now();
  const featurePressCountAtStart: number = featurePressCount.current;
  const recentFeaturePressBeforeMapTap: boolean =
    lastFeaturePressAt.current !== null &&
    mapPressStartedAt - lastFeaturePressAt.current <= FEATURE_PRESS_PROPAGATION_WINDOW_MS;

  mapPressTimeout.current = setTimeout((): void => {
    mapPressTimeout.current = null;
    const featurePressedAfterMapTap: boolean = featurePressCount.current !== featurePressCountAtStart;
    if (!recentFeaturePressBeforeMapTap && !featurePressedAfterMapTap && isSelectionActive.current) {
      clearSelection();
    }
  }, MAP_FEATURE_PRESS_GUARD_MS);
}

function SelectionTerrain({
  isActive,
  buildingsVisible,
}: {
  readonly isActive: boolean;
  readonly buildingsVisible: boolean;
}): ReactElement | null {
  if (!isActive) return null;

  return (
    <>
      <RasterDemSource id={TERRAIN_SOURCE_ID} url={TERRAIN_SOURCE_URL} tileSize={512} maxZoomLevel={14} />
      <Terrain sourceID={TERRAIN_SOURCE_ID} style={{ exaggeration: 2 }} />
      {buildingsVisible && (
        <FillExtrusionLayer
          id={BUILDING_EXTRUSION_LAYER_ID}
          sourceID={BUILDING_SOURCE_ID}
          sourceLayerID={BUILDING_SOURCE_LAYER_ID}
          minZoomLevel={BUILDING_MIN_ZOOM}
          maxZoomLevel={BUILDING_MAX_ZOOM}
          aboveLayerID="building"
          filter={['all', ['==', ['get', 'extrude'], 'true'], ['has', 'height']]}
          style={BUILDING_EXTRUSION_STYLE}
        />
      )}
    </>
  );
}
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
  const theme = useResolvedTheme();
  const mapHeight = useSharedValue<number>(0);
  const sheetPosition = useSharedValue<number>(-1);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const discovery = useGanapDiscovery();
  const { search, setSearch, tag, setTag, tags, map, feed, nearby } = discovery;
  const { items, isLoading, isError, error, refetch } = map;
  const userCoords = nearby.coords;
  const isNearbyActive: boolean = nearby.isActive;
  const hasSearchText: boolean = search.trim().length > 0;
  const hasActiveFilters: boolean =
    tag !== null || discovery.filters.search !== undefined || discovery.filters.radius !== undefined;
  const isSearchSettled: boolean = search.trim() === (discovery.filters.search ?? '');
  const hasPendingSearch: boolean = hasSearchText && (!isSearchSettled || map.isFetching);
  const hasSearchError: boolean = hasSearchText && isSearchSettled && isError;
  const shouldShowMapError: boolean = isError && !hasSearchText;
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
  const cameraViewRef = useRef<CameraViewSnapshot>({
    centerCoordinate: ILOILO_CITY_CENTER,
    zoomLevel: CITY_ZOOM,
    heading: 0,
    pitch: OVERHEAD_PITCH,
    padding: ZERO_CAMERA_PADDING,
  });
  const selectionReturnViewRef = useRef<CameraViewSnapshot | null>(null);
  const isSelectionActiveRef = useRef<boolean>(false);
  const hasUserGestureDuringSelectionRef = useRef<boolean>(false);
  const lastFeaturePressAtRef = useRef<number | null>(null);
  const featurePressCountRef = useRef<number>(0);
  const mapPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewport, setViewport] = useState<MapViewport>(DEFAULT_MAP_VIEWPORT);
  const [cameraPitch, setCameraPitch] = useState<number>(OVERHEAD_PITCH);
  const [buildingsVisible, setBuildingsVisible] = useState<boolean>(true);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [selectedGanap, setSelectedGanap] = useState<GanapListItem | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<GanapClusterFeature | null>(null);
  const [selectedClusterIndex, setSelectedClusterIndex] = useState<GanapClusterIndex | null>(null);

  const clusterIndex = useMemo(() => createGanapClusterIndex(items), [items]);
  const visibleFeatures = useMemo(() => getVisibleMapFeatures(clusterIndex, viewport), [clusterIndex, viewport]);

  const activeCluster: GanapClusterFeature | null = selectedClusterIndex === clusterIndex ? selectedCluster : null;
  const hasActiveSelection: boolean = selectedGanap !== null || activeCluster !== null;

  useEffect(() => {
    if (MAPBOX_TOKEN) {
      void Mapbox.setAccessToken(MAPBOX_TOKEN);
    }
  }, []);

  const centreOnUser = useCallback(
    (coords: Coords): void => {
      const padding: CameraPadding = {
        paddingTop: insets.top + MAP_OVERLAY_TOP,
        paddingBottom: MAP_OVERLAY_BOTTOM,
        paddingLeft: 0,
        paddingRight: 0,
      };
      if (isSelectionActiveRef.current) hasUserGestureDuringSelectionRef.current = true;
      cameraViewRef.current = {
        ...cameraViewRef.current,
        centerCoordinate: [coords.longitude, coords.latitude],
        zoomLevel: USER_ZOOM,
        padding,
      };
      cameraRef.current?.setCamera({
        centerCoordinate: [coords.longitude, coords.latitude],
        zoomLevel: USER_ZOOM,
        animationDuration: 500,
        padding,
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
    setCameraPitch(Math.round(state.properties.pitch));
    const zoom: number = state.properties.zoom;
    mapZoomRef.current = zoom;
    cameraViewRef.current = getCameraViewSnapshot(state, cameraViewRef.current.padding);
    isClusterZoomPendingRef.current = false;
    setViewport(
      mapStateToViewport({
        bounds: state.properties.bounds,
        zoom,
      }),
    );
  }, []);

  const handleCameraChanged = useCallback((state: MapState): void => {
    setCameraPitch(Math.round(state.properties.pitch));
    const nextViewport: MapViewport = mapStateToViewport({
      bounds: state.properties.bounds,
      zoom: state.properties.zoom,
    });
    setViewport((current: MapViewport): MapViewport => (current.zoom === nextViewport.zoom ? current : nextViewport));
    mapZoomRef.current = state.properties.zoom;
    cameraViewRef.current = getCameraViewSnapshot(state, cameraViewRef.current.padding);
    if (isSelectionActiveRef.current && state.gestures.isGestureActive) {
      hasUserGestureDuringSelectionRef.current = true;
    }
  }, []);

  const beginSelection = useCallback((): void => {
    if (mapPressTimeoutRef.current !== null) {
      clearTimeout(mapPressTimeoutRef.current);
      mapPressTimeoutRef.current = null;
    }
    lastFeaturePressAtRef.current = Date.now();
    featurePressCountRef.current += 1;
    if (isSelectionActiveRef.current) return;

    selectionReturnViewRef.current = {
      ...cameraViewRef.current,
      centerCoordinate: [...cameraViewRef.current.centerCoordinate],
    };
    isSelectionActiveRef.current = true;
    hasUserGestureDuringSelectionRef.current = false;
  }, []);

  const requestClusterZoom = useCallback(
    (target: ClusterZoomTarget, pitch: number = LOCATION_SELECTION_PITCH): void => {
      const camera = cameraRef.current;
      if (camera === null || isClusterZoomPendingRef.current) return;

      const zoom: number = Math.min(target.zoom, CLUSTER_EXPANSION_MAX_ZOOM);
      if (zoom <= mapZoomRef.current) return;

      isClusterZoomPendingRef.current = true;
      setCameraPitch(pitch);
      const padding: CameraPadding = {
        paddingTop: insets.top + MAP_OVERLAY_TOP,
        paddingBottom: MAP_OVERLAY_BOTTOM,
        paddingLeft: 0,
        paddingRight: 0,
      };
      cameraViewRef.current = {
        ...cameraViewRef.current,
        centerCoordinate: [...target.coordinate],
        zoomLevel: zoom,
        pitch,
        padding,
      };
      camera.setCamera({
        centerCoordinate: target.coordinate,
        zoomLevel: zoom,
        pitch,
        animationDuration: 300,
        padding,
      });
    },
    [insets.top],
  );

  const handleGanapPress = useCallback(
    (ganap: GanapListItem): void => {
      beginSelection();
      setSelectedCluster(null);
      setSelectedClusterIndex(null);
      setSelectedGanap(ganap);
      setCameraPitch(LOCATION_SELECTION_PITCH);
      const zoom: number = Math.max(mapZoomRef.current, LOCATION_SELECTION_ZOOM);
      const padding: CameraPadding = {
        paddingTop: insets.top + MAP_OVERLAY_TOP,
        paddingBottom: MAP_OVERLAY_BOTTOM,
        paddingLeft: 0,
        paddingRight: 0,
      };
      cameraViewRef.current = {
        ...cameraViewRef.current,
        centerCoordinate: [ganap.locationLong, ganap.locationLat],
        zoomLevel: zoom,
        pitch: LOCATION_SELECTION_PITCH,
        padding,
      };
      cameraRef.current?.setCamera({
        centerCoordinate: [ganap.locationLong, ganap.locationLat],
        zoomLevel: zoom,
        pitch: LOCATION_SELECTION_PITCH,
        animationDuration: 500,
        padding,
      });
    },
    [beginSelection, insets.top],
  );

  const handleClusterPress = useCallback(
    (cluster: GanapClusterFeature): void => {
      if (isClusterZoomPendingRef.current) return;
      beginSelection();
      setSelectedCluster(cluster);
      setSelectedClusterIndex(clusterIndex);
      const target: ClusterZoomTarget | null = resolveClusterZoomTarget(clusterIndex, cluster);
      if (target !== null) requestClusterZoom(target);
    },
    [beginSelection, clusterIndex, requestClusterZoom],
  );

  const handleClearSelection = useCallback((reason: SelectionClearReason = 'restore'): void => {
    if (mapPressTimeoutRef.current !== null) {
      clearTimeout(mapPressTimeoutRef.current);
      mapPressTimeoutRef.current = null;
    }
    const wasSelectionActive: boolean = isSelectionActiveRef.current;
    const originalView: CameraViewSnapshot | null = selectionReturnViewRef.current;
    const targetView: CameraViewSnapshot = getSelectionClearCameraView({
      reason,
      hasUserGestureDuringSelection: hasUserGestureDuringSelectionRef.current,
      originalView,
      currentView: cameraViewRef.current,
    });
    setSelectedGanap(null);
    setSelectedCluster(null);
    setSelectedClusterIndex(null);
    isSelectionActiveRef.current = false;
    hasUserGestureDuringSelectionRef.current = false;
    selectionReturnViewRef.current = null;

    if (!wasSelectionActive || reason === 'search-target') return;

    setCameraPitch(OVERHEAD_PITCH);
    cameraViewRef.current = { ...targetView, pitch: OVERHEAD_PITCH };
    mapZoomRef.current = targetView.zoomLevel;
    cameraRef.current?.setCamera({
      centerCoordinate: targetView.centerCoordinate,
      zoomLevel: targetView.zoomLevel,
      heading: targetView.heading,
      pitch: OVERHEAD_PITCH,
      animationDuration: 500,
      padding: targetView.padding,
    });
  }, []);

  const handleMapPress = useCallback((): void => {
    handleMapPressWithGuard({
      isSelectionActive: isSelectionActiveRef,
      lastFeaturePressAt: lastFeaturePressAtRef,
      featurePressCount: featurePressCountRef,
      mapPressTimeout: mapPressTimeoutRef,
      clearSelection: handleClearSelection,
    });
  }, [handleClearSelection]);

  useEffect((): (() => void) => {
    return (): void => {
      if (mapPressTimeoutRef.current !== null) clearTimeout(mapPressTimeoutRef.current);
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: clear selections when a new map index replaces them.
  useEffect((): void => {
    if (isSelectionActiveRef.current) handleClearSelection('keep-current');
  }, [clusterIndex, handleClearSelection]);

  const handleOpenGanap = useCallback(
    (ganap: GanapListItem): void => {
      router.push(Routes.ganapDetail(ganap.id));
    },
    [router],
  );

  const handleClusterZoomIn = useCallback(
    (target: ClusterZoomTarget): void => {
      requestClusterZoom(target, OVERHEAD_PITCH);
    },
    [requestClusterZoom],
  );

  const handleSelectSearchSuggestion = useCallback(
    (ganap: GanapListItem): void => {
      handleClearSelection('search-target');
      setCameraPitch(OVERHEAD_PITCH);
      const padding: CameraPadding = {
        paddingTop: insets.top + MAP_OVERLAY_TOP,
        paddingBottom: MAP_OVERLAY_BOTTOM,
        paddingLeft: 0,
        paddingRight: 0,
      };
      cameraViewRef.current = {
        ...cameraViewRef.current,
        centerCoordinate: [ganap.locationLong, ganap.locationLat],
        zoomLevel: USER_ZOOM,
        pitch: OVERHEAD_PITCH,
        padding,
      };
      cameraRef.current?.setCamera({
        centerCoordinate: [ganap.locationLong, ganap.locationLat],
        zoomLevel: USER_ZOOM,
        pitch: OVERHEAD_PITCH,
        animationDuration: 500,
        padding,
      });
    },
    [handleClearSelection, insets.top],
  );

  const handlePitchChange = useCallback((requestedPitch: number): void => {
    if (!Number.isFinite(requestedPitch)) return;
    const pitch: number = Math.max(OVERHEAD_PITCH, Math.min(MAX_MAP_PITCH, Math.round(requestedPitch)));
    if (isSelectionActiveRef.current) hasUserGestureDuringSelectionRef.current = true;
    const view: CameraViewSnapshot = { ...cameraViewRef.current, pitch };
    cameraViewRef.current = view;
    setCameraPitch(pitch);
    cameraRef.current?.setCamera({ ...view, animationDuration: 0 });
  }, []);

  const handleOverhead = useCallback((): void => {
    if (isSelectionActiveRef.current) hasUserGestureDuringSelectionRef.current = true;
    const view: CameraViewSnapshot = { ...cameraViewRef.current, pitch: OVERHEAD_PITCH, heading: 0 };
    cameraViewRef.current = view;
    setCameraPitch(OVERHEAD_PITCH);
    cameraRef.current?.setCamera({ ...view, animationDuration: 0 });
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
    return <Loading message="Finding events..." />;
  }

  if (shouldShowMapError) {
    return <ErrorView error={error} onRetry={refetch} />;
  }

  return (
    <View
      className="flex-1"
      onLayout={(event: LayoutChangeEvent): void => {
        mapHeight.value = event.nativeEvent.layout.height;
      }}
    >
      <MapView
        style={{ flex: 1 }}
        styleURL={resolveMapStyleURL(theme)}
        scaleBarEnabled={false}
        attributionEnabled
        logoEnabled
        onMapIdle={handleMapIdle}
        onCameraChanged={handleCameraChanged}
        onPress={handleMapPress}
        onDidFinishLoadingMap={handleMapReady}
      >
        <Camera ref={cameraRef} centerCoordinate={ILOILO_CITY_CENTER} zoomLevel={CITY_ZOOM} animationMode="none" />
        <SelectionTerrain isActive={hasActiveSelection} buildingsVisible={buildingsVisible} />
        {userCoords !== null && <LocationPuck puckBearing="heading" puckBearingEnabled />}
        <ClusteredGanapMarkers
          features={visibleFeatures}
          onGanapPress={handleGanapPress}
          onClusterPress={handleClusterPress}
        />
      </MapView>

      <View className="absolute left-0 right-0" style={{ top: insets.top + 12 }} pointerEvents="box-none">
        <View className="mx-4">
          <MapSearchBar
            value={search}
            onChangeText={setSearch}
            suggestions={items}
            isLoadingSuggestions={hasPendingSearch}
            isErrorSuggestions={hasSearchError}
            onSelectSuggestion={handleSelectSearchSuggestion}
          />
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

      <MapControlsOverlay
        side="left"
        hasSelection={hasActiveSelection}
        mapHeight={mapHeight}
        sheetPosition={sheetPosition}
        topOverlayHeight={insets.top + MAP_OVERLAY_TOP}
      >
        <MapViewControls
          pitch={cameraPitch}
          buildingsVisible={buildingsVisible}
          onPitchChange={handlePitchChange}
          onOverhead={handleOverhead}
          onBuildingsChange={setBuildingsVisible}
        />
      </MapControlsOverlay>

      <MapControlsOverlay
        side="right"
        hasSelection={hasActiveSelection}
        mapHeight={mapHeight}
        sheetPosition={sheetPosition}
        topOverlayHeight={insets.top + MAP_OVERLAY_TOP}
      >
        <LocateMeButton onPress={handleLocateMe} />
      </MapControlsOverlay>

      <LocationPrimingSheet
        visible={nearby.isPrimingVisible}
        onConfirm={(): void => {
          void nearby.confirmPriming();
        }}
        onDismiss={nearby.dismissPriming}
      />

      {hasActiveSelection && (
        <GanapFeedSheet
          feed={feed}
          hasActiveFilters={hasActiveFilters}
          isNearbyApplied={isNearbyApplied}
          topOverlayHeight={insets.top + MAP_OVERLAY_TOP}
          animatedPosition={sheetPosition}
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
