import { Sparkles } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { Pressable } from 'react-native';
import { Text } from '@/components/common/Text';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';

interface ForYouButtonProps {
  /** Starts an Event Walk. */
  onPress: () => void;
}

/**
 * The floating "For you" button beside the map's search bar, which starts an Event Walk.
 *
 * It matches the search bar's surface, a 48dp fully rounded pill with a hairline border, so the two read
 * as one row.
 *
 * @param props - The press handler
 * @returns A pressable pill with the walk's icon and label
 */
export function ForYouButton({ onPress }: ForYouButtonProps): ReactElement {
  const theme = useResolvedTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="For you"
      accessibilityHint="Opens recommended events one at a time"
      className="h-touch flex-row items-center gap-xs rounded-full border border-border bg-card px-md shadow-sm active:opacity-70"
    >
      <Sparkles size={16} color={Colors[theme].primary} />
      <Text className="font-inter-semibold text-body-md">For you</Text>
    </Pressable>
  );
}
