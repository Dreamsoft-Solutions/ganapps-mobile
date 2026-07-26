import { Tabs, useRouter } from 'expo-router';
import { type ReactElement, useEffect } from 'react';
import { Loading } from '@/components/common/Loading';
import { Routes } from '@/constants/routes';
import { useAuthQuery } from '@/hooks/queries/useAuthQuery';
import { useAuthStore } from '@/store/auth.store';

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
      screenOptions={{
        tabBarActiveTintColor: '#00c853',
        tabBarInactiveTintColor: '#6c7b6a',
        headerShown: true,
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 4,
        },
        headerStyle: {
          backgroundColor: '#f9f9f9',
        },
        headerTintColor: '#1a1c1c',
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          headerTitle: 'Home',
        }}
      />
      <Tabs.Screen
        name="(ganaps)"
        options={{
          title: 'Events',
          headerTitle: 'Events',
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: 'Profile',
          headerTitle: 'Profile',
        }}
      />
      <Tabs.Screen
        name="(more)"
        options={{
          title: 'More',
          headerTitle: 'More',
        }}
      />
    </Tabs>
  );
}
