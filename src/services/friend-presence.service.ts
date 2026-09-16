import { AppState, type AppStateStatus } from 'react-native';
import { friendsAPI } from '@/api/endpoints/friends';
import { storage } from '@/utils/storage';

/** Presence heartbeat cadence required while an authenticated device is active. */
export const FRIEND_PRESENCE_HEARTBEAT_INTERVAL_MS: number = 30_000;

const FRIEND_PRESENCE_DEVICE_KEY: string = 'ganapps_friends_presence_device_id';

/** Generates an opaque, non-account device identity for the presence set. */
function createDeviceId(): string {
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Reads or creates the local opaque device identity used by presence heartbeats. */
async function getDeviceId(): Promise<string> {
  const existing: string | null = await storage.get<string>(FRIEND_PRESENCE_DEVICE_KEY);
  if (existing?.trim()) return existing;
  const created: string = createDeviceId();
  await storage.set(FRIEND_PRESENCE_DEVICE_KEY, created);
  return created;
}

/** Sends one best-effort heartbeat without surfacing background lifecycle failures. */
async function sendHeartbeat(isActive: () => boolean): Promise<void> {
  try {
    const deviceId: string = await getDeviceId();
    if (isActive()) await friendsAPI.heartbeat(deviceId);
  } catch {
    // Presence is advisory; a missed heartbeat must never block the app shell.
  }
}

/**
 * Starts the authenticated device's short-lived presence heartbeat.
 *
 * Heartbeats pause while the app is backgrounded and resume immediately on the
 * next active transition. Cleanup is the logout/deletion boundary.
 *
 * @returns Cleanup function that stops timers and lifecycle listeners
 */
export function startFriendPresenceHeartbeat(): () => void {
  let active: boolean = true;
  const isActive = (): boolean => active && AppState.currentState === 'active';
  const heartbeat = (): void => {
    void sendHeartbeat(isActive);
  };

  if (AppState.currentState === 'active') heartbeat();

  const timer: ReturnType<typeof setInterval> = setInterval((): void => {
    if (isActive()) heartbeat();
  }, FRIEND_PRESENCE_HEARTBEAT_INTERVAL_MS);
  const subscription = AppState.addEventListener('change', (state: AppStateStatus): void => {
    if (state === 'active') heartbeat();
  });

  return (): void => {
    if (!active) return;
    active = false;
    clearInterval(timer);
    subscription.remove();
  };
}
