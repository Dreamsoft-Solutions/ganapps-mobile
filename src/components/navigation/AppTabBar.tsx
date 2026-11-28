import { Image } from 'expo-image';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { Calendar, MessageCircle } from 'lucide-react-native';
import { type ReactElement, type ReactNode, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/common/Avatar';
import { Capsule } from '@/components/common/Capsule';
import { Glass } from '@/components/common/Glass';
import { Text } from '@/components/common/Text';
import { Assets } from '@/constants/assets';
import { Colors, Spacing } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useAuthStore } from '@/store/auth.store';
import type { User } from '@/types/user.types';
import { ConnectionBanner } from './ConnectionBanner';

interface TabGlyphProps {
  isActive: boolean;
  user: User | null;
  color: string;
}

interface TabRoute {
  key: string;
  name: string;
  label: string;
  icon?: LucideIcon;
  renderGlyph?: (props: TabGlyphProps) => ReactNode;
}

/** Island height, inner padding and the gap between tabs, from the Ganapps Glass TabBar. */
const ISLAND_HEIGHT: number = 64;
const ISLAND_PADDING: number = 6;
const ISLAND_MAX_WIDTH: number = 358;
const TAB_GAP: number = 2;
const MARK_SIZE: number = 28;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const LENS_SPRING = { duration: 380, dampingRatio: 1 } as const;
const LENS_FADE_MS: number = 90;
const HIDE_MS: number = 200;
const HIDE_OFFSET: number = 24;

/** The mark or avatar ring: a quiet glass rim at rest, `primary-foreground` on the lit capsule. */
function ringStyle(isActive: boolean, theme: 'light' | 'dark'): { boxShadow: string; borderRadius: number } {
  const colors = Colors[theme];
  return {
    borderRadius: MARK_SIZE / 2,
    boxShadow: isActive ? `0 0 0 2px ${colors['primary-foreground']}` : `0 0 0 1.5px ${colors['glass-rim']}`,
  };
}

const TAB_ROUTES: TabRoute[] = [
  {
    key: 'map',
    name: '(home)',
    label: 'Map',
    renderGlyph: ({ isActive }: TabGlyphProps): ReactNode => <MarkGlyph isActive={isActive} />,
  },
  { key: 'events', name: '(ganaps)', label: 'My events', icon: Calendar },
  { key: 'chat', name: '(chat)', label: 'Friends', icon: MessageCircle },
  {
    key: 'profile',
    name: '(profile)',
    label: 'Profile',
    renderGlyph: ({ isActive, user }: TabGlyphProps): ReactNode => <AvatarGlyph isActive={isActive} user={user} />,
  },
];

function MarkGlyph({ isActive }: { isActive: boolean }): ReactElement {
  const theme = useResolvedTheme();
  return (
    <View style={ringStyle(isActive, theme)}>
      <Image
        source={Assets.logoIcon}
        style={{ width: MARK_SIZE, height: MARK_SIZE, borderRadius: MARK_SIZE / 2 }}
        contentFit="cover"
      />
    </View>
  );
}

function AvatarGlyph({ isActive, user }: { isActive: boolean; user: User | null }): ReactElement {
  const theme = useResolvedTheme();
  const displayName: string = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.username || '';
  return (
    <View style={ringStyle(isActive, theme)}>
      <Avatar src={user?.displayPicture ?? null} name={displayName} size="xs" />
    </View>
  );
}

interface TabIconProps {
  tab: TabRoute;
  isActive: boolean;
  user: User | null;
  hasUnreadMessages: boolean;
  color: string;
}

function TabIcon({ tab, isActive, user, hasUnreadMessages, color }: TabIconProps): ReactElement | null {
  const Icon = tab.icon;
  const glyph: ReactNode = tab.renderGlyph ? (
    tab.renderGlyph({ isActive, user, color })
  ) : Icon ? (
    <Icon size={24} color={color} strokeWidth={isActive ? 2.25 : 2} />
  ) : null;

  return (
    <View className="relative items-center justify-center" style={{ width: MARK_SIZE, height: MARK_SIZE }}>
      {glyph}
      {hasUnreadMessages ? (
        <View
          accessible={false}
          className={`absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full ${isActive ? 'bg-primary-foreground' : 'bg-primary'}`}
        />
      ) : null}
    </View>
  );
}

/**
 * Slides the lens to the active tab on a no-bounce spring, or, with Reduce Motion on, fades it
 * out, moves it and fades it back in. The first position is set without motion.
 */
function useLens(index: number, step: number): ReturnType<typeof useAnimatedStyle<ViewStyle>> {
  const reduceMotion: boolean = useReducedMotion();
  const x = useSharedValue<number>(0);
  const opacity = useSharedValue<number>(1);
  const placed = useRef<boolean>(false);

  useEffect((): void => {
    if (index < 0 || step <= 0) return;
    const target: number = index * step;
    if (!placed.current) {
      x.set(target);
      placed.current = true;
      return;
    }
    if (reduceMotion) {
      opacity.set(
        withSequence(
          withTiming(0, { duration: LENS_FADE_MS, easing: EASE_OUT }),
          withTiming(1, { duration: LENS_FADE_MS * 2, easing: EASE_OUT }),
        ),
      );
      x.set(withDelay(LENS_FADE_MS, withTiming(target, { duration: 0 })));
      return;
    }
    x.set(withSpring(target, LENS_SPRING));
  }, [index, step, reduceMotion, x, opacity]);

  return useAnimatedStyle<ViewStyle>(
    (): ViewStyle => ({
      opacity: opacity.get(),
      transform: [{ translateX: x.get() }],
    }),
  );
}

/** Props for {@link AppTabBar}. */
export type AppTabBarProps = BottomTabBarProps & {
  /** Shows the unread dot on Friends and adds it to that tab's label. */
  hasUnreadMessages: boolean;
  /** Slides the island down and fades it out, for the full-screen flows in `shouldHideAppTabBar`. */
  hidden: boolean;
};

/**
 * The floating Ganapps Glass tab bar: four tabs in a glass island that hovers above the content,
 * the active one on a lit `primary` capsule (the lens) that slides between tabs.
 *
 * The island floats, so content scrolls under it: every tab screen pads its scroll content by
 * `Spacing['tabbar-clearance']` plus the bottom safe-area inset, and map overlays stack above it.
 * The connection banner floats just above the island.
 *
 * The lens is opaque, so the active label and glyph in `primary-foreground` keep their contrast
 * whatever the map shows underneath. Each tab fills the full island height and a quarter of its
 * width, well over the 48dp touch floor.
 *
 * The Map tab keeps the G-pin mark and Profile the user's avatar. The logo image rounds itself
 * rather than relying on its ring to clip it: the file is an opaque square, and on iOS a view clips
 * to the outer edge of its border (DS-216).
 *
 * @param props - React Navigation bottom tab bar props, the Friends unread state and whether to hide.
 * @returns The tab bar.
 */
export function AppTabBar({ state, navigation, hasUnreadMessages, hidden }: AppTabBarProps): ReactElement {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const theme = useResolvedTheme();
  const reduceMotion: boolean = useReducedMotion();
  const [islandWidth, setIslandWidth] = useState<number>(0);

  const tabCount: number = TAB_ROUTES.length;
  const lensWidth: number =
    islandWidth > 0 ? (islandWidth - 2 * ISLAND_PADDING - (tabCount - 1) * TAB_GAP) / tabCount : 0;
  const lensStyle = useLens(state.index, lensWidth > 0 ? lensWidth + TAB_GAP : 0);

  const shown = useSharedValue<number>(hidden ? 0 : 1);
  useEffect((): void => {
    shown.set(withTiming(hidden ? 0 : 1, { duration: HIDE_MS, easing: EASE_OUT }));
  }, [hidden, shown]);
  const dockStyle = useAnimatedStyle((): { opacity: number; transform: { translateY: number }[] } => ({
    opacity: shown.get(),
    transform: [{ translateY: reduceMotion ? 0 : (1 - shown.get()) * HIDE_OFFSET }],
  }));

  const handleIslandLayout = (event: LayoutChangeEvent): void => {
    setIslandWidth(event.nativeEvent.layout.width);
  };

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      style={[
        {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: Spacing['margin-mobile'],
          paddingBottom: insets.bottom + Spacing['island-inset'],
          alignItems: 'center',
          gap: Spacing.xs,
        },
        dockStyle,
      ]}
    >
      <ConnectionBanner />
      <Glass
        variant="regular"
        rim="lg"
        lift="island"
        accessibilityRole="tablist"
        onLayout={handleIslandLayout}
        className="w-full flex-row"
        style={{ maxWidth: ISLAND_MAX_WIDTH, height: ISLAND_HEIGHT, padding: ISLAND_PADDING, gap: TAB_GAP }}
      >
        {lensWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: ISLAND_PADDING,
                bottom: ISLAND_PADDING,
                left: ISLAND_PADDING,
                width: lensWidth,
              },
              lensStyle,
            ]}
          >
            <Capsule tone="primary" style={{ flexGrow: 1 }} />
          </Animated.View>
        ) : null}
        {TAB_ROUTES.map((tab: TabRoute, index: number): ReactNode => {
          const isActive: boolean = state.index === index;
          const hasUnreadForTab: boolean = tab.key === 'chat' && hasUnreadMessages;
          const ink: string = isActive ? Colors[theme]['primary-foreground'] : Colors[theme]['on-glass-muted'];

          return (
            <Pressable
              key={tab.key}
              onPress={(): void => navigation.navigate(tab.name)}
              className="flex-1 items-center justify-center rounded-full"
              style={({ pressed }): { gap: number; transform: { scale: number }[] } => ({
                gap: 2,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
              accessibilityRole="tab"
              accessibilityLabel={hasUnreadForTab ? `${tab.label}, unread messages` : tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <TabIcon tab={tab} isActive={isActive} user={user} hasUnreadMessages={hasUnreadForTab} color={ink} />
              <Text
                className={`text-label-sm ${isActive ? 'font-allo-semibold' : ''}`}
                style={{ color: ink }}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </Glass>
    </Animated.View>
  );
}
