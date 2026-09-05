import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface LocationPermissionState {
  granted: boolean;
  canAskAgain: boolean;
  accuracy: 'full' | 'reduced' | null;
}

const COORD_PRECISION = 2; // 2dp ~= Apple's coarse-location threshold

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

export function getPermissionStatus(): Promise<LocationPermissionState> {
  return Location.getForegroundPermissionsAsync().then(toPermissionState); // never prompts
}

export function requestPermission(): Promise<LocationPermissionState> {
  return Location.requestForegroundPermissionsAsync().then(toPermissionState); // the one iOS prompt
}

export function getCurrentCoords(): Promise<Coords> {
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
    (position): Coords => ({
      latitude: roundCoord(position.coords.latitude),
      longitude: roundCoord(position.coords.longitude),
    }),
  );
}
