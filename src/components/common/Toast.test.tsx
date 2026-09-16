import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ComponentType, ReactElement } from 'react';
import type { ToastItem } from '@/store/toast.store';
import { Toast } from './Toast';

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

const item: ToastItem = { id: 'toast-1', type: 'error', title: 'Something failed' };

describe('Toast', (): void => {
  it('exposes the content and dismissal hint to screen readers', async (): Promise<void> => {
    const { getByRole } = await render(<Toast item={{ ...item, message: 'Detail' }} onDismiss={jest.fn()} />);

    const toast = getByRole('button');
    expect(toast.props.accessibilityLabel).toBe('Something failed, Detail');
    expect(toast.props.accessibilityHint).toBe('Tap to dismiss');
  });

  it('uses only the title in the label when there is no message', async (): Promise<void> => {
    const { getByRole } = await render(<Toast item={item} onDismiss={jest.fn()} />);

    expect(getByRole('button').props.accessibilityLabel).toBe('Something failed');
  });

  it('dismisses with its id when tapped', async (): Promise<void> => {
    const onDismiss = jest.fn();
    const { getByRole } = await render(<Toast item={item} onDismiss={onDismiss} />);

    await fireEvent.press(getByRole('button'));

    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });
});
