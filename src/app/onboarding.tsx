import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { OnboardingForm } from '@/components/forms/OnboardingForm';
import { Routes } from '@/constants/routes';

/**
 * Profile setup screen shown after email verification.
 *
 * @returns The onboarding screen.
 */
export default function OnboardingScreen(): ReactElement {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-6 pb-8" keyboardShouldPersistTaps="handled">
        <View className="mb-6">
          <Text className="text-headline-lg text-foreground mb-2">Set Up Your Profile</Text>
          <Text className="text-muted-foreground text-body-md">
            Tell us a bit about yourself so others know who you are.
          </Text>
        </View>

        <OnboardingForm />

        <View className="items-center mt-6">
          <Button
            variant="ghost"
            size="sm"
            onPress={async (): Promise<void> => {
              router.replace(Routes.app.home);
            }}
          >
            Skip for Now
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
