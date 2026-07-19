import { View } from 'react-native';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';

export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 bg-lynx-background p-md items-center justify-center">
      <Text className="text-headline-lg mb-sm">
        Hello, {user?.firstName || user?.username || 'there'}
      </Text>
      <Text className="text-lynx-on-surface-variant text-body-lg mb-lg">
        You're signed in to GanApps
      </Text>
      <Button variant="secondary" onPress={() => logout()}>
        Sign Out
      </Button>
    </View>
  );
}
