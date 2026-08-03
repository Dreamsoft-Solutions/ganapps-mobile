import { Tabs, useRouter, useSegments } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Loading } from '@/components/common/Loading';
import { AppTabBar } from '@/components/navigation/AppTabBar';
import { Routes } from '@/constants/routes';
import { useAuthQuery } from '@/hooks/queries/useAuthQuery';
import { useAuthStore } from '@/store/auth.store';
import { shouldHideAppTabBar } from '@/utils/navigation';
import { needsOnboarding } from '@/utils/onboarding';

const TAB_BAR_HEIGHT = 64;

/**
 * Authenticated app shell with a custom bottom tab navigator.
 *
 * @returns The tab navigator or a loading state.
 */
export default function AppLayout(): ReactElement {
  const router = useRouter();
  const segments = useSegments();
  const { data: user, isLoading } = useAuthQuery();
  const setUser = useAuthStore((s) => s.setUser);
  const hideTabBar: boolean = shouldHideAppTabBar(segments);

  useEffect(() => {
    if (!user) return;

    setUser(user);

    // This layout stays mounted underneath the full-screen onboarding and verify-email
    // modals, so its effect re-runs whenever the user object changes — including right
    // after step 1 saves. Re-issuing `replace` for the screen already on top would remount
    // the onboarding form and throw away its step state, so bail when we are already there.
    const isOnModal = segments.some((s: string): boolean => s === 'verify-email' || s === 'onboarding');
    if (isOnModal) return;

    if (!user.isVerified) {
      router.replace(Routes.verifyEmail);
    } else if (needsOnboarding(user)) {
      router.replace(Routes.onboarding);
    }
  }, [user, segments, router, setUser]);

  if (isLoading) {
    return <Loading message="Loading..." />;
  }

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps): ReactElement | null => (hideTabBar ? null : <AppTabBar {...props} />)}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: TAB_BAR_HEIGHT,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          position: 'absolute',
        },
      }}
    >
      <Tabs.Screen name="(home)" />
      <Tabs.Screen name="(ganaps)" />
      <Tabs.Screen name="(chat)" />
      <Tabs.Screen name="(profile)" />
    </Tabs>
  );
}
