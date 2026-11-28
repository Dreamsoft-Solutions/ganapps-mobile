import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarIslandTop } from '@/components/navigation/AppTabBar';
import { Spacing } from '@/constants/theme';
import { type TabBarState, useTabBarStore } from '@/store/tab-bar.store';

/** How far the floating tab bar dock reaches up from the screen's bottom edge. */
export interface TabBarInsets {
  /** Distance in dp from the screen's bottom edge to the top of the dock: the island, plus the connection banner when it shows. */
  dockTop: number;
  /** Bottom padding in dp a tab screen's scroll content needs so its last row scrolls clear of the dock. */
  contentClearance: number;
}

/**
 * Measures the room the floating tab bar takes at the bottom of a tab screen, including the
 * connection banner that floats above the island while the app is offline or the connection is unstable.
 *
 * @example
 * const { contentClearance } = useTabBarInsets();
 * <ScrollView contentContainerStyle={{ paddingBottom: contentClearance }} />
 *
 * @returns The dock's top edge and the scroll clearance, in dp.
 */
export function useTabBarInsets(): TabBarInsets {
  const insets = useSafeAreaInsets();
  const aboveIslandHeight: number = useTabBarStore((state: TabBarState): number => state.aboveIslandHeight);
  return {
    dockTop: getTabBarIslandTop(insets.bottom) + aboveIslandHeight,
    contentClearance: insets.bottom + Spacing['tabbar-clearance'] + aboveIslandHeight,
  };
}
