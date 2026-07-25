import type { ReactElement } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { useAuth } from '@/hooks/useAuth';

export default function ProfileScreen(): ReactElement {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 bg-lynx-background p-md">
      <Text className="text-headline-md mb-md">Profile</Text>
      {user && (
        <View className="mb-lg">
          <Text className="text-body-lg font-semibold">
            {user.firstName ? `${user.firstName} ${user.lastName ?? ''}` : user.username}
          </Text>
          <Text className="text-lynx-on-surface-variant">{user.email}</Text>
          {user.isVerified ? (
            <Text className="text-lynx-primary-container text-label-md mt-xs">Verified</Text>
          ) : (
            <Text className="text-lynx-error text-label-md mt-xs">Not Verified</Text>
          )}
        </View>
      )}
      <Button variant="secondary" onPress={(): Promise<void> => logout()}>
        Sign Out
      </Button>
    </View>
  );
}
