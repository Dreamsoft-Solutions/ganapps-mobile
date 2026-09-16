import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { GanapListItem } from '@/types/ganap.types';

const PIN_SIZE: number = 56;
const PIN_BOUNDS: number = Math.ceil(PIN_SIZE * Math.SQRT2);
const PIN_HORIZONTAL_OFFSET: number = (PIN_BOUNDS - PIN_SIZE) / 2;
const PIN_VERTICAL_OFFSET: number = PIN_BOUNDS - (PIN_SIZE / 2 + PIN_SIZE / Math.SQRT2);
const PIN_RADIUS: number = PIN_SIZE / 2;
const LOGO_INSET: number = 9;

interface GanapMapPinProps {
  ganap: GanapListItem;
}

/**
 * Custom teardrop map pin for a Ganap.
 *
 * Replicates the web create-event pin: a dark rotated teardrop with a
 * circular logo inset. Uses `mapPinImage` when available, falling back to
 * `coverImage`, then a generic pin icon.
 *
 * @param props - The Ganap to render.
 * @returns A marker view element.
 */
export function GanapMapPin({ ganap }: GanapMapPinProps): ReactElement {
  const imageUrl = ganap.mapPinImage ?? ganap.coverImage ?? null;
  const theme = useResolvedTheme();

  return (
    <View
      className="items-center justify-start"
      style={{ width: PIN_BOUNDS, height: PIN_BOUNDS }}
      testID="ganap-map-pin"
    >
      <View
        className="items-center justify-center bg-secondary"
        style={{
          position: 'absolute',
          width: PIN_SIZE,
          height: PIN_SIZE,
          left: PIN_HORIZONTAL_OFFSET,
          top: PIN_VERTICAL_OFFSET,
          borderTopLeftRadius: PIN_RADIUS,
          borderTopRightRadius: PIN_RADIUS,
          borderBottomRightRadius: PIN_RADIUS,
          borderBottomLeftRadius: 0,
          transform: [{ rotate: '-45deg' }],
          shadowColor: Colors[theme].secondary,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 24,
          elevation: 8,
        }}
        testID="ganap-map-pin-shape"
      >
        <View
          className="items-center justify-center overflow-hidden bg-secondary-foreground"
          style={{
            position: 'absolute',
            top: LOGO_INSET,
            left: LOGO_INSET,
            right: LOGO_INSET,
            bottom: LOGO_INSET,
            borderRadius: 9999,
            transform: [{ rotate: '45deg' }],
          }}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} contentFit="contain" style={{ width: '100%', height: '100%' }} />
          ) : (
            <MapPin size={20} className="text-secondary" />
          )}
        </View>
      </View>
    </View>
  );
}
