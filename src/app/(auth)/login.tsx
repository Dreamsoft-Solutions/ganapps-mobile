import type { ReactElement } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoWithText } from '@/components/common/LogoWithText';
import { Text } from '@/components/common/Text';
import { LoginForm } from '@/components/forms/LoginForm';

/**
 * Login screen with email/password and sign-up toggle.
 *
 * @returns The authentication screen.
 */
export default function LoginScreen(): ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-8">
        <View className="items-center mb-6">
          <LogoWithText />
          <Text className="text-muted-foreground text-body-md text-center mt-3">
            Verified accounts help keep meetups real.
          </Text>
        </View>

        <LoginForm />
      </View>
    </SafeAreaView>
  );
}
