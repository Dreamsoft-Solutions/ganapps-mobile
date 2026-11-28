import type { ReactElement, ReactNode } from 'react';
import { View } from 'react-native';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { DeleteAccountForm } from '@/components/forms/DeleteAccountForm';
import { VerifyEmailForm } from '@/components/forms/VerifyEmailForm';
import { useAuth } from '@/hooks/useAuth';
import { showToast } from '@/store/toast.store';

/**
 * Email verification for signed-in, unverified Users, on the shared {@link AuthScreen} frame. It
 * names the address the code went to. Log out, top right, is the way out (signing in again, or with
 * another email); account deletion stays reachable as a quiet link pinned to the bottom.
 *
 * @returns The verify email screen.
 */
export default function VerifyEmailScreen(): ReactElement {
  const { user, logout, logoutMutation, resendVerification, resendVerificationMutation } = useAuth();
  const subtitle: ReactNode = user?.email ? (
    <>
      We sent a 6-digit code to{'\n'}
      <Text className="font-allo-semibold text-body-md text-foreground">{user.email}</Text>
    </>
  ) : (
    'We sent a 6-digit code to your email.'
  );

  return (
    <AuthScreen
      title="Verify your email"
      subtitle={subtitle}
      footer={
        <View className="flex-row flex-wrap items-center justify-center">
          <Text className="text-body-md text-muted-foreground">Signed up by mistake? </Text>
          <DeleteAccountForm trigger="link" />
        </View>
      }
      headerRight={
        <Button variant="link" onPress={logout} loading={logoutMutation.isPending}>
          Log out
        </Button>
      }
    >
      <VerifyEmailForm />

      <View className="mt-lg items-center">
        <Text className="text-center text-body-md text-muted-foreground">
          Didn't receive the code? Check your spam folder.
        </Text>
        <Button
          variant="link"
          onPress={async (): Promise<void> => {
            await resendVerification();
            showToast('success', 'New code sent. Check your inbox.');
          }}
          loading={resendVerificationMutation.isPending}
        >
          Resend code
        </Button>
      </View>
    </AuthScreen>
  );
}
