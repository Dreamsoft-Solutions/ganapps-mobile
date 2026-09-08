import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Coords, LocationPermissionState } from '@/services/location.service';

const mockGetPermissionStatus = jest.fn<() => Promise<LocationPermissionState>>();
const mockRequestPermission = jest.fn<() => Promise<LocationPermissionState>>();
const mockGetCurrentCoords = jest.fn<() => Promise<Coords>>();
const mockOpenSettings = jest.fn<() => Promise<void>>();

jest.mock('@/services/location.service', () => ({
  __esModule: true,
  getPermissionStatus: (): Promise<LocationPermissionState> => mockGetPermissionStatus(),
  requestPermission: (): Promise<LocationPermissionState> => mockRequestPermission(),
  getCurrentCoords: (): Promise<Coords> => mockGetCurrentCoords(),
}));

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true,
  default: { openSettings: (): Promise<void> => mockOpenSettings() },
}));

type AppStateStatus = 'active' | 'background' | 'inactive';

const appStateListeners: Array<(state: AppStateStatus) => void> = [];

jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: {
    addEventListener: (_event: string, listener: (state: AppStateStatus) => void): { remove: () => void } => {
      appStateListeners.push(listener);
      return {
        remove: (): void => {
          const index = appStateListeners.indexOf(listener);
          if (index >= 0) appStateListeners.splice(index, 1);
        },
      };
    },
  },
}));

function emitAppState(state: AppStateStatus): void {
  for (const listener of [...appStateListeners]) listener(state);
}

import { useNearbyLocation } from './useNearbyLocation';

const DENIED_ASKABLE: LocationPermissionState = { granted: false, canAskAgain: true, accuracy: null };
const DENIED_FINAL: LocationPermissionState = { granted: false, canAskAgain: false, accuracy: null };
const DENIED_REDUCED: LocationPermissionState = { granted: false, canAskAgain: false, accuracy: 'reduced' };
const GRANTED_FULL: LocationPermissionState = { granted: true, canAskAgain: false, accuracy: 'full' };
const GRANTED_REDUCED: LocationPermissionState = { granted: true, canAskAgain: false, accuracy: 'reduced' };
const ILOILO: Coords = { latitude: 10.72, longitude: 122.56 };

beforeEach((): void => {
  jest.clearAllMocks();
  mockGetPermissionStatus.mockResolvedValue(DENIED_ASKABLE);
  mockGetCurrentCoords.mockResolvedValue(ILOILO);
});

describe('useNearbyLocation on mount', (): void => {
  it('never raises the system prompt', async (): Promise<void> => {
    await renderHook(() => useNearbyLocation());

    await waitFor((): void => {
      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('loads coords without activating the filter when permission already exists', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_FULL);

    const { result } = await renderHook(() => useNearbyLocation());

    await waitFor((): void => {
      expect(result.current.coords).toEqual(ILOILO);
    });
    expect(result.current.isActive).toBe(false);
  });

  it('does not read a position when permission is absent', async (): Promise<void> => {
    await renderHook(() => useNearbyLocation());

    await waitFor((): void => {
      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });
    expect(mockGetCurrentCoords).not.toHaveBeenCalled();
  });
});

describe('useNearbyLocation toggle', (): void => {
  it('shows the priming sheet instead of prompting on the first tap', async (): Promise<void> => {
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });

    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    expect(result.current.isPrimingVisible).toBe(true);
    expect(result.current.isActive).toBe(false);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('activates without a sheet when permission is already granted', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_FULL);
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(result.current.coords).toEqual(ILOILO);
    });

    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    await waitFor((): void => {
      expect(result.current.isActive).toBe(true);
    });
    expect(result.current.isPrimingVisible).toBe(false);
  });

  it('deactivates when toggled while active', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_FULL);
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(result.current.coords).toEqual(ILOILO);
    });

    await act(async (): Promise<void> => {
      result.current.toggle();
    });
    await waitFor((): void => {
      expect(result.current.isActive).toBe(true);
    });
    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    expect(result.current.isActive).toBe(false);
  });

  it('reports disabled and does nothing when permission was permanently denied', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(DENIED_FINAL);
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(result.current.isDisabled).toBe(true);
    });

    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    expect(result.current.isPrimingVisible).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});

describe('useNearbyLocation priming', (): void => {
  it('prompts once and activates on grant', async (): Promise<void> => {
    mockRequestPermission.mockResolvedValue(GRANTED_FULL);
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });
    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    await act(async (): Promise<void> => {
      await result.current.confirmPriming();
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(result.current.isActive).toBe(true);
    expect(result.current.isPrimingVisible).toBe(false);
  });

  it('stays inactive and disabled when the user denies', async (): Promise<void> => {
    mockRequestPermission.mockResolvedValue(DENIED_FINAL);
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });
    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    await act(async (): Promise<void> => {
      await result.current.confirmPriming();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.isDisabled).toBe(true);
  });

  it('dismisses the sheet without prompting', async (): Promise<void> => {
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });
    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    await act(async (): Promise<void> => {
      result.current.dismissPriming();
    });

    expect(result.current.isPrimingVisible).toBe(false);
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});

describe('useNearbyLocation reduced accuracy', (): void => {
  it('shows the notice only for reduced accuracy', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_REDUCED);
    const { result } = await renderHook(() => useNearbyLocation());

    await waitFor((): void => {
      expect(result.current.isAccuracyNoticeVisible).toBe(true);
    });
  });

  it('does not show the notice when permission is denied outright', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(DENIED_REDUCED);
    const { result } = await renderHook(() => useNearbyLocation());

    await waitFor((): void => {
      expect(result.current.isDisabled).toBe(true);
    });

    expect(result.current.isAccuracyNoticeVisible).toBe(false);
  });

  it('does not show the notice for full accuracy', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_FULL);
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(result.current.coords).toEqual(ILOILO);
    });

    expect(result.current.isAccuracyNoticeVisible).toBe(false);
  });

  it('stays dismissed once dismissed', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_REDUCED);
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(result.current.isAccuracyNoticeVisible).toBe(true);
    });

    await act(async (): Promise<void> => {
      result.current.dismissAccuracyNotice();
    });

    expect(result.current.isAccuracyNoticeVisible).toBe(false);
  });
});

describe('useNearbyLocation failure handling', (): void => {
  it('surfaces a message and stays inactive when the position read fails', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_FULL);
    mockGetCurrentCoords.mockRejectedValue(new Error('location unavailable'));
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(mockGetCurrentCoords).toHaveBeenCalled();
    });

    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    await waitFor((): void => {
      expect(result.current.errorMessage).not.toBeNull();
    });
    expect(result.current.isActive).toBe(false);
  });

  it('opens Settings on request', async (): Promise<void> => {
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });

    await act(async (): Promise<void> => {
      await result.current.openSettings();
    });

    expect(mockOpenSettings).toHaveBeenCalledTimes(1);
  });
});

describe('useNearbyLocation position freshness', (): void => {
  it('re-reads the position every time Nearby is switched on', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_FULL);
    const MOVED: Coords = { latitude: 10.69, longitude: 122.51 };
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(result.current.coords).toEqual(ILOILO);
    });

    await act(async (): Promise<void> => {
      result.current.toggle();
    });
    await waitFor((): void => {
      expect(result.current.isActive).toBe(true);
    });
    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    mockGetCurrentCoords.mockResolvedValue(MOVED);
    await act(async (): Promise<void> => {
      result.current.toggle();
    });

    await waitFor((): void => {
      expect(result.current.coords).toEqual(MOVED);
    });
    expect(result.current.isActive).toBe(true);
  });

  it('refresh reads the position again and returns the new value', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_FULL);
    const MOVED: Coords = { latitude: 10.69, longitude: 122.51 };
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(result.current.coords).toEqual(ILOILO);
    });

    mockGetCurrentCoords.mockResolvedValue(MOVED);
    let returned: Coords | null = null;
    await act(async (): Promise<void> => {
      returned = await result.current.refresh();
    });

    expect(returned).toEqual(MOVED);
    expect(result.current.coords).toEqual(MOVED);
  });

  it('refresh returns null and reads nothing without permission', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(DENIED_ASKABLE);
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });

    let returned: Coords | null = { latitude: 0, longitude: 0 };
    await act(async (): Promise<void> => {
      returned = await result.current.refresh();
    });

    expect(returned).toBeNull();
    expect(mockGetCurrentCoords).not.toHaveBeenCalled();
  });

  it('re-reads the position when the app returns to the foreground', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_FULL);
    const MOVED: Coords = { latitude: 10.69, longitude: 122.51 };
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(result.current.coords).toEqual(ILOILO);
    });

    mockGetCurrentCoords.mockResolvedValue(MOVED);
    await act(async (): Promise<void> => {
      emitAppState('active');
    });

    await waitFor((): void => {
      expect(result.current.coords).toEqual(MOVED);
    });
  });

  it('does not read the position on foreground without permission', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(DENIED_ASKABLE);
    await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(mockGetPermissionStatus).toHaveBeenCalled();
    });

    await act(async (): Promise<void> => {
      emitAppState('active');
    });

    expect(mockGetCurrentCoords).not.toHaveBeenCalled();
  });

  it('does not read the position when the app goes to the background', async (): Promise<void> => {
    mockGetPermissionStatus.mockResolvedValue(GRANTED_FULL);
    const { result } = await renderHook(() => useNearbyLocation());
    await waitFor((): void => {
      expect(result.current.coords).toEqual(ILOILO);
    });
    mockGetCurrentCoords.mockClear();

    await act(async (): Promise<void> => {
      emitAppState('background');
    });

    expect(mockGetCurrentCoords).not.toHaveBeenCalled();
  });
});
