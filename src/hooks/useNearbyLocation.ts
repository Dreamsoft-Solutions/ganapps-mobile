import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  type Coords,
  getCurrentCoords,
  getPermissionStatus,
  type LocationPermissionState,
  requestPermission,
} from '@/services/location.service';

const LOCATION_ERROR_MESSAGE = 'Could not read your location. Check that location services are on, then try again.';

export interface UseNearbyLocationResult {
  isActive: boolean;
  isDisabled: boolean;
  coords: Coords | null;
  isPrimingVisible: boolean;
  isAccuracyNoticeVisible: boolean;
  errorMessage: string | null;
  toggle: () => void;
  confirmPriming: () => Promise<void>;
  dismissPriming: () => void;
  dismissAccuracyNotice: () => void;
  openSettings: () => Promise<void>;
}

export function useNearbyLocation(): UseNearbyLocationResult {
  const [permission, setPermission] = useState<LocationPermissionState | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPrimingVisible, setIsPrimingVisible] = useState<boolean>(false);
  const [isAccuracyNoticeDismissed, setIsAccuracyNoticeDismissed] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const loadCoords = useCallback(async (): Promise<Coords | null> => {
    try {
      const next = await getCurrentCoords();
      if (!isMountedRef.current) return null;
      setCoords(next);
      setErrorMessage(null);
      return next;
    } catch {
      if (isMountedRef.current) setErrorMessage(LOCATION_ERROR_MESSAGE);
      return null;
    }
  }, []);

  useEffect((): (() => void) => {
    isMountedRef.current = true;

    void (async (): Promise<void> => {
      const status = await getPermissionStatus(); // never prompts
      if (!isMountedRef.current) return;
      setPermission(status);
      if (status.granted) await loadCoords();
    })();

    return (): void => {
      isMountedRef.current = false;
    };
  }, [loadCoords]);

  const toggle = useCallback((): void => {
    if (isActive) {
      setIsActive(false);
      return;
    }
    if (permission?.granted) {
      void (async (): Promise<void> => {
        const next = coords ?? (await loadCoords());
        if (isMountedRef.current && next) setIsActive(true);
      })();
      return;
    }
    if (permission && !permission.canAskAgain) return;
    setIsPrimingVisible(true);
  }, [coords, isActive, loadCoords, permission]);

  const confirmPriming = useCallback(async (): Promise<void> => {
    setIsPrimingVisible(false);
    const status = await requestPermission(); // the one iOS prompt
    if (!isMountedRef.current) return;
    setPermission(status);
    if (!status.granted) return;
    const next = await loadCoords();
    if (isMountedRef.current && next) setIsActive(true);
  }, [loadCoords]);

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
    isAccuracyNoticeVisible: permission?.accuracy === 'reduced' && !isAccuracyNoticeDismissed,
    errorMessage,
    toggle,
    confirmPriming,
    dismissPriming,
    dismissAccuracyNotice,
    openSettings,
  };
}
