import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/common/Text';
import { PasswordResetForm } from '@/components/forms/PasswordResetForm';

/**
 * Public password-recovery screen in the authentication stack.
 *
 * @returns The reset request and code-entry flow.
 */
export default function ForgotPasswordScreen(): ReactElement {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const initialEmail: string = typeof email === 'string' ? email : '';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 items-center">
          <Text className="text-headline-md text-foreground text-center">Reset your password</Text>
          <Text className="text-body-md text-muted-foreground text-center mt-2">
            Recover access to your Ganapps account.
          </Text>
        </View>
        <PasswordResetForm initialEmail={initialEmail} />
      </ScrollView>
    </SafeAreaView>
  );
}
