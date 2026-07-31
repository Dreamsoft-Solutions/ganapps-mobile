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
  { key: 'events', name: '(ganaps)', label: 'Events', icon: Calendar },
  { key: 'chat', name: '(chat)', label: 'Chat', icon: MessageCircle },
  { key: 'profile', name: '(profile)', label: 'Profile', icon: User },
];

const ACTIVE_TINT: string = '#00c853';
const INACTIVE_TINT: string = '#6c7b6a';
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
      <View className="flex-row items-end bg-white" style={{ height: BAR_HEIGHT }}>
        {TAB_ROUTES.map((tab, index): ReactNode => {
          const Icon = tab.icon;
          const isActive = state.index === index;
          const color = isActive ? ACTIVE_TINT : INACTIVE_TINT;

          return (
            <Pressable
              key={tab.key}
              onPress={(): void => navigation.navigate(tab.name)}
              className="flex-1 items-center justify-end pb-3 px-2"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <Icon size={24} color={color} />
              <Text className={`text-label-sm mt-1 ${isActive ? 'text-lynx-primary-container' : 'text-lynx-outline'}`}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
