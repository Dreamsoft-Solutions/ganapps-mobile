import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { VerifyEmailForm } from '@/components/forms/VerifyEmailForm';
import { useAuth } from '@/hooks/useAuth';

export default function VerifyEmailScreen() {
  const { resendVerification, resendVerificationMutation } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-lynx-background">
      <ScrollView className="flex-1 px-6">
        <View className="justify-center pt-12">
          <Text className="text-3xl font-bold mb-2 text-center">Verify Your Email</Text>
          <Text className="text-lynx-on-surface-variant text-center mb-8">
            Enter the 6-digit code sent to your email
          </Text>

          <VerifyEmailForm />

          <View className="mt-6 items-center">
            <Text className="text-lynx-on-surface-variant text-sm mb-2">Didn't receive the code?</Text>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => resendVerification()}
              loading={resendVerificationMutation.isPending}
            >
              Resend Code
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
