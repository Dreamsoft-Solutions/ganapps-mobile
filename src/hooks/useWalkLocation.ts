import { useEffect, useState } from 'react';
import { type Coords, getCurrentCoords, getPermissionStatus } from '@/services/location.service';
import type { WalkLocation } from './useEventWalk';

/** How long a walk waits for a position before it starts without one. */
const LOCATION_WAIT_MS = 4000;

/**
 * Reads the position an Event Walk starts from, once.
 *
 * Never prompts: a walk is no reason to spend the one iOS location dialog, so a User who has
 * not allowed location gets a walk without distance. The position is rounded by the location
 * service before it gets here.
 *
 * @returns `resolving` until the position or its absence is known, then `ready`
 */
export function useWalkLocation(): WalkLocation {
  const [location, setLocation] = useState<WalkLocation>({ status: 'resolving' });

  useEffect((): (() => void) => {
    let active = true;

    const readCoords = async (): Promise<Coords | null> => {
      try {
        const permission = await getPermissionStatus();
        return permission.granted ? await getCurrentCoords() : null;
      } catch {
        return null;
      }
    };
    const giveUp: Promise<null> = new Promise((resolve): void => {
      setTimeout((): void => resolve(null), LOCATION_WAIT_MS);
    });

    void Promise.race([readCoords(), giveUp]).then((coords: Coords | null): void => {
      if (active) setLocation({ status: 'ready', coords });
    });

    return (): void => {
      active = false;
    };
  }, []);

  return location;
}
