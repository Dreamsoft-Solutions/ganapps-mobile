import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking } from 'react-native';
import {
  type Coords,
  getCurrentCoords,
  getPermissionStatus,
  type LocationPermissionState,
  requestPermission,
} from '@/services/location.service';

const LOCATION_ERROR_MESSAGE = 'Could not read your location. Check that location services are on, then try again.';

/** Everything the map tab needs to drive the Nearby filter. */
export interface UseNearbyLocationResult {
  isActive: boolean;
  isDisabled: boolean;
  coords: Coords | null;
  isPrimingVisible: boolean;
  isAccuracyNoticeVisible: boolean;
  errorMessage: string | null;
  toggle: () => void;
  refresh: () => Promise<Coords | null>;
  confirmPriming: () => Promise<void>;
  dismissPriming: () => void;
  dismissAccuracyNotice: () => void;
  openSettings: () => Promise<void>;
}

/**
 * Owns the location grant, the device position, and the Nearby filter state.
 *
 * Nothing here prompts on mount: the single iOS dialog is spent only from
 * confirmPriming, behind the priming sheet. The grant is re-read rather than
 * cached, so revoking it in Settings surfaces as the denied state instead of a
 * generic read failure. See ADR 0003.
 *
 * @returns Filter state, the current coordinates, and the actions the map binds to
 */
export function useNearbyLocation(): UseNearbyLocationResult {
  const [permission, setPermission] = useState<LocationPermissionState | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPrimingVisible, setIsPrimingVisible] = useState<boolean>(false);
  const [isAccuracyNoticeDismissed, setIsAccuracyNoticeDismissed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const latestPermissionRef = useRef<LocationPermissionState | null>(null);
  latestPermissionRef.current = permission;

  /**
   * Re-reads the OS grant and reconciles local state with it.
   *
   * The grant is not ours to cache: it can be revoked in Settings at any point,
   * including while the app is backgrounded. Whenever that turns out to have
   * happened, the filter and the cached position are dropped rather than left
   * pointed at a coordinate we can no longer refresh.
   *
   * @returns The freshly read permission state, or `null` once unmounted
   */
  const syncPermission = useCallback(async (): Promise<LocationPermissionState | null> => {
    const status = await getPermissionStatus(); // never prompts
    if (!isMountedRef.current) return null;
    setPermission(status);
    latestPermissionRef.current = status;
    if (!status.granted) {
      setIsActive(false);
      setCoords(null);
      setErrorMessage(null);
    }
    return status;
  }, []);

  const loadCoords = useCallback(async (): Promise<Coords | null> => {
    try {
      const next = await getCurrentCoords();
      if (!isMountedRef.current) return null;
      setCoords(next);
      setErrorMessage(null);
      return next;
    } catch {
      if (!isMountedRef.current) return null;
      const status = await syncPermission(); // a revoked grant surfaces here as a failed read
      if (status && !status.granted) return null;
      if (isMountedRef.current) setErrorMessage(LOCATION_ERROR_MESSAGE);
      return null;
    }
  }, [syncPermission]);

  useEffect((): (() => void) => {
    isMountedRef.current = true;

    void (async (): Promise<void> => {
      const status = await syncPermission();
      if (status?.granted) await loadCoords();
    })();

    return (): void => {
      isMountedRef.current = false;
    };
  }, [loadCoords, syncPermission]);

  const toggle = useCallback((): void => {
    if (isActive) {
      setIsActive(false);
      return;
    }
    if (permission?.granted) {
      void (async (): Promise<void> => {
        const next = await loadCoords();
        if (isMountedRef.current && next) setIsActive(true);
      })();
      return;
    }
    if (permission && !permission.canAskAgain) return;
    setIsPrimingVisible(true);
  }, [isActive, loadCoords, permission]);

  const confirmPriming = useCallback(async (): Promise<void> => {
    setIsPrimingVisible(false);
    const status = await requestPermission(); // the one iOS prompt
    if (!isMountedRef.current) return;
    setPermission(status);
    if (!status.granted) return;
    const next = await loadCoords();
    if (isMountedRef.current && next) setIsActive(true);
  }, [loadCoords]);

  const refresh = useCallback(async (): Promise<Coords | null> => {
    if (!latestPermissionRef.current?.granted) return null;
    return loadCoords();
  }, [loadCoords]);

  useEffect((): (() => void) => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus): void => {
      if (state !== 'active') return; // foreground sampling, see ADR 0003
      void (async (): Promise<void> => {
        const status = await syncPermission(); // the grant can change while backgrounded
        if (!status?.granted) return;
        await loadCoords();
      })();
    });

    return (): void => subscription.remove();
  }, [loadCoords, syncPermission]);

  const dismissPriming = useCallback((): void => {
    setIsPrimingVisible(false);
  }, []);

  const dismissAccuracyNotice = useCallback((): void => {
    setIsAccuracyNoticeDismissed(true);
  }, []);

  const openSettings = useCallback((): Promise<void> => Linking.openSettings(), []);

  return {
    isActive,
    isDisabled: permission !== null && !permission.granted && !permission.canAskAgain,
    coords,
    isPrimingVisible,
    isAccuracyNoticeVisible:
      permission?.granted === true && permission.accuracy === 'reduced' && !isAccuracyNoticeDismissed,
    errorMessage,
    toggle,
    refresh,
    confirmPriming,
    dismissPriming,
    dismissAccuracyNotice,
    openSettings,
  };
}
