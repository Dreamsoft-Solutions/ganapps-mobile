import { Tabs } from 'expo-router';

export default function AppLayout() {
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
