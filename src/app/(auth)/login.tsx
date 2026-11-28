import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoWithText } from '@/components/common/LogoWithText';
import { Text } from '@/components/common/Text';
import { LoginForm } from '@/components/forms/LoginForm';

/**
 * Login screen with email/password and sign-up toggle. `?mode=signup` opens it on the sign-up
 * form, which is how Welcome's "Sign up with email" arrives.
 *
 * @returns The authentication screen.
 */
export default function LoginScreen(): ReactElement {
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center mb-6">
          <LogoWithText />
          <Text className="text-muted-foreground text-body-md text-center mt-3">
            Verified accounts help keep meetups real.
          </Text>
        </View>

        <LoginForm initialMode={mode === 'signup' ? 'signup' : 'login'} />
      </ScrollView>
    </SafeAreaView>
  );
}
