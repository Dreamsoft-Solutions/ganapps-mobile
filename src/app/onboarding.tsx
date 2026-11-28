import type { ReactElement } from 'react';
import { OnboardingForm } from '@/components/forms/OnboardingForm';

/**
 * Profile setup screen shown after email verification.
 *
 * The frame, headings, step marker, actions and skip control all live in {@link OnboardingForm},
 * which varies them by step.
 *
 * @returns The onboarding screen.
 */
export default function OnboardingScreen(): ReactElement {
  return <OnboardingForm />;
}
