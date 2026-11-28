import { Mail } from 'lucide-react-native';
import { type ReactElement, useMemo } from 'react';
import { type TextStyle, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

import { Button } from '@/components/common/Button';
import { LegalLinks } from '@/components/common/LegalLinks';
import { Text } from '@/components/common/Text';
import { SocialSignInButtons } from '@/components/forms/SocialSignInButtons';
import { OnboardingDots } from '@/components/onboarding/OnboardingDots';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { UseSocialSignInResult } from '@/hooks/useSocialSignIn';

/** Props for {@link OnboardingSignIn}. */
export interface OnboardingSignInProps {
  /** Horizontal offset of the photo pager, which the dots follow, dp. */
  scrollX: SharedValue<number>;
  pageWidth: number;
  pageCount: number;
  /** The Apple and Google sign-in state and actions from `useSocialSignIn`. */
  social: UseSocialSignInResult;
  /** Opens the sign-up form. */
  onSignUpWithEmail: () => void;
  /** Opens the log-in form. */
  onLogIn: () => void;
}

/**
 * The ways into the app from Welcome, under the slide headline: the page dots (when there is more
 * than one slide), Continue with Apple
 * and Continue with Google where they are available, the one green action (Sign up with email),
 * the policy links and the log-in link. It sits over the photo on the screen's bottom scrim, so
 * secondary text uses `on-glass-muted`, which holds its contrast over a backdrop. A failed social
 * sign-in is not shown here: the screen raises it as a toast, because errors never sit on a photo.
 *
 * @example
 * <OnboardingSignIn
 *   scrollX={scrollX}
 *   pageWidth={width}
 *   pageCount={ONBOARDING_SLIDES.length}
 *   social={social}
 *   onSignUpWithEmail={openSignUp}
 *   onLogIn={openLogIn}
 * />
 *
 * @param props - Pager position for the dots, the social sign-in state, and the email sign-up and log-in handlers.
 * @returns The sign-in island.
 */
export function OnboardingSignIn({
  scrollX,
  pageWidth,
  pageCount,
  social,
  onSignUpWithEmail,
  onLogIn,
}: OnboardingSignInProps): ReactElement {
  const theme = useResolvedTheme();
  /** Set as a style: the `on-glass-muted` class did not follow a theme switch on Android. */
  const mutedStyle = useMemo((): TextStyle => ({ color: Colors[theme]['on-glass-muted'] }), [theme]);

  return (
    <View className="gap-sm">
      {pageCount > 1 ? (
        <View className="pb-xs">
          <OnboardingDots scrollX={scrollX} pageWidth={pageWidth} pageCount={pageCount} />
        </View>
      ) : null}

      <SocialSignInButtons social={social} />

      <Button size="auth" leftIcon={<Mail />} onPress={onSignUpWithEmail}>
        Sign up with Email
      </Button>

      <View className="items-center pt-xs">
        <Text className="text-label-sm text-center" style={mutedStyle}>
          By continuing you agree to our
        </Text>
        <LegalLinks inline />
      </View>

      <View className="flex-row flex-wrap items-center justify-center">
        <Text className="text-body-md" style={mutedStyle}>
          Already have an account?{' '}
        </Text>
        <Button variant="link" onPress={onLogIn}>
          Log in
        </Button>
      </View>
    </View>
  );
}
