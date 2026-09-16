import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => ({
  CircleHelp: (): null => null,
}));

import { FieldHint } from './FieldHint';

describe('FieldHint', (): void => {
  it('reveals the hint from its accessible help button', async (): Promise<void> => {
    const message: string = 'Pick a username with no spaces.';
    const screen = await render(
      <FieldHint accessibilityLabel="Username requirements" message={message} title="Username requirements" />,
    );

    const button = screen.getByRole('button', { name: 'Username requirements' });
    expect(screen.queryByText(message)).toBeNull();

    fireEvent(button, 'press');
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Username requirements' }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
  });
});
