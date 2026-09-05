import { LocateFixed } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable } from 'react-native';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

interface LocateMeButtonProps {
  onPress: () => void;
}

export function LocateMeButton({ onPress }: LocateMeButtonProps): ReactElement {
  const theme = useResolvedTheme();

  return (
    <Pressable
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-full bg-card border border-border shadow"
      accessibilityRole="button"
      accessibilityLabel="Centre the map on my location"
    >
      <LocateFixed size={20} color={Colors[theme].foreground} />
    </Pressable>
  );
}
