import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { Calendar, Map as MapIcon, MessageCircle, User } from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';

interface TabRoute {
  key: string;
  name: string;
  label: string;
  icon: LucideIcon;
}

const TAB_ROUTES: TabRoute[] = [
  { key: 'map', name: '(home)', label: 'Map', icon: MapIcon },
  { key: 'events', name: '(ganaps)', label: 'My Events', icon: Calendar },
  { key: 'chat', name: '(chat)', label: 'Chat', icon: MessageCircle },
  { key: 'profile', name: '(profile)', label: 'Profile', icon: User },
];

const BAR_HEIGHT: number = 64;

/**
 * Bottom tab bar.
 *
 * @param props - React Navigation bottom tab bar props.
 * @returns The tab bar.
 */
export function AppTabBar({ state, navigation }: BottomTabBarProps): ReactElement {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ paddingBottom: insets.bottom }}>
      <View className="flex-row items-end border-t border-border bg-background" style={{ height: BAR_HEIGHT }}>
        {TAB_ROUTES.map((tab, index): ReactNode => {
          const Icon = tab.icon;
          const isActive = state.index === index;

          return (
            <Pressable
              key={tab.key}
              onPress={(): void => navigation.navigate(tab.name)}
              className="flex-1 items-center justify-end pb-3 px-2"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <Icon size={24} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
              <Text className={`text-label-sm mt-1 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
