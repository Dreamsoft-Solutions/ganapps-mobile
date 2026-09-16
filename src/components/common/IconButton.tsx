import type { ReactElement, ReactNode } from 'react';
import { Pressable } from 'react-native';

interface IconButtonProps {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
  lg: 'w-12 h-12',
};

const variantClasses = {
  default: 'bg-muted',
  ghost: 'bg-transparent',
};

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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      className={`${sizeClasses[size]} ${variantClasses[variant]} items-center justify-center rounded-full active:opacity-70 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {children}
    </Pressable>
  );
}
