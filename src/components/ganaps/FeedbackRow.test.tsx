import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Text as MockText } from 'react-native';

jest.mock('lucide-react-native', () => ({
  CircleCheck: (): null => null,
  MessageSquare: (): null => null,
}));

jest.mock('@/hooks/useResolvedTheme', () => ({
  useResolvedTheme: (): 'light' => 'light',
}));

jest.mock('@/components/common/Text', () => ({
  Text: ({ children }: { children: ReactNode }): ReactElement => <MockText>{children}</MockText>,
}));

import { FeedbackRow } from './FeedbackRow';

describe('FeedbackRow', (): void => {
  it('renders submitted feedback as a static non-button', async (): Promise<void> => {
    const onPress = jest.fn<() => void>();
    const screen = await render(<FeedbackRow state={{ kind: 'submitted' }} onPress={onPress} />);

    expect(screen.getByText('Feedback submitted')).toBeTruthy();
    expect(screen.getByTestId('feedback-row').props.accessibilityLabel).toBe('Feedback submitted');
    expect(screen.queryByRole('button', { name: 'Feedback submitted' })).toBeNull();
    await fireEvent.press(screen.getByTestId('feedback-row'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders actionable feedback as a pressable Rate this event row', async (): Promise<void> => {
    const onPress = jest.fn<() => void>();
    const screen = await render(<FeedbackRow state={{ kind: 'actionable' }} onPress={onPress} />);

    await fireEvent.press(screen.getByTestId('feedback-row'));
    expect(screen.getByText('Rate this event')).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
