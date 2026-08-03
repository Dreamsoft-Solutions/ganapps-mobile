import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Heart } from 'lucide-react-native';

jest.mock('lucide-react-native', () => ({
  Heart: (): null => null,
}));

import { IconButton } from './IconButton';

describe('IconButton accessibility', (): void => {
  it('does not call a disabled icon handler', async (): Promise<void> => {
    const onPress = jest.fn<() => void>();
    const screen = await render(
      <IconButton
        disabled
        accessibilityLabel="Like event"
        accessibilityHint="Join the event to enable this action"
        onPress={onPress}
      >
        <Heart />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Like event' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('exposes selected state for a selected icon action', async (): Promise<void> => {
    const screen = await render(
      <IconButton selected accessibilityLabel="Unlike event" onPress={(): void => {}}>
        <Heart />
      </IconButton>,
    );

    const button = screen.getByRole('button', { name: 'Unlike event' });
    expect(button.props.accessibilityState).toMatchObject({ selected: true });
  });
});
