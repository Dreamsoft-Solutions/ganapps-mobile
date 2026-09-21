import { LocateFixed } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable } from 'react-native';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

interface LocateMeButtonProps {
  onPress: () => void;
}

/**
 * Floating control that recentres the map on the user.
 *
 * Stays visible without permission, since tapping it is one of the two ways a
 * user reaches the priming sheet.
 *
 * @param props - The press handler
 * @returns The locate-me button
 */
export function LocateMeButton({ onPress }: LocateMeButtonProps): ReactElement {
  const theme = useResolvedTheme();

  return (
    <Pressable
      onPress={onPress}
      className="h-touch w-touch items-center justify-center rounded-full bg-card border border-border shadow"
      accessibilityRole="button"
      accessibilityLabel="Centre the map on my location"
    >
      <LocateFixed size={20} color={Colors[theme].foreground} />
    </Pressable>
  );
}
