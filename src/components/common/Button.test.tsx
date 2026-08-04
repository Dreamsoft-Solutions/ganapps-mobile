import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

jest.mock('lucide-react-native', () => ({
  LucideProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
}));

import { Button } from './Button';

describe('Button accessibility', (): void => {
  it('does not call a disabled button handler', async (): Promise<void> => {
    const onPress = jest.fn<() => void>();
    const screen = await render(
      <Button disabled accessibilityHint="Reporting is not available yet" onPress={onPress}>
        Report Event
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Report Event' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: false });
  });

  it('reports loading as a busy disabled button', async (): Promise<void> => {
    const screen = await render(
      <Button loading onPress={(): void => {}}>
        Join event
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Join event' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  });
});
