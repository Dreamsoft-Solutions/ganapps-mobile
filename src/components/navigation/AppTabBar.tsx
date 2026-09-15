import { Image } from 'expo-image';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { Calendar, MessageCircle } from 'lucide-react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Text } from '@/components/common/Text';
import { Assets } from '@/constants/assets';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types/user.types';

interface TabRoute {
  key: string;
  name: string;
  label: string;
  icon?: LucideIcon;
  renderIcon?: (isActive: boolean, user: User | null) => ReactNode;
}

const LOGO_SIZE: number = 36;
const ACTIVE_BORDER: string = 'border-primary';
const INACTIVE_BORDER: string = 'border-transparent';

const TAB_ROUTES: TabRoute[] = [
  {
    key: 'map',
    name: '(home)',
    label: 'Map',
    renderIcon: (isActive: boolean): ReactNode => (
      <View className={`overflow-hidden rounded-full border-2 ${isActive ? ACTIVE_BORDER : INACTIVE_BORDER}`}>
        <Image source={Assets.logoIcon} style={{ width: LOGO_SIZE, height: LOGO_SIZE }} contentFit="cover" />
      </View>
    ),
  },
  { key: 'events', name: '(ganaps)', label: 'My Events', icon: Calendar },
  { key: 'chat', name: '(chat)', label: 'Friends', icon: MessageCircle },
  {
    key: 'profile',
    name: '(profile)',
    label: 'Profile',
    renderIcon: (isActive: boolean, user: User | null): ReactNode => {
      const displayName: string = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.username || '';
      return (
        <View className={`rounded-full border-2 ${isActive ? ACTIVE_BORDER : INACTIVE_BORDER}`}>
          <Avatar src={user?.displayPicture ?? null} name={displayName} size="sm" />
        </View>
      );
    },
  },
];

/** Height of the bottom tab bar, shared with the layout's floating tab bar style. */
export const BAR_HEIGHT: number = 72;

/**
 * Bottom tab bar with brand elements: the logo anchors the Map tab and the
 * user's avatar anchors the Profile tab, both framed by a primary border when
 * active.
 *
 * @param props - React Navigation bottom tab bar props.
 * @returns The tab bar.
 */
export function AppTabBar({ state, navigation }: BottomTabBarProps): ReactElement {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const theme = useResolvedTheme();

  return (
    <View style={{ paddingBottom: insets.bottom }}>
      <View className="flex-row items-end bg-card" style={{ height: BAR_HEIGHT }}>
        {TAB_ROUTES.map((tab: TabRoute, index: number): ReactNode => {
          const Icon: LucideIcon | undefined = tab.icon;
          const isActive: boolean = state.index === index;

          return (
            <Pressable
              key={tab.key}
              onPress={(): void => navigation.navigate(tab.name)}
              className="flex-1 items-center justify-end pb-3 px-2"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View className="h-11 items-center justify-center">
                {tab.renderIcon ? (
                  tab.renderIcon(isActive, user)
                ) : Icon ? (
                  <Icon size={24} color={isActive ? Colors[theme].primary : Colors[theme]['muted-foreground']} />
                ) : null}
              </View>
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
