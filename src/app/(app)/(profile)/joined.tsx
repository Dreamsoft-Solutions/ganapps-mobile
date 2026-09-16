import type { ReactElement } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BAR_HEIGHT } from '@/components/navigation/AppTabBar';
import { JoinedGanapsList } from '@/components/profile/JoinedGanapsList';
import { Spacing } from '@/constants/theme';

/**
 * Full list of Ganaps joined by the current User.
 *
 * @returns The paginated joined Ganap list.
 */
export default function JoinedGanapsScreen(): ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <JoinedGanapsList contentTopPadding={Spacing.md} contentBottomPadding={insets.bottom + BAR_HEIGHT + Spacing.xs} />
  );
}
