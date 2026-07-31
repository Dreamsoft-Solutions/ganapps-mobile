import { Tabs, useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Loading } from '@/components/common/Loading';
import { AppTabBar } from '@/components/navigation/AppTabBar';
import { Routes } from '@/constants/routes';
import { useAuthQuery } from '@/hooks/queries/useAuthQuery';
import { useAuthStore } from '@/store/auth.store';

const TAB_BAR_HEIGHT = 64;
const LOGO_SIZE = 56;

/**
 * Authenticated app shell with a custom bottom tab navigator.
 *
 * @returns The tab navigator or a loading state.
 */
export default function AppLayout(): ReactElement {
  const router = useRouter();
  const { data: user, isLoading } = useAuthQuery();
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (user) {
      setUser(user);
      if (!user.isVerified) {
        router.replace(Routes.verifyEmail);
      } else if (!hasCompletedOnboarding) {
        router.replace(Routes.onboarding);
      }
    }
  }, [user, hasCompletedOnboarding, router, setUser]);

  if (isLoading) {
    return <Loading message="Loading..." />;
  }

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps): ReactElement => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: TAB_BAR_HEIGHT + LOGO_SIZE / 2,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
        },
      }}
    >
      <Tabs.Screen name="(home)" />
      <Tabs.Screen name="(events)" />
      <Tabs.Screen name="(chat)" />
      <Tabs.Screen name="(profile)" />
    </Tabs>
  );
}
