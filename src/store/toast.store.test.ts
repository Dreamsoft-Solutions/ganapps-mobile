import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { dismissToast, MAX_TOASTS, showToast, TOAST_DURATION_MS, useToastStore } from './toast.store';

describe('toast store', (): void => {
  beforeEach((): void => {
    jest.useFakeTimers();
  });

  afterEach((): void => {
    useToastStore.setState({ toasts: [] });
    jest.useRealTimers();
  });

  it('shows a toast with the given content', (): void => {
    const id = showToast('error', 'Something failed');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ id, type: 'error', title: 'Something failed' });
  });

  it('keeps an optional message line', (): void => {
    showToast('error', 'Something failed', 'The server is unreachable');

    expect(useToastStore.getState().toasts[0].message).toBe('The server is unreachable');
  });

  it('deduplicates identical toasts', (): void => {
    const first = showToast('error', 'Something failed');
    const second = showToast('error', 'Something failed');

    expect(second).toBe(first);
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('keeps toasts that differ in message separate', (): void => {
    showToast('error', 'Something failed', 'First detail');
    showToast('error', 'Something failed', 'Second detail');

    expect(useToastStore.getState().toasts).toHaveLength(2);
  });

  it('dismisses a toast immediately', (): void => {
    const id = showToast('error', 'Something failed');

    dismissToast(id);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('auto-dismisses a toast after the duration', (): void => {
    showToast('error', 'Something failed');

    jest.advanceTimersByTime(TOAST_DURATION_MS);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('cancels auto-dismissal for toasts dismissed early', (): void => {
    const first = showToast('error', 'First');
    showToast('error', 'Second');

    dismissToast(first);
    jest.advanceTimersByTime(TOAST_DURATION_MS - 1000);

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].title).toBe('Second');

    jest.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('evicts the oldest toast when the maximum is exceeded', (): void => {
    for (let i = 0; i < MAX_TOASTS + 1; i += 1) {
      showToast('info', `Toast ${i}`);
    }

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(MAX_TOASTS);
    expect(toasts[0].title).toBe('Toast 1');
  });
});
