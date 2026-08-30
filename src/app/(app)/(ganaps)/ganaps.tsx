import type { ReactElement } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { BAR_HEIGHT } from '@/components/navigation/AppTabBar';
import { JoinedGanapsList } from '@/components/profile/JoinedGanapsList';
import { Spacing } from '@/constants/theme';

export default function GanapsScreen(): ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <View testID="my-events-heading-container" className="px-md" style={{ paddingTop: insets.top + Spacing.md }}>
        <Text accessibilityRole="header" className="font-inter-bold text-headline-md">
          My Events
        </Text>
      </View>
      <JoinedGanapsList contentTopPadding={Spacing.md} contentBottomPadding={insets.bottom + BAR_HEIGHT + Spacing.xs} />
    </View>
  );
}
