import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { LoginForm, type LoginFormMode } from '@/components/forms/LoginForm';
import { Routes } from '@/constants/routes';

/** The title and line under it for each mode. */
const COPY = {
  login: { title: 'Welcome back', subtitle: "Log in to see what's on across Iloilo." },
  signup: { title: 'Create your account', subtitle: "It takes a minute. Verify your email and you're in." },
} as const satisfies Record<LoginFormMode, { title: string; subtitle: string }>;

/**
 * Log in and sign up on the shared {@link AuthScreen} frame. `?mode=signup` opens it on the sign-up
 * form, which is how Welcome's "Sign up with Email" arrives; the title follows the mode as the
 * person switches between them. Back returns to Welcome.
 *
 * @returns The authentication screen.
 */
export default function LoginScreen(): ReactElement {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<LoginFormMode>(modeParam === 'signup' ? 'signup' : 'login');

  return (
    <AuthScreen
      title={COPY[mode].title}
      subtitle={COPY[mode].subtitle}
      onBack={(): void => {
        if (router.canGoBack()) router.back();
        else router.replace(Routes.public.welcome);
      }}
      backHint="Returns to the welcome screen"
    >
      <LoginForm mode={mode} onModeChange={setMode} />
    </AuthScreen>
  );
}
