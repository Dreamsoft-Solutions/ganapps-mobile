import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 bg-lynx-background p-md">
      <Text className="text-headline-md mb-md">Profile</Text>
      {user && (
        <View className="mb-lg">
          <Text className="text-body-lg font-semibold">{user.name}</Text>
          <Text className="text-lynx-on-surface-variant">{user.email}</Text>
        </View>
      )}
      <Button variant="secondary" onPress={() => logout()}>
        Sign Out
      </Button>
    </View>
  );
}
