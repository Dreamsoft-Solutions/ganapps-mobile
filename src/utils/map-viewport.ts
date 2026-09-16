const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const TILE_SIZE_POINTS = 512; // Mapbox tile size, see ADR 0003
const METRES_PER_KM = 1000;

export const ILOILO_LATITUDE = 10.72;

export const NARROWEST_VIEWPORT_WIDTH_POINTS = 375; // iPhone SE 2nd gen, see ADR 0003

export const SUPPORTED_VIEWPORT_WIDTHS_POINTS = [375, 393, 440];

export const MIN_VISIBLE_SPAN_KM = 2.5;

export const NEARBY_RADIUS_KM = 2;

export const USER_ZOOM = 13.4;

/**
 * Ground distance spanned by a viewport at a given Mapbox zoom.
 *
 * Mapbox measures zoom against 512 point tiles, and a degree of longitude
 * narrows with latitude, so both are factored in rather than assumed. Used to
 * prove USER_ZOOM still clears MIN_VISIBLE_SPAN_KM on the narrowest supported
 * screen. See ADR 0003.
 *
 * @param zoom - Mapbox zoom level
 * @param latitudeDeg - Latitude the viewport is centred on, in degrees
 * @param viewportPoints - Viewport width in points
 * @returns The visible ground distance in kilometres
 */
export function visibleGroundDistanceKm(zoom: number, latitudeDeg: number, viewportPoints: number): number {
  const worldPoints = TILE_SIZE_POINTS * 2 ** zoom;
  const circumferenceAtLatitude = EARTH_CIRCUMFERENCE_M * Math.cos((latitudeDeg * Math.PI) / 180);
  const metresPerPoint = circumferenceAtLatitude / worldPoints;

  return (metresPerPoint * viewportPoints) / METRES_PER_KM;
}
