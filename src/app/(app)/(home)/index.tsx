import Mapbox, { Camera, MapView, MarkerView } from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorView } from '@/components/common/Error';
import { Loading } from '@/components/common/Loading';
import { Text } from '@/components/common/Text';
import { GanapMapPin } from '@/components/map/GanapMapPin';
import { MapSearchBar } from '@/components/map/MapSearchBar';
import { SelectedGanapCard } from '@/components/map/SelectedGanapCard';
import { TagChips } from '@/components/map/TagChips';
import { Routes } from '@/constants/routes';
import { useGanapsMap } from '@/hooks/useGanapsMap';
import type { GanapListItem } from '@/types/ganap.types';

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

  const [selectedGanap, setSelectedGanap] = useState<GanapListItem | null>(null);

  useEffect(() => {
    if (MAPBOX_TOKEN) {
      void Mapbox.setAccessToken(MAPBOX_TOKEN);
    }
  }, []);

  const markers = useMemo(
    () =>
      items.map((ganap) => (
        <MarkerView key={ganap.id} coordinate={[ganap.locationLong, ganap.locationLat]} anchor={{ x: 0.5, y: 0.5 }}>
          <Pressable onPress={(): void => setSelectedGanap(ganap)}>
            <GanapMapPin ganap={ganap} />
          </Pressable>
        </MarkerView>
      )),
    [items],
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
      >
        <Camera centerCoordinate={CPU_CENTER} zoomLevel={INITIAL_ZOOM} animationMode="none" />
        {markers}
      </MapView>

      <View className="absolute left-0 right-0" style={{ top: insets.top + 12 }} pointerEvents="box-none">
        <View className="mx-4">
          <MapSearchBar value={search} onChangeText={setSearch} />
        </View>
        <TagChips tags={tags} selectedTag={tag} onSelectTag={setTag} />
      </View>

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
