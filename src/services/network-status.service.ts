import { onlineManager } from '@tanstack/react-query';
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { useConnectionStore } from '@/store/connection.store';

/**
 * Reads whether a network state counts as online.
 *
 * An unknown value counts as online, so a slow first answer never blocks requests.
 *
 * @param state - The state expo-network reported
 * @returns Whether the device has a usable connection
 */
function isNetworkStateOnline(state: NetworkState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

/**
 * Tells TanStack Query and the connection store when the device goes offline or back online.
 *
 * Without this, TanStack Query on React Native assumes it is always online, so a refresh
 * sent offline fails with a network error instead of waiting. With it, queries pause while
 * offline and refetch once the connection returns. Call it once, before the first query runs.
 *
 * @returns Nothing. TanStack Query owns the subscription from here on.
 */
export function startNetworkStatus(): void {
  onlineManager.setEventListener((setOnline: (isOnline: boolean) => void): (() => void) => {
    const apply = (state: NetworkState): void => {
      const isOnline: boolean = isNetworkStateOnline(state);
      setOnline(isOnline);
      useConnectionStore.getState().setDeviceOnline(isOnline);
    };
    const subscription = addNetworkStateListener(apply);
    void getNetworkStateAsync()
      .then(apply)
      .catch((): void => undefined);
    return (): void => subscription.remove();
  });
}
