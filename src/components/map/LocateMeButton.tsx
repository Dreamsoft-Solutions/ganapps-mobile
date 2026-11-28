import { LocateFixed } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { IconButton } from '@/components/common/IconButton';

interface LocateMeButtonProps {
  onPress: () => void;
}

/**
 * Floating glass circle that recentres the map on the user.
 *
 * Stays visible without permission, since tapping it is one of the two ways a
 * user reaches the priming sheet.
 *
 * @param props - The press handler
 * @returns The locate-me button
 */
export function LocateMeButton({ onPress }: LocateMeButtonProps): ReactElement {
  return (
    <IconButton variant="glass" onPress={onPress} accessibilityLabel="Centre the map on my location">
      <LocateFixed size={20} />
    </IconButton>
  );
}
