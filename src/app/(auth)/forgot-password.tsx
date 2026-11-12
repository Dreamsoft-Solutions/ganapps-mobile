import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '@/components/common/Text';
import { PasswordResetForm } from '@/components/forms/PasswordResetForm';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Routes } from '@/constants/routes';

/**
 * Public password-recovery screen in the authentication stack.
 *
 * @returns The reset request and code-entry flow.
 */
export default function ForgotPasswordScreen(): ReactElement {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const initialEmail: string = typeof email === 'string' ? email : '';
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        onBack={(): void => {
          if (router.canGoBack()) router.back();
          else router.replace(Routes.auth.login);
        }}
        backHint="Returns to log in"
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 items-center">
          <Text className="text-center font-inter-bold text-headline-md text-foreground" accessibilityRole="header">
            Reset your password
          </Text>
          <Text className="text-body-md text-muted-foreground text-center mt-2">
            Recover access to your Ganapps account.
          </Text>
        </View>
        <PasswordResetForm initialEmail={initialEmail} />
      </ScrollView>
    </View>
  );
}
