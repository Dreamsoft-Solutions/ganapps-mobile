import AntDesign from '@expo/vector-icons/AntDesign';
import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';

import { Button, buttonSizeTargets } from '@/components/common/Button';
import { Colors } from '@/constants/theme';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import type { UseSocialSignInResult } from '@/hooks/useSocialSignIn';

/**
 * Google brand icon used in the social sign-in button.
 *
 * Sized to Apple's native logo beside it, which cannot be resized: on the 41pt `auth`
 * Button that logo is about 11pt tall, the label's cap height. The glyph's ink is 85% of
 * its font size, so 13 draws the G at the same height.
 *
 * @returns The Google brand glyph rendered on native and web.
 */
function GoogleIcon(): ReactElement {
  return (
    <AntDesign
      name="google"
      size={13}
      color={Colors[useResolvedTheme()].primary}
      accessibilityLabel="Google logo"
      accessibilityRole="image"
    />
  );
}

interface AppleSignInButtonProps {
  theme: 'light' | 'dark';
  pending: boolean;
  onPress: () => Promise<void>;
}

/**
 * Apple's native Continue with Apple button at the `auth` Button size, dimmed while a
 * sign-in is running.
 *
 * Apple sizes the native title from the button's height, so the `auth` height is what makes
 * it match the Google label. The native control accepts touches only inside that 41pt frame
 * and has no `hitSlop`, so the `Pressable` owns the press and extends it to 48dp. The
 * native view is drawn with touches and accessibility off, which keeps one tap to one sign-in.
 *
 * @param props - Resolved theme, pending flag and press handler
 * @returns The native button inside a pressable wrapper
 */
function AppleSignInButton({ theme, pending, onPress }: AppleSignInButtonProps): ReactElement {
  const target = buttonSizeTargets.auth.target;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Apple"
      accessibilityState={{ disabled: pending, busy: pending }}
      disabled={pending}
      hitSlop={target.hitSlop}
      onPress={onPress}
      className={pending ? 'opacity-60' : 'active:opacity-70'}
    >
      <View
        collapsable={false}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <AppleAuthenticationButton
          buttonType={AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={theme === 'dark' ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={16}
          style={{ width: '100%', height: target.sizePx }}
          onPress={(): void => undefined}
        />
      </View>
    </Pressable>
  );
}

/** Props for {@link SocialSignInButtons}. */
export interface SocialSignInButtonsProps {
  /** The result of `useSocialSignIn`, which owns the flows and their state. */
  social: UseSocialSignInResult;
}

/**
 * The Continue with Apple button above the Continue with Google button, each shown only when its
 * provider is available. The caller lays them out (they are returned as siblings) and renders
 * `social.error`.
 *
 * @param props - The social sign-in state and actions
 * @returns The buttons, or null when no provider is available
 * @example
 * const social = useSocialSignIn(useAuth());
 * <View className="gap-3"><SocialSignInButtons social={social} /></View>
 */
export function SocialSignInButtons({ social }: SocialSignInButtonsProps): ReactElement | null {
  const theme = useResolvedTheme();
  if (!social.showApple && !social.showGoogle) return null;

  return (
    <>
      {social.showApple && (
        <AppleSignInButton theme={theme} pending={social.applePending} onPress={social.signInWithApple} />
      )}

      {social.showGoogle && (
        <Button
          variant="outline"
          onPress={social.signInWithGoogle}
          size="auth"
          leftIcon={<GoogleIcon />}
          loading={social.googlePending}
          disabled={social.googlePending}
        >
          Continue with Google
        </Button>
      )}
    </>
  );
}
