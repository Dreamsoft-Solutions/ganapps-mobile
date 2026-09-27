/** Geographic point supported by the native map applications. */
export interface MapCoordinates {
  latitude: number;
  longitude: number;
}

/** Supported native platform URL formats. */
export type MapLinkPlatform = 'android' | 'ios';

/** Preferred native map URL with a browser fallback. */
export interface ExternalMapLinks {
  preferredUrl: string;
  fallbackUrl: string;
}

/**
 * Builds a native map link and browser fallback for an event location.
 *
 * @param coordinates - Latitude and longitude from the Ganap.
 * @param platform - Native platform whose map URL should be preferred.
 * @param locationName - Optional venue label shown by the map application.
 * @returns Map links when the coordinates are valid, or `null` when they are not.
 */
export function getExternalMapLinks(
  coordinates: MapCoordinates,
  platform: MapLinkPlatform,
  locationName?: string | null,
): ExternalMapLinks | null {
  const { latitude, longitude } = coordinates;
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const coordinatePair: string = `${latitude},${longitude}`;
  const queryLabel: string = locationName?.trim() || 'Ganap location';
  const preferredUrl: string =
    platform === 'ios'
      ? `https://maps.apple.com/?ll=${coordinatePair}&q=${encodeURIComponent(queryLabel)}`
      : `geo:${coordinatePair}?q=${coordinatePair}(${encodeURIComponent(queryLabel)})`;

  return {
    preferredUrl,
    fallbackUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinatePair)}`,
  };
}
