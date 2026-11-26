import { LucideProvider } from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { Capsule } from '@/components/common/Capsule';
import { Glass, type RimWidth } from '@/components/common/Glass';
import { PressableScale } from '@/components/common/PressableScale';
import { Colors } from '@/constants/theme';
import type { TouchTarget } from '@/constants/touch-target';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

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

/** Rim width per size: the small button gets the hairline so the ring does not crowd the icon. */
const rimBySize: Record<IconButtonSize, RimWidth> = { sm: 'hair', md: 'md' };

/** Layout the material receives: it fills the pressable and centres the icon. */
const MATERIAL_CLASSES = 'flex-1 items-center justify-center';

/** The looks an {@link IconButton} can take. */
export type IconButtonVariant = 'default' | 'ghost' | 'glass';

interface IconButtonProps {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  selected?: boolean;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
}

/**
 * Circular pressable for icon-only actions.
 *
 * `default` is a muted Capsule, `ghost` (the default) a strong Glass pane and `glass` a regular Glass
 * pane. The `Pressable` keeps the size and the disabled dimming; the material fills it and centres the
 * icon. A selected button tints its icon with `primary-text`.
 *
 * Icons inside default to the theme's foreground color, as they do in {@link Button}.
 * Without that default a Lucide icon draws black, which disappears on the dark
 * background. An icon's own `color` or `className` still wins.
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
  const theme = useResolvedTheme();

  const iconColor = Colors[theme][selected ? 'primary-text' : 'foreground'];
  const rim = rimBySize[size];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      hitSlop={target.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      className={`${sizeClassName} ${disabled ? 'opacity-50' : ''}`}
      scaleTo={0.94}
    >
      {({ pressed }) => {
        const icon = <LucideProvider color={iconColor}>{children}</LucideProvider>;

        return variant === 'default' ? (
          <Capsule tone="muted" pressed={pressed} className={MATERIAL_CLASSES}>
            {icon}
          </Capsule>
        ) : (
          <Glass
            variant={variant === 'glass' ? 'regular' : 'strong'}
            rim={rim}
            pressed={pressed}
            className={MATERIAL_CLASSES}
          >
            {icon}
          </Glass>
        );
      }}
    </PressableScale>
  );
}
