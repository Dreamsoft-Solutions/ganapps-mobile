import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import type { Ganap } from '@/types/ganap.types';

const PIN_SIZE: number = 56;
const PIN_RADIUS: number = PIN_SIZE / 2;
const LOGO_INSET: number = 9;

interface GanapMapPinProps {
  ganap: Ganap;
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

  return (
    <View className="items-center justify-start" style={{ width: PIN_SIZE, height: PIN_SIZE + 8 }}>
      <View
        className="items-center justify-center bg-[#05212d]"
        style={{
          width: PIN_SIZE,
          height: PIN_SIZE,
          borderTopLeftRadius: PIN_RADIUS,
          borderTopRightRadius: PIN_RADIUS,
          borderBottomRightRadius: PIN_RADIUS,
          borderBottomLeftRadius: 0,
          transform: [{ rotate: '-45deg' }],
          shadowColor: '#05212d',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.28,
          shadowRadius: 24,
          elevation: 8,
        }}
      >
        <View
          className="items-center justify-center overflow-hidden bg-white"
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
            <MapPin size={20} color="#05212d" />
          )}
        </View>
      </View>
    </View>
  );
}
