import type { ReactElement, ReactNode } from 'react';
import { Pressable } from 'react-native';

interface IconButtonProps {
  onPress: () => void;
  children: ReactNode;
  accessibilityLabel: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost';
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
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
  size = 'md',
  variant = 'ghost',
}: IconButtonProps): ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      className={`${sizeClasses[size]} ${variantClasses[variant]} items-center justify-center rounded-full active:opacity-70`}
    >
      {children}
    </Pressable>
  );
}
