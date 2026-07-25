import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Loading } from '@/components/common/Loading';
import { useAuthQuery } from '@/hooks/queries/useAuthQuery';
import { useAuthStore } from '@/store/auth.store';

export default function AppLayout() {
  const router = useRouter();
  const { data: user, isLoading } = useAuthQuery();
  const hasCompletedOnboarding = useAuthStore((s) => s.hasCompletedOnboarding);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (user) {
      setUser(user);
      if (!user.isVerified) {
        router.replace('/verify-email');
      } else if (!hasCompletedOnboarding) {
        router.replace('/onboarding');
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
        name="(features)"
        options={{
          title: 'Features',
          headerTitle: 'Features',
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
