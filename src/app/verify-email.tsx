import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { DeleteAccountForm } from '@/components/forms/DeleteAccountForm';
import { VerifyEmailForm } from '@/components/forms/VerifyEmailForm';
import { useAuth } from '@/hooks/useAuth';

/**
 * Email verification and account deletion access for authenticated unverified Users.
 *
 * @returns The verify email screen.
 */
export default function VerifyEmailScreen(): ReactElement {
  const { resendVerification, resendVerificationMutation } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="p-lg gap-sm" keyboardShouldPersistTaps="handled">
        <Text className="text-headline-lg text-foreground mb-2 text-center">Verify Your Email</Text>
        <Text className="text-muted-foreground text-body-md text-center mb-8">
          Enter the 6-digit code sent to your email.
        </Text>

        <VerifyEmailForm />

        <View className="mt-6 items-center">
          <Text className="text-muted-foreground text-body-md mb-2">Didn't receive the code?</Text>
          <Button
            variant="ghost"
            size="sm"
            onPress={(): Promise<void> => resendVerification()}
            loading={resendVerificationMutation.isPending}
          >
            Resend Code
          </Button>
        </View>
        <View className="mt-lg">
          <DeleteAccountForm />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
