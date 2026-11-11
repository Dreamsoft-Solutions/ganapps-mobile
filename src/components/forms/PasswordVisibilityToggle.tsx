import { Eye, EyeOff } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { IconButton } from '@/components/common/IconButton';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

interface PasswordVisibilityToggleProps {
  /** Whether the password is currently shown. */
  visible: boolean;
  onPress: () => void;
  /** What the field holds, read after "Show" or "Hide", such as "password". */
  label: string;
}

/**
 * The eye button at the end of a password field that shows or hides what was typed.
 *
 * Every password field uses it, so sign-up, log in and password reset behave the same.
 *
 * @param props - Whether the password is shown, the press handler, and the field's name.
 * @returns A small ghost icon button for an `Input`'s `iconRight` slot.
 */
export function PasswordVisibilityToggle({ visible, onPress, label }: PasswordVisibilityToggleProps): ReactElement {
  const color: string = Colors[useResolvedTheme()]['muted-foreground'];
  return (
    <IconButton
      onPress={onPress}
      accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label}`}
      size="sm"
      variant="ghost"
    >
      {visible ? <EyeOff size={18} color={color} /> : <Eye size={18} color={color} />}
    </IconButton>
  );
}
