import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BAR_HEIGHT } from '@/components/navigation/AppTabBar';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { JoinedGanapsList } from '@/components/profile/JoinedGanapsList';
import { Spacing } from '@/constants/theme';

/**
 * Full list of Ganaps joined by the current User.
 *
 * @returns The paginated joined Ganap list.
 */
export default function JoinedGanapsScreen(): ReactElement {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Joined events" onBack={(): void => router.back()} backHint="Returns to your profile" />
      <JoinedGanapsList contentTopPadding={Spacing.md} contentBottomPadding={insets.bottom + BAR_HEIGHT + Spacing.xs} />
    </View>
  );
}
