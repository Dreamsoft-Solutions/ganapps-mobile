import * as Location from 'expo-location';
import { Platform } from 'react-native';

/** A position on the device, rounded before it ever leaves it. */
export interface Coords {
  latitude: number;
  longitude: number;
}

/** The OS location grant as this app needs to reason about it. */
export interface LocationPermissionState {
  granted: boolean;
  canAskAgain: boolean;
  accuracy: 'full' | 'reduced' | null;
}

const COORD_PRECISION = 2; // 2dp ~= Apple's coarse-location threshold

/**
 * Rounds one coordinate to the precision the app is allowed to transmit.
 *
 * Apple treats anything at or finer than three decimal places as Precise
 * Location, so 2 dp is what lets DS-83 declare coarse location honestly. It
 * quantises to roughly 1.1 km, which is deliberate: the filter trades radius
 * accuracy for a truthful privacy label. See ADR 0003.
 *
 * @param value - A latitude or longitude in degrees
 * @returns The same coordinate at two decimal places
 */
export function roundCoord(value: number): number {
  const factor = 10 ** COORD_PRECISION;
  return Math.round(value * factor) / factor;
}

function toPermissionState(response: Location.LocationPermissionResponse): LocationPermissionState {
  return {
    granted: response.granted,
    canAskAgain: response.canAskAgain,
    accuracy: Platform.OS === 'ios' ? (response.ios?.accuracy ?? null) : null,
  };
}

/**
 * Reads the current location grant without ever raising the system dialog.
 *
 * @returns The grant as the OS reports it right now
 */
export function getPermissionStatus(): Promise<LocationPermissionState> {
  return Location.getForegroundPermissionsAsync().then(toPermissionState); // never prompts
}

/**
 * Raises the iOS permission dialog, which the OS allows exactly once.
 *
 * Call this only behind the priming sheet: once denied, the app can never ask
 * again and can only route the user to Settings.
 *
 * @returns The grant the user chose
 */
export function requestPermission(): Promise<LocationPermissionState> {
  return Location.requestForegroundPermissionsAsync().then(toPermissionState); // the one iOS prompt
}

/**
 * Reads one position and rounds it before returning.
 *
 * Rounding happens here rather than at the call site so no caller can hold a
 * full-precision coordinate.
 *
 * @returns The device position at transmittable precision
 * @throws When location services are off or the grant has been revoked
 */
export function getCurrentCoords(): Promise<Coords> {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
    (position): Coords => ({
      latitude: roundCoord(position.coords.latitude),
      longitude: roundCoord(position.coords.longitude),
    }),
  );
}
