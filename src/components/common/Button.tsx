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
export const buttonVariants = cva('flex flex-row items-center justify-center rounded-lg active:opacity-70', {
  variants: {
    variant: {
      default: 'bg-primary shadow',
      secondary: 'bg-secondary',
      outline: 'border border-input bg-background',
      ghost: 'bg-transparent',
      destructive: 'bg-destructive',
      link: 'bg-transparent underline-offset-4',
    },
    size: {
      sm: 'px-3 py-2',
      md: 'px-4 py-3 min-h-touch',
      lg: 'px-6 py-4',
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
  /** Vertical padding per edge, in dp — `py-2` resolves to 7 here, not 8. */
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
 * height. Both come off Tailwind's numeric scale, which NativeWind resolves
 * against a 14px rem, so the numbers here are 0.875x the values Tailwind's
 * documentation states. `Button.test.tsx` resolves them from the real theme
 * rather than trusting this comment.
 *
 * `md` cannot reach the floor on padding alone — 10.5dp either side of a 21dp
 * line height is 42dp — so it carries `min-h-touch`. That makes the default
 * button 6dp taller than it was before DS-119.
 *
 * `sm` is the one variant that stays short deliberately: it marks secondary
 * actions in dense rows, and growing it would reflow every caller. 9dp per edge
 * takes its 31.5dp to 49.5dp without changing a pixel of what is drawn.
 */
export const buttonSizeTargets: Record<ButtonSize, ButtonSizeTarget> = {
  sm: { paddingYPx: 7, lineHeightPx: 17.5, minHeightToken: null, target: { sizePx: 31.5, hitSlop: 9 } },
  md: { paddingYPx: 10.5, lineHeightPx: 21, minHeightToken: 'touch', target: { sizePx: 48, hitSlop: 0 } },
  lg: { paddingYPx: 14, lineHeightPx: 24.5, minHeightToken: null, target: { sizePx: 52.5, hitSlop: 0 } },
};

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  children: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/**
 * Primary button primitive.
 *
 * @param props - Variant, size, press handler, label, and optional icons.
 * @returns A themed pressable button.
 */
export function Button({
  variant,
  size,
  onPress,
  disabled,
  loading,
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

  const resolvedSize: ButtonSize = size ?? 'md';
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
      accessibilityLabel={children}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      hitSlop={buttonSizeTargets[resolvedSize].target.hitSlop}
      className={buttonVariants({ variant, size, disabled: disabled || loading })}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {leftIcon && (
            <View className="mr-2">
              <LucideProvider color={contentColor}>{leftIcon}</LucideProvider>
            </View>
          )}
          <Text className={buttonTextVariants({ variant, size })}>{children}</Text>
          {rightIcon && (
            <View className="ml-2">
              <LucideProvider color={contentColor}>{rightIcon}</LucideProvider>
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}
