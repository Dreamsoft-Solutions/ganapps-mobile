import { Image } from 'expo-image';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { Calendar, Map as MapIcon, MessageCircle, User } from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/common/Text';
import logoImage from '../../../assets/brand/ganap-logo-1.png';

interface TabRoute {
  key: string;
  name: string;
  label: string;
  icon: LucideIcon;
}

const TAB_ROUTES: TabRoute[] = [
  { key: 'map', name: '(home)', label: 'Map', icon: MapIcon },
  { key: 'events', name: '(events)', label: 'My Events', icon: Calendar },
  { key: 'chat', name: '(chat)', label: 'Chat', icon: MessageCircle },
  { key: 'profile', name: '(profile)', label: 'Profile', icon: User },
];

const ACTIVE_TINT: string = '#00c853';
const INACTIVE_TINT: string = '#6c7b6a';
const CUTOUT_RADIUS: number = 48;
const LOGO_SIZE: number = 56;
const BAR_HEIGHT: number = 64;

/**
 * Custom bottom tab bar with a central floating logo and SVG warp background.
 *
 * @param props - React Navigation bottom tab bar props.
 * @returns The custom tab bar.
 */
export function AppTabBar({ state, navigation }: BottomTabBarProps): ReactElement {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const centerX = width / 2;

  const backgroundPath = `
    M 0 0
    L ${centerX - CUTOUT_RADIUS} 0
    A ${CUTOUT_RADIUS} ${CUTOUT_RADIUS} 0 0 1 ${centerX + CUTOUT_RADIUS} 0
    L ${width} 0
    L ${width} ${BAR_HEIGHT}
    L 0 ${BAR_HEIGHT}
    Z
  `;

  return (
    <View style={{ paddingBottom: insets.bottom }}>
      <View className="overflow-visible" style={{ width, height: BAR_HEIGHT }}>
        <Svg width={width} height={BAR_HEIGHT} style={{ position: 'absolute' }}>
          <Path d={backgroundPath} fill="#ffffff" />
        </Svg>

        <View className="flex-row items-end" style={{ width, height: BAR_HEIGHT }}>
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
                <Text
                  className={`text-label-sm mt-1 ${isActive ? 'text-lynx-primary-container' : 'text-lynx-outline'}`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          className="absolute left-1/2 items-center justify-center rounded-full bg-white shadow-lg"
          style={{
            top: -LOGO_SIZE / 2,
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            marginLeft: -LOGO_SIZE / 2,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Image source={logoImage} contentFit="cover" className="h-full w-full rounded-full" />
        </View>
      </View>
    </View>
  );
}
