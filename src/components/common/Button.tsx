import { cva, type VariantProps } from 'class-variance-authority';
import { LucideProvider } from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Colors } from '@/constants/theme';
import type { TouchTarget } from '@/constants/touch-target';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { Text } from './Text';

/**
 * Compiled class strings for every {@link Button} variant and size.
 *
 * Exported so `Button.test.tsx` can read the rendered padding back out and
 * check it against {@link buttonSizeTargets}, rather than trusting a comment.
 */
export const buttonVariants = cva('flex flex-row items-center justify-center rounded-lg border active:opacity-70', {
  variants: {
    variant: {
      default: 'border-transparent bg-primary shadow',
      secondary: 'border-transparent bg-secondary',
      outline: 'border-input bg-background',
      ghost: 'border-transparent bg-transparent',
      destructive: 'border-transparent bg-destructive',
      link: 'border-transparent bg-transparent underline-offset-4',
    },
    size: {
      sm: 'px-3 py-2',
      md: 'px-4 py-3 min-h-touch',
      lg: 'px-6 py-4',
      auth: 'h-sign-in px-6',
      link: 'py-2',
    },
    disabled: {
      true: 'opacity-50',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

/**
 * Compiled label classes for every {@link Button} variant and size.
 *
 * Exported so `Button.test.tsx` can resolve the real line height behind each
 * size rather than trusting the number written in {@link buttonSizeTargets}.
 */
export const buttonTextVariants = cva('font-inter-semibold text-center', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      outline: 'text-foreground',
      ghost: 'text-primary',
      destructive: 'text-destructive-foreground',
      link: 'text-primary underline',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      auth: 'text-lg',
      link: 'text-body-md',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

/**
 * The sizes a {@link Button} renders at.
 */
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

/** A size variant's vertical geometry and the target it produces. */
interface ButtonSizeTarget {
  /** Vertical padding plus the 1dp border, per edge, in dp — `py-2` resolves to 7 here, not 8. */
  readonly paddingYPx: number;
  /** The label's line height, in dp — `text-sm` resolves to 17.5 here, not 20. */
  readonly lineHeightPx: number;
  /**
   * Spacing token applied as a `min-h-` floor, or `null` when the variant's own
   * padding already clears {@link MIN_TOUCH_TARGET}.
   */
  readonly minHeightToken: string | null;
  /** The touch target the variant ends up with, once slop is counted. */
  readonly target: TouchTarget;
}

/**
 * Height arithmetic for each {@link Button} size, and the target it produces.
 *
 * A Button has no height class by default — it is padding plus the label's line
 * height, plus a 1dp border on each edge. Every variant draws that border, transparent
 * except on `outline`, so an outline button is the same height as a filled one beside it. Both come off Tailwind's numeric scale, which NativeWind resolves
 * against a 14px rem, so the numbers here are 0.875x the values Tailwind's
 * documentation states. `Button.test.tsx` resolves them from the real theme
 * rather than trusting this comment.
 *
 * `md` cannot reach the floor on padding alone — 11.5dp either side of a 21dp
 * line height is 44dp — so it carries `min-h-touch`. That makes the default
 * button 6dp taller than it was before DS-119.
 *
 * `sm` is the one variant that stays short deliberately: it marks secondary
 * actions in dense rows, and growing it would reflow every caller. 8dp per edge
 * takes its 33.5dp to 49.5dp without changing a pixel of what is drawn.
 *
 * `auth` is for every button in the sign-in flow, which sit beside Apple's
 * native Continue with Apple button. That button sizes its title from its own height, and
 * at a fixed `h-sign-in` (41px) the title measures the same as the `lg` label, so its
 * padding is just the space left around the label. 3.5dp per edge takes it to 48dp.
 *
 * `link` is not passed by callers: every `variant="link"` renders at it, whatever size it
 * is given, so text links match the body copy they sit in. It has no horizontal padding,
 * so an inline link lines up with the sentence before it, and 6dp of slop takes it to 48dp.
 */
export const buttonSizeTargets: Record<ButtonSize, ButtonSizeTarget> = {
  sm: { paddingYPx: 8, lineHeightPx: 17.5, minHeightToken: null, target: { sizePx: 33.5, hitSlop: 8 } },
  md: { paddingYPx: 11.5, lineHeightPx: 21, minHeightToken: 'touch', target: { sizePx: 48, hitSlop: 0 } },
  lg: { paddingYPx: 15, lineHeightPx: 24.5, minHeightToken: null, target: { sizePx: 54.5, hitSlop: 0 } },
  auth: { paddingYPx: 8.25, lineHeightPx: 24.5, minHeightToken: null, target: { sizePx: 41, hitSlop: 3.5 } },
  link: { paddingYPx: 8, lineHeightPx: 20, minHeightToken: null, target: { sizePx: 36, hitSlop: 6 } },
};

/**
 * Picks the size a Button renders at: links always use `link`, everything else its own size.
 *
 * @param variant - The Button's variant
 * @param size - The size the caller asked for, if any
 * @returns The size to render
 */
function resolveButtonSize(
  variant: VariantProps<typeof buttonVariants>['variant'],
  size?: ButtonSize | null,
): ButtonSize {
  if (variant === 'link') return 'link';
  return size ?? 'md';
}

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  /** Screen-reader label when the visible label needs context, such as which row it acts on; defaults to the label. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  children: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * Primary button primitive.
 *
 * Icons in `leftIcon` and `rightIcon` take the label's color and a size set by the Button: 16dp
 * on `sm`, 18dp otherwise. Pass icons without a `size` so every button matches.
 *
 * @param props - Variant, size, press handler, label, optional icons, and optional accessibility label and hint.
 * @returns A themed pressable button.
 */
export function Button({
  variant,
  size,
  onPress,
  disabled,
  loading,
  accessibilityLabel,
  accessibilityHint,
  children,
  leftIcon,
  rightIcon,
}: ButtonProps): ReactElement {
  const handlePress = useCallback(async () => {
    try {
      await onPress();
    } catch (_error) {
      // handled by global error interceptor
    }
  }, [onPress]);

  const resolvedSize: ButtonSize = resolveButtonSize(variant, size);
  const iconSize: number = resolvedSize === 'sm' ? 16 : 18;
  const isOutlinedOrGhost = variant === 'outline' || variant === 'ghost' || variant === 'link';
  const theme = useResolvedTheme();
  const contentColor: string = isOutlinedOrGhost
    ? Colors[theme].foreground
    : variant === 'secondary'
      ? Colors[theme]['secondary-foreground']
      : variant === 'destructive'
        ? Colors[theme]['destructive-foreground']
        : Colors[theme]['primary-foreground'];

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      hitSlop={buttonSizeTargets[resolvedSize].target.hitSlop}
      className={buttonVariants({ variant, size: resolvedSize, disabled: disabled || loading })}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {leftIcon && (
            <View className="mr-2">
              <LucideProvider color={contentColor} size={iconSize}>
                {leftIcon}
              </LucideProvider>
            </View>
          )}
          <Text className={buttonTextVariants({ variant, size: resolvedSize })}>{children}</Text>
          {rightIcon && (
            <View className="ml-2">
              <LucideProvider color={contentColor} size={iconSize}>
                {rightIcon}
              </LucideProvider>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}
