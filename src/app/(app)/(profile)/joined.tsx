import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { View } from 'react-native';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { JoinedGanapsList } from '@/components/profile/JoinedGanapsList';
import { Spacing } from '@/constants/theme';
import { useTabBarInsets } from '@/hooks/useTabBarInsets';

/**
 * Full list of Ganaps joined by the current User.
 *
 * @returns The paginated joined Ganap list.
 */
export default function JoinedGanapsScreen(): ReactElement {
  const { contentClearance } = useTabBarInsets();
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Joined events" onBack={(): void => router.back()} backHint="Returns to your profile" />
      <JoinedGanapsList contentTopPadding={Spacing.md} contentBottomPadding={contentClearance} />
    </View>
  );
}
