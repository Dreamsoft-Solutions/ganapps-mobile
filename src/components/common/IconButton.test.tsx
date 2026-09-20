import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Heart } from 'lucide-react-native';

jest.mock('lucide-react-native', () => ({
  Heart: (): null => null,
}));

import { effectiveTargetPx, MIN_TOUCH_TARGET } from '@/constants/touch-target';
import { classSizeDp } from '@/utils/tailwind-metrics';
import { IconButton, type IconButtonSize, iconButtonSizeStyles } from './IconButton';

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

describe('IconButton touch targets', (): void => {
  const sizes: IconButtonSize[] = Object.keys(iconButtonSizeStyles) as IconButtonSize[];

  it('offers no size variant below the platform minimum', (): void => {
    for (const size of sizes) {
      expect(effectiveTargetPx(iconButtonSizeStyles[size].target)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });

  it('declares the size its classes actually render', (): void => {
    for (const size of sizes) {
      const { className, target } = iconButtonSizeStyles[size];
      expect(classSizeDp(className, 'w')).toBe(target.sizePx);
      expect(classSizeDp(className, 'h')).toBe(target.sizePx);
    }
  });

  it('sizes the default variant from a token the rem base cannot shrink', (): void => {
    expect(classSizeDp(iconButtonSizeStyles.md.className, 'w')).toBe(MIN_TOUCH_TARGET);
  });

  it('no longer offers a lg variant', (): void => {
    expect(sizes).toEqual(['sm', 'md']);
  });

  it('passes the declared hit slop to the pressable', async (): Promise<void> => {
    const screen = await render(
      <IconButton size="sm" accessibilityLabel="Toggle password" onPress={(): void => {}}>
        <Heart />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Toggle password' }).props.hitSlop).toBe(
      iconButtonSizeStyles.sm.target.hitSlop,
    );
  });
});
