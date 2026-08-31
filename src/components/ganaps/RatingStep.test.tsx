import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';
import type { RatingStepProps } from './RatingStep';

jest.mock('lucide-react-native', () => ({
  ArrowLeft: (): null => null,
  Star: (): null => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: (): { top: number; bottom: number; left: number; right: number } => ({
    top: 24,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' => 'light',
}));

jest.mock('@/components/common/Text', () => ({
  Text: ({ children }: { children: ReactNode }): ReactElement => <MockText>{children}</MockText>,
}));

jest.mock('@/components/common/IconButton', () => ({
  IconButton: ({ children, onPress }: { children: ReactNode; onPress: () => void }): ReactElement => (
    <MockPressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onPress}>
      {children}
    </MockPressable>
  ),
}));

jest.mock('@/components/common/Button', () => ({
  Button: ({
    children,
    disabled,
    onPress,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onPress: () => void;
  }): ReactElement => (
    <MockPressable
      accessibilityRole="button"
      accessibilityLabel={typeof children === 'string' ? children : undefined}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
    >
      <MockView>
        <MockText>{children}</MockText>
      </MockView>
    </MockPressable>
  ),
}));

import { RatingStep } from './RatingStep';

const defaultProps: RatingStepProps = {
  ganapTitle: 'Coffee & Code',
  isSubmitting: false,
  submissionError: null,
  onSubmit: jest.fn<(score: number) => void>(),
  onBack: jest.fn<() => void>(),
};

async function renderRatingStep(overrides: Partial<RatingStepProps> = {}): Promise<Awaited<ReturnType<typeof render>>> {
  return await render(<RatingStep {...defaultProps} {...overrides} />);
}

describe('RatingStep optional skip', (): void => {
  it('renders no Skip control when onSkip is undefined', async (): Promise<void> => {
    const screen = await renderRatingStep({ onSkip: undefined });

    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('renders Skip and invokes it when onSkip is provided', async (): Promise<void> => {
    const onSkip = jest.fn<() => void>();
    const screen = await renderRatingStep({ onSkip });

    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});

describe('RatingStep rating selection', (): void => {
  it('submits the selected valid star score', async (): Promise<void> => {
    const onSubmit = jest.fn<(score: number) => void>();
    const screen = await renderRatingStep({ onSubmit });

    await fireEvent.press(screen.getByRole('button', { name: '4 stars' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Submit rating' }));

    expect(onSubmit).toHaveBeenCalledWith(4);
  });
});
