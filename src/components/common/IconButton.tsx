import type { ReactElement, ReactNode } from 'react';
import { Pressable } from 'react-native';
import type { TouchTarget } from '@/constants/touch-target';

/**
 * The sizes an {@link IconButton} renders at.
 *
 * `lg` was dropped in DS-119: it rendered at the same size as `md` once `md`
 * grew to clear the Android minimum, so the two were identical.
 */
export type IconButtonSize = 'sm' | 'md';

/** A size variant's rendered classes paired with the target they produce. */
interface IconButtonSizeStyle {
  /** The Tailwind classes this variant renders. */
  readonly className: string;
  /** The touch target those classes produce, once hit slop is counted. */
  readonly target: TouchTarget;
}

/**
 * Rendered size and resulting touch target for each {@link IconButton} size.
 *
 * `md` sizes from the `touch` token rather than the numeric scale: NativeWind
 * resolves `1rem` to 14px, so `w-12` renders 42dp, not the 48dp its name
 * suggests. `touch` is declared in literal px and is therefore exact.
 *
 * `sm` stays visually 28dp because it sits inside text fields and dense rows
 * where 48dp would crowd the layout; it reaches the floor with slop instead.
 * `IconButton.test.tsx` resolves both entries against the real Tailwind theme
 * and fails on any that lands under 48dp.
 */
export const iconButtonSizeStyles: Record<IconButtonSize, IconButtonSizeStyle> = {
  sm: { className: 'w-8 h-8', target: { sizePx: 28, hitSlop: 10 } },
  md: { className: 'w-touch h-touch', target: { sizePx: 48, hitSlop: 0 } },
};

const variantClasses = {
  default: 'bg-muted',
  ghost: 'bg-transparent',
};

interface IconButtonProps {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  selected?: boolean;
  size?: IconButtonSize;
  variant?: 'default' | 'ghost';
}

/**
 * Circular pressable for icon-only actions.
 *
 * @param props - Press handler, icon node, accessibility label, and styling.
 * @returns A circular icon button.
 */
export function IconButton({
  onPress,
  children,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  selected,
  size = 'md',
  variant = 'ghost',
}: IconButtonProps): ReactElement {
  const { className: sizeClassName, target } = iconButtonSizeStyles[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={target.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      className={`${sizeClassName} ${variantClasses[variant]} items-center justify-center rounded-full active:opacity-70 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {children}
    </Pressable>
  );
}
