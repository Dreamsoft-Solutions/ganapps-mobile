import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { PasswordResetForm, type PasswordResetStep } from '@/components/forms/PasswordResetForm';
import { Routes } from '@/constants/routes';

/**
 * The line under the title for a reset step. The code and success steps lead with the server's
 * confirmation, which never says whether the account exists.
 *
 * @param step - The form's current step
 * @param message - The server's confirmation message, empty before the first request
 * @returns The subtitle for that step
 */
function subtitleFor(step: PasswordResetStep, message: string): string {
  if (step === 'request') return 'Enter your email and we’ll send a code if an account matches.';
  if (step === 'complete') return `${message} Enter the 8-digit code below and choose a new password.`;
  return message;
}

/**
 * Public password-recovery screen in the authentication stack, on the shared {@link AuthScreen}
 * frame. It carries over the email typed on the log in screen, and its subtitle follows the
 * form's step.
 *
 * @returns The reset request and code-entry flow.
 */
export default function ForgotPasswordScreen(): ReactElement {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const initialEmail: string = typeof email === 'string' ? email : '';
  const router = useRouter();
  const [subtitle, setSubtitle] = useState<string>(subtitleFor('request', ''));

  const handleStepChange = useCallback((step: PasswordResetStep, message: string): void => {
    setSubtitle(subtitleFor(step, message));
  }, []);

  return (
    <AuthScreen
      title="Reset your password"
      subtitle={subtitle}
      onBack={(): void => {
        if (router.canGoBack()) router.back();
        else router.replace(Routes.auth.login);
      }}
      backHint="Returns to log in"
    >
      <PasswordResetForm initialEmail={initialEmail} onStepChange={handleStepChange} />
    </AuthScreen>
  );
}
