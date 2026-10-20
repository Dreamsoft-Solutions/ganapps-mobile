import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Updates display time at an event's end and when returning to the foreground.
 * @param endDate - Authoritative ISO end; absent or invalid ends do not schedule a boundary.
 * @returns Current display time, refreshed at the end boundary or foreground entry.
 */
export function useEventTime(endDate?: string | null): Date {
  const [now, setNow] = useState<Date>((): Date => new Date());
  useEffect((): (() => void) => {
    const endTime: number = endDate ? new Date(endDate).getTime() : Number.NaN;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = (): void => {
      const current: Date = new Date();
      setNow(current);
      if (timer !== undefined) clearTimeout(timer);
      if (Number.isFinite(endTime) && endTime > current.getTime()) {
        timer = setTimeout(refresh, Math.min(endTime - current.getTime(), 2_147_483_647));
      }
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state: AppStateStatus): void => {
      if (state === 'active') refresh();
    });
    return (): void => {
      if (timer !== undefined) clearTimeout(timer);
      subscription.remove();
    };
  }, [endDate]);
  return now;
}
