import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

jest.mock('lucide-react-native', () => ({
  LucideProvider: ({ children }: { children: ReactNode }): ReactElement => <>{children}</>,
}));

import { effectiveTargetPx, MIN_TOUCH_TARGET } from '@/constants/touch-target';
import { classLineHeightDp, classSizeDp, spacingDp } from '@/utils/tailwind-metrics';
import { Button, type ButtonSize, buttonSizeTargets, buttonTextVariants, buttonVariants } from './Button';

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

describe('Button touch targets', (): void => {
  const sizes: ButtonSize[] = Object.keys(buttonSizeTargets) as ButtonSize[];

  it('offers no size variant below the platform minimum', (): void => {
    for (const size of sizes) {
      expect(effectiveTargetPx(buttonSizeTargets[size].target)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
    }
  });

  it('declares the padding and line height its classes actually render', (): void => {
    for (const size of sizes) {
      const className: string = buttonVariants({ size });
      const { paddingYPx, lineHeightPx } = buttonSizeTargets[size];
      expect(classSizeDp(className, 'py')).toBe(paddingYPx);
      expect(classLineHeightDp(buttonTextVariants({ size }))).toBe(lineHeightPx);
    }
  });

  it('derives its height from padding, line height, and any min-height floor', (): void => {
    for (const size of sizes) {
      const { paddingYPx, lineHeightPx, minHeightToken, target } = buttonSizeTargets[size];
      const intrinsic: number = paddingYPx * 2 + lineHeightPx;
      const floor: number = minHeightToken === null ? 0 : spacingDp(minHeightToken);
      expect(target.sizePx).toBe(Math.max(intrinsic, floor));
    }
  });

  it('applies the min-height floor as a class wherever the map claims one', (): void => {
    for (const size of sizes) {
      const { minHeightToken } = buttonSizeTargets[size];
      const className: string = buttonVariants({ size });
      if (minHeightToken === null) {
        expect(className).not.toMatch(/(?:^|\s)min-h-/);
      } else {
        expect(className).toContain(`min-h-${minHeightToken}`);
      }
    }
  });

  it('gives the short variant the slop that closes its gap', async (): Promise<void> => {
    const screen = await render(
      <Button size="sm" onPress={(): void => {}}>
        Retry image
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Retry image' }).props.hitSlop).toBe(buttonSizeTargets.sm.target.hitSlop);
  });
});
