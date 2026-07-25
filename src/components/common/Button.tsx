import { cva, type VariantProps } from 'class-variance-authority';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Text } from './Text';

const buttonVariants = cva('rounded-lg flex items-center justify-center active:opacity-70', {
  variants: {
    variant: {
      primary: 'bg-lynx-primary-container',
      secondary: 'bg-white border border-black',
      danger: 'bg-lynx-error',
      ghost: 'bg-transparent',
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
    variant: 'primary',
    size: 'md',
  },
});

const textVariants = cva('font-sans font-semibold text-center', {
  variants: {
    variant: {
      primary: 'text-lynx-on-primary-container',
      secondary: 'text-black',
      danger: 'text-lynx-on-error',
      ghost: 'text-lynx-primary-container',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  children: string;
}

export function Button({ variant, size, onPress, disabled, loading, children }: ButtonProps) {
  const handlePress = useCallback(async () => {
    try {
      await onPress();
    } catch (_error) {
      // handled by global error interceptor
    }
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      className={buttonVariants({ variant, size, disabled })}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? '#1a1c1c' : '#ffffff'} />
      ) : (
        <Text className={textVariants({ variant, size })}>{children}</Text>
      )}
    </Pressable>
  );
}
