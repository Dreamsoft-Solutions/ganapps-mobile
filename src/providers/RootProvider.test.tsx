import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { useMutation } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ComponentType, ReactElement } from 'react';
import { Pressable, Text } from 'react-native';
import { useToastStore } from '@/store/toast.store';
import { SUPPRESS_GLOBAL_ERROR_TOAST_META } from '@/utils/toast-message';
import { RootProvider } from './RootProvider';

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native') as { View: ComponentType };
  return { GestureHandlerRootView: View };
});

interface ProbeProps {
  /** Whether the mutation opts out of the global error toast. */
  suppress: boolean;
}

function Probe({ suppress }: ProbeProps): ReactElement {
  const mutation = useMutation<unknown, Error, void>({
    mutationFn: (): Promise<unknown> => Promise.reject(new Error('boom')),
    meta: suppress ? { [SUPPRESS_GLOBAL_ERROR_TOAST_META]: true } : undefined,
    // No lingering garbage-collection timer after unmount, so the worker can exit.
    gcTime: 0,
  });

  return (
    <Pressable onPress={(): void => mutation.mutate()}>
      <Text>{mutation.isError ? 'failed' : 'idle'}</Text>
    </Pressable>
  );
}

describe('RootProvider error toasts', (): void => {
  afterEach((): void => {
    // Dismiss and drop any toasts so the auto-dismiss timers do not outlive the test.
    const { toasts, dismiss } = useToastStore.getState();
    toasts.forEach((toast) => {
      dismiss(toast.id);
    });
    useToastStore.setState({ toasts: [] });
  });

  it('shows a toast for mutation errors not handled by a form', async (): Promise<void> => {
    const { getByText } = await render(
      <RootProvider>
        <Probe suppress={false} />
      </RootProvider>,
    );

    await fireEvent.press(getByText('idle'));
    await waitFor((): void => {
      expect(getByText('failed')).toBeTruthy();
    });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].title).toBe('boom');
  });

  it('skips the toast for mutations opted out via metadata', async (): Promise<void> => {
    const { getByText } = await render(
      <RootProvider>
        <Probe suppress />
      </RootProvider>,
    );

    await fireEvent.press(getByText('idle'));
    await waitFor((): void => {
      expect(getByText('failed')).toBeTruthy();
    });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
