import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactElement, ReactNode } from 'react';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, useColorScheme, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { Text } from './Text';

const buttonVariants = cva('flex flex-row items-center justify-center rounded-lg active:opacity-70', {
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
      md: 'px-4 py-3',
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

const textVariants = cva('font-inter-semibold text-center', {
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

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
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

  const isOutlinedOrGhost = variant === 'outline' || variant === 'ghost' || variant === 'link';
  const colorScheme = useColorScheme();
  const spinnerColor = isOutlinedOrGhost
    ? Colors[colorScheme === 'dark' ? 'dark' : 'light'].foreground
    : Colors.light['primary-foreground'];

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      className={buttonVariants({ variant, size, disabled: disabled || loading })}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {leftIcon && <View className="mr-2">{leftIcon}</View>}
          <Text className={textVariants({ variant, size })}>{children}</Text>
          {rightIcon && <View className="ml-2">{rightIcon}</View>}
        </>
      )}
    </Pressable>
  );
}
