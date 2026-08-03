import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import type { ComponentType, ReactElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import { showToast, useToastStore } from '@/store/toast.store';
import { ToastHost } from './ToastHost';

jest.mock('lucide-react-native', () => {
  const { View } = jest.requireActual('react-native') as { View: ComponentType };
  const Icon = (): ReactElement => <View />;
  return { CircleAlert: Icon, CheckCircle2: Icon, Info: Icon };
});

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native') as { View: ComponentType };
  const builder = { reduceMotion: (): object => builder };
  return {
    __esModule: true,
    default: { View },
    FadeInDown: builder,
    FadeOut: builder,
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
  };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

describe('ToastHost', (): void => {
  beforeEach((): void => {
    // `announceForAccessibility` is already a jest mock in the RN preset, so
    // `spyOn` reuses that instance and its call history leaks across tests.
    jest.clearAllMocks();
  });

  afterEach((): void => {
    const { toasts, dismiss } = useToastStore.getState();
    toasts.forEach((toast) => {
      dismiss(toast.id);
    });
    useToastStore.setState({ toasts: [] });
    jest.restoreAllMocks();
  });

  it('renders the active toasts', async (): Promise<void> => {
    await act((): void => {
      showToast('error', 'Something failed');
    });

    const { getByRole } = await render(<ToastHost />);

    expect(getByRole('button')).toBeTruthy();
  });

  it('announces each new toast to the screen reader exactly once', async (): Promise<void> => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation((): void => undefined);
    await render(<ToastHost />);

    await act((): void => {
      showToast('error', 'Something failed');
    });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('Something failed');

    await act((): void => {
      showToast('info', 'A second note');
    });
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith('A second note');

    // A re-render with unchanged toasts must not re-announce.
    await act((): void => {
      useToastStore.setState((state) => ({ toasts: [...state.toasts] }));
    });
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it('announces title and message together', async (): Promise<void> => {
    const announce = jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation((): void => undefined);
    await render(<ToastHost />);

    await act((): void => {
      showToast('error', 'Something failed', 'The server is unreachable');
    });

    expect(announce).toHaveBeenCalledWith('Something failed, The server is unreachable');
  });
});
