import type { ReactElement } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingForm } from '@/components/forms/OnboardingForm';

/**
 * Profile setup screen shown after email verification.
 *
 * Headings, step state and the skip control live in {@link OnboardingForm}, which varies all
 * three by step.
 *
 * @returns The onboarding screen.
 */
export default function OnboardingScreen(): ReactElement {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pt-6 pb-8" keyboardShouldPersistTaps="handled">
        <OnboardingForm />
      </ScrollView>
    </SafeAreaView>
  );
}
