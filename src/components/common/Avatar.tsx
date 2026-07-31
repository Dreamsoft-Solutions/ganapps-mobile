import type { ReactElement } from 'react';
import { Image, View } from 'react-native';
import { Text } from './Text';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-10 h-10',
  md: 'w-20 h-20',
  lg: 'w-28 h-28',
};

const textSizeClasses: Record<AvatarSize, string> = {
  sm: 'text-sm',
  md: 'text-2xl',
  lg: 'text-3xl',
};

/**
 * Extracts initials from a full name.
 *
 * @param name - Full name to abbreviate.
 * @returns One or two uppercase initials, or an empty string.
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

/**
 * User avatar with image fallback to initials or the default avatar asset.
 *
 * @param props - Image URL, display name, and size.
 * @returns A themed avatar.
 */
export function Avatar({ src, name = '', size = 'md' }: AvatarProps): ReactElement {
  const initials = getInitials(name);
  const defaultAvatar = require('../../../assets/images/default-avatar.jpg');

  return (
    <View
      className={`${sizeClasses[size]} items-center justify-center overflow-hidden rounded-full bg-muted border border-border`}
    >
      {src ? (
        <Image source={{ uri: src }} className="w-full h-full" resizeMode="cover" />
      ) : initials ? (
        <Text className={`${textSizeClasses[size]} font-inter-bold text-primary`}>{initials}</Text>
      ) : (
        <Image source={defaultAvatar} className="w-full h-full" resizeMode="cover" />
      )}
    </View>
  );
}
