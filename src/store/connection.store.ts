import { create } from 'zustand';

/**
 * How well the app can reach the API right now.
 *
 * `'offline'` means the device reports no connection. `'unstable'` means it reports one,
 * but the last API request got no response, which is how a weak signal or captive Wi-Fi
 * shows up.
 */
export type ConnectionStatus = 'online' | 'offline' | 'unstable';

interface ConnectionState {
  /** Whether the device reports a network connection. Starts `true` until expo-network answers. */
  isDeviceOnline: boolean;
  /** Whether the last API request sent while the device was online got no response. */
  isApiUnreachable: boolean;
  /** Records the device's connection, and forgets the last request's result when it changes. */
  setDeviceOnline: (isOnline: boolean) => void;
  /** Records that an API request got a response, whatever its status. */
  reportApiReachable: () => void;
  /** Records that an API request got no response. */
  reportApiUnreachable: () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  isDeviceOnline: true,
  isApiUnreachable: false,

  setDeviceOnline: (isOnline: boolean): void => {
    if (get().isDeviceOnline === isOnline) return;
    set({ isDeviceOnline: isOnline, isApiUnreachable: false });
  },

  reportApiReachable: (): void => {
    if (get().isApiUnreachable) set({ isApiUnreachable: false });
  },

  reportApiUnreachable: (): void => {
    const state = get();
    if (state.isDeviceOnline && !state.isApiUnreachable) set({ isApiUnreachable: true });
  },
}));

/**
 * Reduces the connection state to the one status the UI shows.
 *
 * @param state - The connection store's state
 * @returns The status to show
 */
export function selectConnectionStatus(state: ConnectionState): ConnectionStatus {
  if (!state.isDeviceOnline) return 'offline';
  return state.isApiUnreachable ? 'unstable' : 'online';
}
