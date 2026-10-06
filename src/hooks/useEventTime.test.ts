import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useEventTime } from './useEventTime';

describe('useEventTime', (): void => {
  beforeEach((): void => {
    jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
    jest.setSystemTime(new Date('2026-10-06T12:00:00Z'));
  });
  afterEach((): void => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('updates exactly when the end is reached while mounted', async (): Promise<void> => {
    const { result, unmount } = await renderHook((): Date => useEventTime('2026-10-06T12:00:01Z'));
    await act((): void => {
      jest.advanceTimersByTime(999);
    });
    expect(result.current.getTime()).toBe(new Date('2026-10-06T12:00:00Z').getTime());
    await act((): void => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.getTime()).toBe(new Date('2026-10-06T12:00:01Z').getTime());
    await unmount();
  });

  it('replaces the old boundary and removes timers and foreground listener on unmount', async (): Promise<void> => {
    const remove = jest.fn<() => void>();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
    const { result, rerender, unmount } = await renderHook(({ end }: { end: string }): Date => useEventTime(end), {
      initialProps: { end: '2026-10-06T12:00:01Z' },
    });
    await rerender({ end: '2026-10-06T12:00:02Z' });
    await act((): void => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.getTime()).toBe(new Date('2026-10-06T12:00:00Z').getTime());
    await act((): void => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.getTime()).toBe(new Date('2026-10-06T12:00:02Z').getTime());
    await unmount();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('refreshes when returning from the background even when timers did not run', async (): Promise<void> => {
    let onChange: ((state: AppStateStatus) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener): { remove: () => void } => {
      onChange = listener;
      return { remove: (): void => {} };
    });
    const { result, unmount } = await renderHook((): Date => useEventTime(null));
    jest.setSystemTime(new Date('2026-10-06T13:00:00Z'));
    await act((): void => {
      onChange?.('active');
    });
    expect(result.current.getTime()).toBe(new Date('2026-10-06T13:00:00Z').getTime());
    expect(jest.getTimerCount()).toBe(0);
    await unmount();
  });
});
