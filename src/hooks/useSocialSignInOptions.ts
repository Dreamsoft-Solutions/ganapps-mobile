import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import type { PlatformOSType } from 'react-native';
import { Platform } from 'react-native';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';

/** Which social sign-in buttons the login screen should render. */
export interface SocialSignInOptions {
  /** True when Sign in with Apple is enabled and available on this device. */
  showApple: boolean;
  /** True when Google sign-in is enabled and, on iOS, Sign in with Apple is also shown. */
  showGoogle: boolean;
}

/**
 * Decides which social sign-in buttons to show.
 *
 * App Review Guideline 4.8 requires Sign in with Apple wherever Google sign-in shows on
 * iOS, so on iOS Google appears only alongside Apple. Both stay hidden on iOS until
 * `isAvailableAsync` settles, and a rejection counts as unavailable. Other platforms
 * follow the Google flag alone.
 *
 * @param platform - The platform to decide for; defaults to the running platform.
 * @returns Whether to show the Apple and Google buttons.
 */
export function useSocialSignInOptions(platform: PlatformOSType = Platform.OS): SocialSignInOptions {
  const appleEnabled: boolean = useFeatureFlag('feature_apple_auth');
  const googleEnabled: boolean = useFeatureFlag('feature_google_auth');
  const [appleAvailable, setAppleAvailable] = useState<boolean>(false);

  useEffect((): (() => void) => {
    let active = true;
    setAppleAvailable(false);
    if (platform === 'ios' && appleEnabled) {
      AppleAuthentication.isAvailableAsync()
        .then((available: boolean): void => {
          if (active) setAppleAvailable(available);
        })
        .catch((): void => {
          if (active) setAppleAvailable(false);
        });
    }
    return (): void => {
      active = false;
    };
  }, [platform, appleEnabled]);

  if (platform !== 'ios') {
    return { showApple: false, showGoogle: googleEnabled };
  }
  return { showApple: appleAvailable, showGoogle: googleEnabled && appleAvailable };
}
