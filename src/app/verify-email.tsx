import type { ReactElement } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { VerifyEmailForm } from '@/components/forms/VerifyEmailForm';
import { DeleteAccountFlow } from '@/components/profile/DeleteAccountFlow';
import { useAuth } from '@/hooks/useAuth';

/**
 * Email verification screen shown after registration.
 *
 * @returns The verify email screen.
 */
export default function VerifyEmailScreen(): ReactElement {
  const { deleteAccount, deleteAccountMutation, resendVerification, resendVerificationMutation } = useAuth();
  const [isDeleteFlowVisible, setIsDeleteFlowVisible] = useState<boolean>(false);

  const openDeleteFlow = (): void => {
    deleteAccountMutation.reset();
    setIsDeleteFlowVisible(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-12">
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

        <View className="mt-8 items-center">
          <Button
            accessibilityHint="Opens an irreversible account deletion confirmation"
            onPress={openDeleteFlow}
            variant="destructive"
          >
            Delete account
          </Button>
        </View>
      </View>
      <DeleteAccountFlow
        visible={isDeleteFlowVisible}
        isDeleting={deleteAccountMutation.isPending}
        error={deleteAccountMutation.error}
        onClose={(): void => setIsDeleteFlowVisible(false)}
        onDelete={deleteAccount}
      />
    </SafeAreaView>
  );
}
