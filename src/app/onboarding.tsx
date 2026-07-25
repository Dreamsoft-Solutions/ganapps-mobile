import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { OnboardingForm } from '@/components/forms/OnboardingForm';
import { useAuthStore } from '@/store/auth.store';

export default function OnboardingScreen(): ReactElement {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-lynx-background">
      <ScrollView className="flex-1 px-6">
        <View className="justify-center pt-12">
          <Text className="text-3xl font-bold mb-2 text-center">Complete Your Profile</Text>
          <Text className="text-lynx-on-surface-variant text-center mb-8">Tell us a bit about yourself</Text>

          <OnboardingForm />

          <View className="mt-6 items-center">
            <Button
              variant="ghost"
              size="sm"
              onPress={async (): Promise<void> => {
                await useAuthStore.getState().completeOnboarding();
                router.replace('/(app)/(home)');
              }}
            >
              Skip for Now
            </Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
