import type { ReactElement } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { getExternalMapLinks } from '@/utils/external-map';

interface GanapLocationLinkProps {
  latitude: number;
  longitude: number;
  locationName?: string | null;
  className?: string;
  children: ReactElement;
}

/**
 * Makes a Ganap location open in the device's preferred map application.
 *
 * Invalid coordinates render the same content without a button role, so an
 * unavailable location is never presented as a dead action.
 *
 * @param props - Coordinates, optional venue label, layout class, and row content.
 * @returns An actionable map link for valid coordinates, or a static view.
 */
export function GanapLocationLink({
  latitude,
  longitude,
  locationName,
  className,
  children,
}: GanapLocationLinkProps): ReactElement {
  const platform: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
  const mapLinks = getExternalMapLinks({ latitude, longitude }, platform, locationName);

  if (mapLinks === null) return <View className={className}>{children}</View>;

  const accessibleLocation: string = locationName?.trim() || 'event location';
  const handlePress = (): void => {
    void Linking.openURL(mapLinks.preferredUrl).catch((): void => {
      void Linking.openURL(mapLinks.fallbackUrl).catch((): void => {});
    });
  };

  return (
    <Pressable
      className={className}
      accessibilityRole="button"
      accessibilityLabel={`Open ${accessibleLocation} in maps`}
      accessibilityHint="Opens this location in your map app"
      onPress={handlePress}
    >
      {children}
    </Pressable>
  );
}
