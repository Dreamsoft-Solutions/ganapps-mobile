import { useCallback, useRef, useState } from 'react';

import type { UseAuthResult } from '@/hooks/useAuth';
import { useSocialSignInOptions } from '@/hooks/useSocialSignInOptions';
import {
  clearPendingAppleName,
  getAppleSignInCredential,
  getAppleSignInErrorMessage,
} from '@/services/apple-auth.service';
import { getGoogleFirebaseIdToken, getGoogleSignInErrorMessage } from '@/services/google-auth.service';

/** The part of `useAuth` that social sign-in needs. */
type SocialAuth = Pick<UseAuthResult, 'googleLogin' | 'appleLogin' | 'googleLoginMutation' | 'appleLoginMutation'>;

/** State and actions for the Continue with Apple and Continue with Google buttons. */
export interface UseSocialSignInResult {
  /** True when Sign in with Apple is enabled and available on this device. */
  showApple: boolean;
  /** True when Google sign-in should be offered. */
  showGoogle: boolean;
  applePending: boolean;
  googlePending: boolean;
  /** The one message to show for a failed social sign-in, if any. A cancelled sheet shows nothing. */
  error: string | undefined;
  /** Clears the message and resets both social mutations. */
  clearError: () => void;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

/**
 * Runs the Apple and Google sign-in flows and maps their failures to plain copy, for any screen
 * that offers the two buttons (the login form and Welcome). A server rejection keeps the server's
 * message; a failure before the request uses the provider's own mapping.
 *
 * @param auth - The social actions and mutations from the caller's own `useAuth()`
 * @param onStart - Called before each attempt, for callers that have other errors to clear
 * @returns Which buttons to show, their pending state, the message to render and the two actions
 * @example
 * const auth = useAuth();
 * const social = useSocialSignIn(auth);
 * <SocialSignInButtons social={social} />
 */
export function useSocialSignIn(auth: SocialAuth, onStart?: () => void): UseSocialSignInResult {
  const { googleLogin, appleLogin, googleLoginMutation, appleLoginMutation } = auth;
  const { showApple, showGoogle } = useSocialSignInOptions();
  const [preRequestError, setPreRequestError] = useState<string | undefined>();
  const appleInFlight = useRef<boolean>(false);

  const clearError = useCallback((): void => {
    setPreRequestError(undefined);
    googleLoginMutation.reset();
    appleLoginMutation.reset();
  }, [googleLoginMutation, appleLoginMutation]);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    onStart?.();
    clearError();
    try {
      const idToken = await getGoogleFirebaseIdToken();
      await googleLogin({ idToken });
    } catch (error: unknown) {
      setPreRequestError(getGoogleSignInErrorMessage(error));
    }
  }, [googleLogin, clearError, onStart]);

  const signInWithApple = useCallback(async (): Promise<void> => {
    if (appleInFlight.current) return;
    appleInFlight.current = true;
    onStart?.();
    clearError();
    try {
      const dto = await getAppleSignInCredential();
      await appleLogin(dto);
      clearPendingAppleName();
    } catch (error: unknown) {
      setPreRequestError(getAppleSignInErrorMessage(error));
    } finally {
      appleInFlight.current = false;
    }
  }, [appleLogin, clearError, onStart]);

  const mutationMessage: string | undefined = [googleLoginMutation.error, appleLoginMutation.error].find(
    Boolean,
  )?.message;

  return {
    showApple,
    showGoogle,
    applePending: appleLoginMutation.isPending,
    googlePending: googleLoginMutation.isPending,
    error: mutationMessage ?? preRequestError,
    clearError,
    signInWithApple,
    signInWithGoogle,
  };
}
