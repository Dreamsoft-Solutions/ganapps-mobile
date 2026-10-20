import Mapbox, { Camera, MapView, MarkerView } from '@rnmapbox/maps';
import { MapPin } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Card } from '@/components/common/Card';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { GanapDetail } from '@/types/ganap.types';
import { getExternalMapLinks } from '@/utils/external-map';
import { GanapLocationLink } from './GanapLocationLink';

const MAPBOX_TOKEN: string = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

interface EventLocationPreviewProps {
  ganap: GanapDetail;
}

/**
 * Renders the address beneath the map or as the complete location fallback.
 *
 * @param props - Ganap location and optional venue address.
 * @returns A semantic address card.
 */
function AddressCard({ ganap }: EventLocationPreviewProps): ReactElement {
  const label: string = ganap.address?.trim() || 'Location unavailable';

  return (
    <GanapLocationLink
      className="mt-sm"
      latitude={ganap.locationLat}
      longitude={ganap.locationLong}
      locationName={ganap.address}
    >
      <Card className="flex-row items-center">
        <MapPin size={20} className="mr-sm text-primary" />
        <Text className="flex-1 text-body-md" accessibilityRole="text">
          {label}
        </Text>
      </Card>
    </GanapLocationLink>
  );
}

/**
 * Displays a non-interactive Mapbox preview with an address fallback.
 *
 * @param props - Ganap coordinates and address.
 * @returns A bounded map preview followed by its address.
 */
export function EventLocationPreview({ ganap }: EventLocationPreviewProps): ReactElement {
  const theme = useResolvedTheme();
  const [mapFailed, setMapFailed] = useState<boolean>(false);
  const [tokenReady, setTokenReady] = useState<boolean>(false);
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
  const hasValidCoordinates: boolean =
    getExternalMapLinks({ latitude: ganap.locationLat, longitude: ganap.locationLong }, platform, ganap.address) !==
    null;

  useEffect((): void => {
    if (MAPBOX_TOKEN && hasValidCoordinates) {
      void Mapbox.setAccessToken(MAPBOX_TOKEN)
        .then((): void => setTokenReady(true))
        .catch((): void => setMapFailed(true));
    }
  }, [hasValidCoordinates]);

  if (!MAPBOX_TOKEN || mapFailed || !hasValidCoordinates) {
    return <AddressCard ganap={ganap} />;
  }

  if (!tokenReady) {
    return (
      <View>
        <View className="h-40 items-center justify-center overflow-hidden rounded-xl bg-muted">
          <ActivityIndicator color={Colors[theme].primary} />
        </View>
        <AddressCard ganap={ganap} />
      </View>
    );
  }

  return (
    <View>
      <View className="overflow-hidden rounded-xl">
        <MapView
          style={{ height: 160, width: '100%' }}
          styleURL={theme === 'dark' ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          compassEnabled={false}
          scaleBarEnabled={false}
          attributionEnabled
          logoEnabled
          onMapLoadingError={(): void => setMapFailed(true)}
        >
          <Camera centerCoordinate={[ganap.locationLong, ganap.locationLat]} zoomLevel={15.5} animationMode="none" />
          <MarkerView coordinate={[ganap.locationLong, ganap.locationLat]} anchor={{ x: 0.5, y: 0.5 }}>
            <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-primary-foreground bg-primary shadow">
              <MapPin size={20} className="text-primary-foreground" />
            </View>
          </MarkerView>
        </MapView>
      </View>
      <AddressCard ganap={ganap} />
    </View>
  );
}
